"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { SurfaceCard } from "@/components/site/surface-card";
import { Button } from "@/components/ui/button";
import {
  getEntrySubmissionSnapshot,
  restartEntrySubmissionSession,
  submitEntrySubmissionEntries,
  type EntrySubmissionPermissions,
  type EntrySubmissionPlayer,
  type EntrySubmissionSnapshot,
  type EntrySubmissionTeam,
} from "@/lib/api/entry-submission";
import { buildLoginHref } from "@/lib/auth/auth-navigation";
import type { AuthUser } from "@/lib/auth/auth-types";
import { subscribeToEntrySubmissionSession } from "@/lib/entry-submission/live-events";
import { cn } from "@/lib/utils";

type AssignmentState = Record<number, number | null>;

type LiveState = {
  snapshot: EntrySubmissionSnapshot | null;
  permissions: EntrySubmissionPermissions | null;
};

const INITIAL_LIVE_STATE: LiveState = {
  snapshot: null,
  permissions: null,
};

const secondaryLinkClassName =
  "inline-flex items-center justify-center rounded-full border border-line-strong bg-white px-4 py-3 text-sm font-semibold text-muted transition-colors hover:border-accent hover:bg-accent-soft hover:text-accent-ink";

function sortTeams(teams: EntrySubmissionTeam[]) {
  return [...teams].sort((left, right) => left.displayOrder - right.displayOrder);
}

function formatDateTime(value: string | null | undefined) {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function findMyTeam(snapshot: EntrySubmissionSnapshot, user: AuthUser | null) {
  if (!user) {
    return null;
  }

  return snapshot.teams.find((team) => team.captainUserId === user.userPk) ?? null;
}

function derivePermissions(
  snapshot: EntrySubmissionSnapshot,
  user: AuthUser | null,
): EntrySubmissionPermissions {
  const myTeam = findMyTeam(snapshot, user);
  const isOwner = Boolean(user && snapshot.session.ownerUserId === user.userPk);
  const isAdmin = Boolean(
    user &&
      (user.role === "ROLE_MASTER" ||
        user.role === "ROLE_MANAGER" ||
        user.role === "ROLE_ADMIN"),
  );
  const myRole = isOwner && myTeam
    ? "OWNER_CAPTAIN"
    : isOwner
      ? "OWNER"
      : myTeam
        ? "CAPTAIN"
        : "VIEWER";

  return {
    canSubmit:
      snapshot.session.status === "SUBMITTING" &&
      Boolean(myTeam) &&
      !myTeam?.submitted,
    canDelete: isOwner || isAdmin,
    canRestart: isOwner || isAdmin,
    myTeamId: myTeam?.id ?? null,
    myRole,
  };
}

function buildAssignments(
  snapshot: EntrySubmissionSnapshot,
  teamId: number | null,
): AssignmentState {
  const assignments: AssignmentState = {};
  for (let setNo = 1; setNo <= snapshot.session.setCount; setNo++) {
    assignments[setNo] =
      snapshot.entries.find(
        (entry) =>
          entry.entrySubmissionTeamId === teamId && entry.setNo === setNo,
      )?.playerId ?? null;
  }
  return assignments;
}

function getPlayersForTeam(snapshot: EntrySubmissionSnapshot, teamId: number) {
  return snapshot.players
    .filter((player) => player.entrySubmissionTeamId === teamId)
    .sort((left, right) => left.displayOrder - right.displayOrder || left.id - right.id);
}

function getPlayerName(players: EntrySubmissionPlayer[], playerId: number | null | undefined) {
  if (typeof playerId !== "number") {
    return null;
  }
  return players.find((player) => player.id === playerId)?.playerName ?? null;
}

function isRestartedSnapshot(
  previous: EntrySubmissionSnapshot | null,
  next: EntrySubmissionSnapshot,
) {
  if (!previous) {
    return false;
  }

  const hadSavedProgress =
    previous.session.status === "COMPLETED" ||
    previous.entries.length > 0 ||
    previous.teams.some((team) => team.submitted);
  const returnedToInitialState =
    next.session.status === "SUBMITTING" &&
    next.entries.length === 0 &&
    next.teams.every((team) => !team.submitted);

  return hadSavedProgress && returnedToInitialState;
}

function StatusPill({ submitted }: { submitted: boolean }) {
  return (
    <span
      className={cn(
        "rounded-full px-3 py-1 text-xs font-semibold",
        submitted
          ? "bg-success-soft text-success-ink"
          : "bg-warning-soft text-warning-ink",
      )}
    >
      {submitted ? "제출완료" : "제출대기"}
    </span>
  );
}

function PlayerCard({
  draggable,
  onClick,
  player,
}: {
  draggable: boolean;
  onClick: () => void;
  player: EntrySubmissionPlayer;
}) {
  return (
    <button
      type="button"
      draggable={draggable}
      onClick={onClick}
      onDragStart={(event) => {
        if (!draggable) {
          event.preventDefault();
          return;
        }
        event.dataTransfer.setData("text/plain", String(player.id));
        event.dataTransfer.effectAllowed = "copy";
      }}
      className="rounded-lg border border-line bg-white px-4 py-3 text-left text-sm font-semibold text-foreground transition-colors hover:border-accent hover:bg-accent-soft/40"
    >
      <span className="block truncate">{player.playerName}</span>
      {player.captain ? (
        <span className="mt-1 block text-xs font-medium text-accent">팀장</span>
      ) : null}
    </button>
  );
}

export function EntrySubmissionPage({ sessionId }: { sessionId: number }) {
  const { isAuthenticated, status, user } = useAuth();
  const [liveState, setLiveState] = useState<LiveState>(INITIAL_LIVE_STATE);
  const [assignments, setAssignments] = useState<AssignmentState>({});
  const [assignmentTeamId, setAssignmentTeamId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [bootstrapped, setBootstrapped] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [restarting, setRestarting] = useState(false);
  const backgroundRefreshInFlightRef = useRef(false);
  const lastBackgroundRefreshAtRef = useRef(0);
  const lastSnapshotRef = useRef<EntrySubmissionSnapshot | null>(null);

  const applySnapshot = useCallback(
    (nextSnapshot: EntrySubmissionSnapshot) => {
      const nextPermissions =
        nextSnapshot.permissions ?? derivePermissions(nextSnapshot, user);
      if (isRestartedSnapshot(lastSnapshotRef.current, nextSnapshot)) {
        setAssignments({});
        setAssignmentTeamId(null);
      }
      lastSnapshotRef.current = nextSnapshot;
      setLiveState({
        permissions: nextPermissions,
        snapshot: {
          ...nextSnapshot,
          permissions: nextPermissions,
        },
      });
    },
    [user],
  );

  const refreshSnapshot = useCallback(
    async (options?: { background?: boolean; keepMessage?: boolean }) => {
      if (options?.background) {
        const now = Date.now();
        if (
          backgroundRefreshInFlightRef.current ||
          now - lastBackgroundRefreshAtRef.current < 1000
        ) {
          return;
        }
        backgroundRefreshInFlightRef.current = true;
        lastBackgroundRefreshAtRef.current = now;
      }

      if (!options?.background) {
        setLoading(true);
      }

      try {
        const nextSnapshot = await getEntrySubmissionSnapshot(sessionId);
        applySnapshot(nextSnapshot);
        setError(null);
        if (!options?.keepMessage) {
          setActionMessage(null);
        }
        setBootstrapped(true);
      } catch (refreshError) {
        if (!options?.background) {
          setError(
            refreshError instanceof Error
              ? refreshError.message
              : "엔트리 제출 정보를 불러오지 못했습니다.",
          );
        }
      } finally {
        if (options?.background) {
          backgroundRefreshInFlightRef.current = false;
        }
        if (!options?.background) {
          setLoading(false);
        }
      }
    },
    [applySnapshot, sessionId],
  );

  useEffect(() => {
    let cancelled = false;

    async function loadInitialSnapshot() {
      try {
        const nextSnapshot = await getEntrySubmissionSnapshot(sessionId);
        if (cancelled) {
          return;
        }
        applySnapshot(nextSnapshot);
        setError(null);
        setLoading(false);
        setBootstrapped(true);
      } catch (loadError) {
        if (cancelled) {
          return;
        }
        setError(
          loadError instanceof Error
            ? loadError.message
            : "엔트리 제출 정보를 불러오지 못했습니다.",
        );
        setLoading(false);
      }
    }

    void loadInitialSnapshot();

    return () => {
      cancelled = true;
    };
  }, [applySnapshot, sessionId]);

  useEffect(() => {
    if (!bootstrapped) {
      return;
    }

    const subscription = subscribeToEntrySubmissionSession({
      sessionId,
      onEvent: (event) => {
        if (event.snapshot) {
          applySnapshot(event.snapshot);
        }
      },
      onStateChange: (nextState) => {
        if (nextState === "connected" && status === "authenticated") {
          void refreshSnapshot({ background: true, keepMessage: true });
        }
      },
      onError: () => {
        setActionMessage("실시간 연결이 잠시 끊겼습니다. 화면 포커스 시 최신 상태를 다시 확인합니다.");
      },
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [applySnapshot, bootstrapped, refreshSnapshot, sessionId, status]);

  useEffect(() => {
    if (!bootstrapped) {
      return;
    }

    function handleVisibilityRefresh() {
      if (document.visibilityState !== "visible") {
        return;
      }
      void refreshSnapshot({ background: true, keepMessage: true });
    }

    window.addEventListener("focus", handleVisibilityRefresh);
    document.addEventListener("visibilitychange", handleVisibilityRefresh);
    return () => {
      window.removeEventListener("focus", handleVisibilityRefresh);
      document.removeEventListener("visibilitychange", handleVisibilityRefresh);
    };
  }, [bootstrapped, refreshSnapshot]);

  const snapshot = liveState.snapshot;
  const permissions = liveState.permissions;
  const sortedTeams = sortTeams(snapshot?.teams ?? []);
  const myTeam = sortedTeams.find((team) => team.id === permissions?.myTeamId) ?? null;
  const myPlayers = snapshot && myTeam ? getPlayersForTeam(snapshot, myTeam.id) : [];
  const repeatAllowed = Boolean(
    snapshot && myTeam && snapshot.session.setCount > myPlayers.length,
  );
  const canSubmit = Boolean(permissions?.canSubmit && myTeam && snapshot);
  const canRestart = Boolean(permissions?.canRestart && snapshot);
  const isCompleted = snapshot?.session.status === "COMPLETED";
  const loginHref = buildLoginHref({ redirectTo: `/draft/entry/${sessionId}` });
  const assignedPlayerIds = useMemo(
    () =>
      new Set(
        Object.values(assignments).filter(
          (playerId): playerId is number => typeof playerId === "number",
        ),
      ),
    [assignments],
  );
  const visiblePlayers =
    repeatAllowed || !canSubmit
      ? myPlayers
      : myPlayers.filter((player) => !assignedPlayerIds.has(player.id));

  useEffect(() => {
    if (!snapshot || !myTeam) {
      return;
    }

    if (assignmentTeamId !== myTeam.id || myTeam.submitted) {
      setAssignments(buildAssignments(snapshot, myTeam.id));
      setAssignmentTeamId(myTeam.id);
    }
  }, [assignmentTeamId, myTeam, snapshot]);

  function assignPlayer(setNo: number, playerId: number) {
    if (!canSubmit) {
      return;
    }
    setAssignments((current) => ({
      ...current,
      [setNo]: playerId,
    }));
  }

  function assignToFirstEmpty(playerId: number) {
    if (!snapshot || !canSubmit) {
      return;
    }
    for (let setNo = 1; setNo <= snapshot.session.setCount; setNo++) {
      if (!assignments[setNo]) {
        assignPlayer(setNo, playerId);
        return;
      }
    }
  }

  function removeAssignment(setNo: number) {
    if (!canSubmit) {
      return;
    }
    setAssignments((current) => ({
      ...current,
      [setNo]: null,
    }));
  }

  async function handleSubmit() {
    if (!snapshot || !myTeam || !canSubmit) {
      return;
    }

    const entries = [];
    for (let setNo = 1; setNo <= snapshot.session.setCount; setNo++) {
      const playerId = assignments[setNo];
      if (typeof playerId !== "number") {
        setActionMessage(`${setNo}세트 선수를 배치해 주세요.`);
        return;
      }
      entries.push({ setNo, playerId });
    }

    setSubmitting(true);
    setActionMessage(null);

    try {
      const nextSnapshot = await submitEntrySubmissionEntries(sessionId, { entries });
      applySnapshot(nextSnapshot);
      setActionMessage("엔트리를 제출했습니다.");
      setError(null);
    } catch (submitError) {
      setActionMessage(
        submitError instanceof Error
          ? submitError.message
          : "엔트리를 제출하지 못했습니다.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRestart() {
    if (!snapshot || !canRestart || restarting) {
      return;
    }

    if (
      typeof window !== "undefined" &&
      !window.confirm("제출된 엔트리를 삭제하고 처음 세팅으로 되돌릴까요?")
    ) {
      return;
    }

    setRestarting(true);
    setActionMessage(null);

    try {
      const nextSnapshot = await restartEntrySubmissionSession(sessionId);
      applySnapshot(nextSnapshot);
      setAssignments({});
      setAssignmentTeamId(null);
      setActionMessage("엔트리 제출을 처음 세팅으로 되돌렸습니다.");
      setError(null);
    } catch (restartError) {
      setActionMessage(
        restartError instanceof Error
          ? restartError.message
          : "엔트리 제출을 다시 시작하지 못했습니다.",
      );
    } finally {
      setRestarting(false);
    }
  }

  return (
    <div className="grid gap-4">
      <SurfaceCard className="p-6 sm:p-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-accent">
              Entry
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
              {snapshot?.session.title ?? "엔트리 제출"}
            </h1>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-surface-muted px-3 py-1 text-xs font-semibold text-muted">
                {snapshot?.session.setCount ?? 0}세트
              </span>
              {snapshot ? (
                <span className="rounded-full bg-surface-muted px-3 py-1 text-xs font-semibold text-muted">
                  {isCompleted ? "완료" : "제출중"}
                </span>
              ) : null}
            </div>
            {snapshot?.session.regDate ? (
              <p className="mt-3 text-sm text-muted">
                생성 {formatDateTime(snapshot.session.regDate)}
                {snapshot.session.completedAt
                  ? ` · 완료 ${formatDateTime(snapshot.session.completedAt)}`
                  : ""}
              </p>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            {canRestart ? (
              <Button
                variant="outline"
                disabled={restarting}
                onClick={() => {
                  void handleRestart();
                }}
              >
                {restarting ? "되돌리는 중" : "다시 시작"}
              </Button>
            ) : null}
            <Link href="/draft" className={secondaryLinkClassName}>
              드래프트 이력
            </Link>
          </div>
        </div>

        {!isAuthenticated && status !== "loading" ? (
          <p className="mt-5 text-sm text-muted">
            <Link href={loginHref} className="font-semibold text-accent">
              로그인
            </Link>
            하면 팀장 권한으로 엔트리를 제출할 수 있습니다.
          </p>
        ) : null}

        {actionMessage ? (
          <div className="mt-5 rounded-lg border border-line bg-surface-strong px-5 py-4">
            <p className="text-sm text-foreground">{actionMessage}</p>
          </div>
        ) : null}
      </SurfaceCard>

      {error ? (
        <SurfaceCard className="border-danger-ink/20 bg-danger-soft p-5">
          <p className="text-sm font-medium text-danger-ink">{error}</p>
          <div className="mt-4">
            <Button
              variant="outline"
              onClick={() => {
                void refreshSnapshot();
              }}
            >
              다시 불러오기
            </Button>
          </div>
        </SurfaceCard>
      ) : null}

      {loading ? (
        <div className="rounded-lg border border-dashed border-line px-6 py-10 text-sm text-muted">
          엔트리 제출 정보를 불러오는 중입니다.
        </div>
      ) : snapshot ? (
        <>
          <div className="grid gap-4 lg:grid-cols-2">
            {sortedTeams.map((team) => (
              <SurfaceCard key={team.id} className="p-5 sm:p-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold text-foreground">
                      {team.teamName}
                    </h2>
                    <p className="mt-1 text-sm text-muted">
                      팀장 {team.captainUserLoginId ?? team.teamName}
                    </p>
                  </div>
                  <StatusPill submitted={team.submitted} />
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {getPlayersForTeam(snapshot, team.id).map((player) => (
                    <span
                      key={player.id}
                      className="rounded-full border border-line bg-surface-strong px-3 py-1 text-xs font-semibold text-muted"
                    >
                      {player.playerName}
                    </span>
                  ))}
                </div>
              </SurfaceCard>
            ))}
          </div>

          {myTeam ? (
            <SurfaceCard className="p-6 sm:p-8">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-foreground">
                    {myTeam.teamName} 엔트리
                  </h2>
                  <p className="mt-2 text-sm leading-7 text-muted">
                    {myTeam.submitted
                      ? "이미 제출한 엔트리입니다."
                      : repeatAllowed
                        ? "세트 수가 선수 수보다 많아 같은 선수를 여러 세트에 넣을 수 있습니다."
                        : "선수 카드를 세트 슬롯으로 옮겨 주세요."}
                  </p>
                </div>
                <Button
                  variant="accent"
                  disabled={!canSubmit || submitting}
                  onClick={() => {
                    void handleSubmit();
                  }}
                >
                  {submitting ? "제출 중" : myTeam.submitted ? "제출완료" : "제출"}
                </Button>
              </div>

              <div className="mt-6 grid gap-4 xl:grid-cols-[300px_minmax(0,1fr)]">
                <div className="rounded-lg border border-line bg-surface-strong p-4">
                  <p className="text-sm font-semibold text-foreground">선수 카드</p>
                  <div className="mt-4 grid gap-2">
                    {visiblePlayers.length === 0 ? (
                      <p className="rounded-lg border border-dashed border-line px-4 py-6 text-sm text-muted">
                        모든 선수를 배치했습니다.
                      </p>
                    ) : (
                      visiblePlayers.map((player) => (
                        <PlayerCard
                          key={player.id}
                          player={player}
                          draggable={canSubmit}
                          onClick={() => assignToFirstEmpty(player.id)}
                        />
                      ))
                    )}
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {Array.from({ length: snapshot.session.setCount }, (_, index) => {
                    const setNo = index + 1;
                    const playerId = assignments[setNo] ?? null;
                    const playerName = getPlayerName(myPlayers, playerId);

                    return (
                      <div
                        key={setNo}
                        onDragOver={(event) => {
                          if (!canSubmit) {
                            return;
                          }
                          event.preventDefault();
                          event.dataTransfer.dropEffect = "copy";
                        }}
                        onDrop={(event) => {
                          if (!canSubmit) {
                            return;
                          }
                          event.preventDefault();
                          const nextPlayerId = Number(event.dataTransfer.getData("text/plain"));
                          if (Number.isInteger(nextPlayerId)) {
                            assignPlayer(setNo, nextPlayerId);
                          }
                        }}
                        className="min-h-32 rounded-lg border border-line bg-white p-4"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm font-semibold text-foreground">
                            {setNo}세트
                          </p>
                          {playerName && canSubmit ? (
                            <button
                              type="button"
                              className="text-xs font-semibold text-danger-ink"
                              onClick={() => removeAssignment(setNo)}
                            >
                              제거
                            </button>
                          ) : null}
                        </div>
                        {playerName ? (
                          <div className="mt-4 rounded-lg bg-accent-soft px-4 py-3 text-sm font-semibold text-accent-ink">
                            {playerName}
                          </div>
                        ) : (
                          <div className="mt-4 rounded-lg border border-dashed border-line px-4 py-6 text-sm text-muted">
                            선수 배치
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </SurfaceCard>
          ) : null}

          <SurfaceCard className="p-6 sm:p-8">
            <h2 className="text-xl font-semibold text-foreground">매칭표</h2>
            <div className="mt-5 grid gap-3">
              {snapshot.matches.map((match) => (
                <div
                  key={match.setNo}
                  className="grid gap-3 rounded-lg border border-line bg-surface-strong px-4 py-4 md:grid-cols-[90px_1fr]"
                >
                  <div className="text-sm font-semibold text-foreground">
                    {match.setNo}세트
                  </div>
                  {isCompleted ? (
                    <div className="grid gap-2 text-sm font-semibold text-foreground sm:grid-cols-[1fr_auto_1fr] sm:items-center">
                      <span>{match.team1PlayerName ?? "-"}</span>
                      <span className="text-center text-xs text-muted">vs</span>
                      <span>{match.team2PlayerName ?? "-"}</span>
                    </div>
                  ) : (
                    <p className="text-sm text-muted">
                      양 팀 제출이 완료되면 매칭이 공개됩니다.
                    </p>
                  )}
                </div>
              ))}
            </div>
          </SurfaceCard>
        </>
      ) : null}
    </div>
  );
}
