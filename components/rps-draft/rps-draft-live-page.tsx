"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { SurfaceCard } from "@/components/site/surface-card";
import { Button } from "@/components/ui/button";
import {
  getRpsDraftSnapshot,
  pickRpsDraftCandidate,
  startRpsDraftSession,
  submitRpsDraftChoice,
  type RpsChoice,
  type RpsDraftCandidate,
  type RpsDraftLivePermissions,
  type RpsDraftLiveSnapshot,
  type RpsDraftLiveTeam,
  type RpsDraftPick,
  type RpsDraftRosterItem,
} from "@/lib/api/rps-draft";
import { buildLoginHref } from "@/lib/auth/auth-navigation";
import {
  subscribeToRpsDraftSession,
} from "@/lib/rps-draft/live-events";
import {
  rpsDraftListPath,
  rpsDraftLivePath,
} from "@/lib/rps-draft/routes";
import {
  formatRpsDraftResolvedUserId,
  getCachedRpsDraftUserIdMap,
  mergeRpsDraftUserIdMap,
} from "@/lib/rps-draft/user-id-display";
import {
  formatChoice,
  formatDateTime,
  formatRace,
  formatRelativePickNo,
  formatRoundResult,
  StatusBadge,
  ValueBadge,
} from "@/components/rps-draft/rps-draft-ui";
import { cn } from "@/lib/utils";

type NoticeTone = "info" | "danger" | "success";

type LiveState = {
  permissions: RpsDraftLivePermissions | null;
  snapshot: RpsDraftLiveSnapshot | null;
};

type LiveNotice = {
  message: string;
  tone: NoticeTone;
};

const INITIAL_LIVE_STATE: LiveState = {
  permissions: null,
  snapshot: null,
};

const RPS_CHOICES: readonly { label: string; value: RpsChoice }[] = [
  { label: "가위", value: "SCISSORS" },
  { label: "바위", value: "ROCK" },
  { label: "보", value: "PAPER" },
];

const secondaryLinkClassName =
  "inline-flex items-center justify-center rounded-full border border-line px-4 py-3 text-sm font-medium text-muted transition-colors hover:border-accent-soft hover:bg-surface-strong hover:text-foreground";

function buildNoticeClassName(tone: NoticeTone) {
  switch (tone) {
    case "danger":
      return "border-danger-ink/20 bg-danger-soft text-danger-ink";
    case "success":
      return "border-emerald-300/40 bg-emerald-100 text-emerald-900";
    default:
      return "border-accent/20 bg-accent-soft text-accent-ink";
  }
}

function sortTeams(teams: RpsDraftLiveTeam[]) {
  return [...teams].sort((left, right) => left.displayOrder - right.displayOrder);
}

function sortRoster(team: RpsDraftLiveTeam) {
  return [...team.roster].sort((left, right) => left.pickNo - right.pickNo);
}

function formatCandidateUserId(
  candidate: Pick<RpsDraftCandidate, "candidateUserId" | "candidateUserLoginId">,
  resolvedUserIds: Record<number, string>,
  fallback = "아이디 확인 필요",
) {
  return formatRpsDraftResolvedUserId({
    fallback,
    resolvedUserIds,
    userLoginId: candidate.candidateUserLoginId,
    userPk: candidate.candidateUserId,
  });
}

function formatRosterUserId(
  item: Pick<RpsDraftRosterItem, "candidateUserId" | "candidateUserLoginId">,
  resolvedUserIds: Record<number, string>,
  fallback = "아이디 확인 필요",
) {
  return formatRpsDraftResolvedUserId({
    fallback,
    resolvedUserIds,
    userLoginId: item.candidateUserLoginId,
    userPk: item.candidateUserId,
  });
}

function formatPickUserId(
  pick: Pick<RpsDraftPick, "candidateUserId" | "candidateUserLoginId">,
  resolvedUserIds: Record<number, string>,
  fallback = "아이디 확인 필요",
) {
  return formatRpsDraftResolvedUserId({
    fallback,
    resolvedUserIds,
    userLoginId: pick.candidateUserLoginId,
    userPk: pick.candidateUserId,
  });
}

function findTeamById(teams: RpsDraftLiveTeam[], teamId: number | null | undefined) {
  if (typeof teamId !== "number") {
    return null;
  }

  return teams.find((team) => team.id === teamId) ?? null;
}

function describeTurn(snapshot: RpsDraftLiveSnapshot) {
  const currentTeam = findTeamById(
    snapshot.teams,
    snapshot.session.currentDraftTeamId,
  );
  const pendingTeam = findTeamById(
    snapshot.teams,
    snapshot.session.pendingDraftTeamId,
  );

  switch (snapshot.session.status) {
    case "READY":
      return "방장이 시작하면 두 팀장이 가위바위보를 냅니다.";
    case "RPS_PENDING":
      return "두 팀장이 가위바위보를 내는 중입니다.";
    case "PICKING":
      return currentTeam
        ? `${currentTeam.teamName} 차례입니다.${
            pendingTeam ? ` 다음은 ${pendingTeam.teamName}.` : ""
          }`
        : "선수 선택 차례를 기다리는 중입니다.";
    case "FINISHED":
      return "팀 정하기가 끝났습니다.";
    default:
      return "현재 상태를 확인하는 중입니다.";
  }
}

function describePickHelp(options: {
  canPick: boolean;
  currentTeam: RpsDraftLiveTeam | null;
  status: string | null | undefined;
}) {
  if (options.status !== "PICKING") {
    return "가위바위보가 끝나면 여기서 선수를 고릅니다.";
  }

  if (options.canPick) {
    return "지금은 당신 팀 차례입니다.";
  }

  if (options.currentTeam) {
    return `지금은 ${options.currentTeam.teamName} 차례입니다.`;
  }

  return "선수 선택 순서를 확인하는 중입니다.";
}

function RpsHandIcon({ choice }: { choice: RpsChoice }) {
  const commonProps = {
    fill: "none",
    stroke: "currentColor",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    strokeWidth: 2.3,
  };

  if (choice === "SCISSORS") {
    return (
      <svg viewBox="0 0 48 48" className="h-12 w-12 sm:h-14 sm:w-14" aria-hidden="true">
        <circle cx="13" cy="33" r="4.5" {...commonProps} />
        <circle cx="23" cy="34" r="4.5" {...commonProps} />
        <path d="M16 30 31 16" {...commonProps} />
        <path d="M26 30 37 15" {...commonProps} />
        <path d="M22 31 31 38" {...commonProps} />
        <path d="M29 26 37 37" {...commonProps} />
      </svg>
    );
  }

  if (choice === "ROCK") {
    return (
      <svg viewBox="0 0 48 48" className="h-12 w-12 sm:h-14 sm:w-14" aria-hidden="true">
        <path d="M15 21c0-2 1.6-3.5 3.5-3.5S22 19 22 21v1.5" {...commonProps} />
        <path d="M21 20.5c0-2 1.6-3.5 3.5-3.5S28 18.5 28 20.5v2" {...commonProps} />
        <path d="M27 21c0-2 1.6-3.5 3.5-3.5S34 19 34 21v4" {...commonProps} />
        <path
          d="M14 26c0-3.3 2.7-6 6-6h8c4.4 0 8 3.6 8 8v4.5c0 4.7-3.8 8.5-8.5 8.5H23c-5 0-9-4-9-9z"
          {...commonProps}
        />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 48 48" className="h-12 w-12 sm:h-14 sm:w-14" aria-hidden="true">
      <path d="M16 14v14" {...commonProps} />
      <path d="M22 11v17" {...commonProps} />
      <path d="M28 10v18" {...commonProps} />
      <path d="M34 14v14" {...commonProps} />
      <path d="M14 28c0 6.1 4.9 11 11 11h2c4.9 0 9-4 9-9V18" {...commonProps} />
      <path d="M14 22c0-2 1.6-3.5 3.5-3.5S21 20 21 22v6" {...commonProps} />
    </svg>
  );
}

function TeamPanel({
  myTeamId,
  resolvedUserIds,
  sessionCurrentTeamId,
  sessionPendingTeamId,
  team,
}: {
  myTeamId: number | null;
  resolvedUserIds: Record<number, string>;
  sessionCurrentTeamId: number | null;
  sessionPendingTeamId: number | null;
  team: RpsDraftLiveTeam;
}) {
  const isCurrent = sessionCurrentTeamId === team.id;
  const isPending = sessionPendingTeamId === team.id;
  const isMine = myTeamId === team.id;
  const roster = sortRoster(team);

  return (
    <SurfaceCard
      className={cn(
        "p-5 sm:p-6",
        isCurrent && "border-accent/30 bg-accent-soft/40",
        !isCurrent && isPending && "border-amber-300/40 bg-amber-50",
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <ValueBadge>{team.displayOrder}팀</ValueBadge>
        <h2 className="text-lg font-semibold text-foreground">{team.teamName}</h2>
        {isMine ? <ValueBadge>내 팀</ValueBadge> : null}
        {isCurrent ? <ValueBadge className="border-accent/20">지금 차례</ValueBadge> : null}
        {!isCurrent && isPending ? (
          <ValueBadge className="border-amber-300/40 bg-amber-100 text-amber-900">
            다음 차례
          </ValueBadge>
        ) : null}
      </div>

      <div className="mt-5 space-y-3">
        {roster.length === 0 ? (
          <div className="rounded-[22px] border border-dashed border-line px-4 py-5 text-sm text-muted">
            아직 뽑은 선수가 없습니다.
          </div>
        ) : (
          roster.map((item) => (
            <div
              key={`${team.id}-${item.pickNo}`}
              className="rounded-[22px] border border-line bg-surface-strong px-4 py-4"
            >
              <div className="flex flex-wrap items-center gap-2">
                <ValueBadge>{item.pickNo}픽</ValueBadge>
                <span className="text-sm font-semibold text-foreground">
                  {formatRosterUserId(item, resolvedUserIds)}
                </span>
              </div>
              <p className="mt-2 text-xs leading-6 text-muted">
                {formatDateTime(item.pickedAt)}
              </p>
            </div>
          ))
        )}
      </div>
    </SurfaceCard>
  );
}

export function RpsDraftLivePage({ sessionId }: { sessionId: number }) {
  const { isAuthenticated, status, user } = useAuth();
  const [liveState, setLiveState] = useState(INITIAL_LIVE_STATE);
  const [resolvedUserIds, setResolvedUserIds] = useState<Record<number, string>>(
    () => getCachedRpsDraftUserIdMap(),
  );
  const [loading, setLoading] = useState(true);
  const [bootstrapped, setBootstrapped] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [notice, setNotice] = useState<LiveNotice | null>(null);

  const applySnapshot = useCallback(
    (
      nextSnapshot: RpsDraftLiveSnapshot,
      options?: {
        keepPermissions?: boolean;
      },
    ) => {
      setLiveState((current) => {
        const nextPermissions =
          options?.keepPermissions || nextSnapshot.permissions === null
            ? current.permissions
            : nextSnapshot.permissions;

        return {
          permissions: nextPermissions ?? null,
          snapshot: {
            ...nextSnapshot,
            permissions: nextPermissions ?? null,
          },
        };
      });
    },
    [],
  );

  useEffect(() => {
    if (!user?.username || typeof user.userPk !== "number") {
      return;
    }

    setResolvedUserIds((current) =>
      mergeRpsDraftUserIdMap(current, {
        [user.userPk]: user.username,
      }),
    );
  }, [user?.userPk, user?.username]);

  const refreshSnapshot = useCallback(
    async (options?: { background?: boolean; keepMessage?: boolean }) => {
      if (!options?.background) {
        setLoading(true);
      }

      try {
        const nextSnapshot = await getRpsDraftSnapshot(sessionId);
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
              : "드래프트 진행 화면을 불러오지 못했습니다.",
          );
        }
      } finally {
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
        const nextSnapshot = await getRpsDraftSnapshot(sessionId);

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
            : "드래프트 진행 화면을 불러오지 못했습니다.",
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

    const subscription = subscribeToRpsDraftSession({
      sessionId,
      onEvent: (event) => {
        if (event.snapshot) {
          applySnapshot(event.snapshot, {
            keepPermissions: true,
          });
        }

        if (event.type === "RPS_RESOLVED" && event.roundResult === "DRAW") {
          setNotice({
            message: "무승부입니다. 다시 가위바위보를 냅니다.",
            tone: "info",
          });
        }

        if (status === "authenticated") {
          void refreshSnapshot({
            background: true,
            keepMessage: true,
          });
        }
      },
      onStateChange: (nextState) => {
        if (nextState === "connected" && status === "authenticated") {
          void refreshSnapshot({
            background: true,
            keepMessage: true,
          });
        }
      },
      onError: () => {
        setNotice({
          message: "실시간 연결이 잠시 끊겼습니다. 화면을 다시 열면 최신 상태를 볼 수 있습니다.",
          tone: "danger",
        });
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

      void refreshSnapshot({
        background: true,
        keepMessage: true,
      });
    }

    window.addEventListener("focus", handleVisibilityRefresh);
    document.addEventListener("visibilitychange", handleVisibilityRefresh);

    return () => {
      window.removeEventListener("focus", handleVisibilityRefresh);
      document.removeEventListener("visibilitychange", handleVisibilityRefresh);
    };
  }, [bootstrapped, refreshSnapshot]);

  useEffect(() => {
    if (!notice) {
      return;
    }

    const timer = window.setTimeout(() => {
      setNotice(null);
    }, 5000);

    return () => {
      window.clearTimeout(timer);
    };
  }, [notice]);

  async function handleStart() {
    setPendingAction("start");
    setActionMessage(null);

    try {
      const nextSnapshot = await startRpsDraftSession(sessionId);
      applySnapshot(nextSnapshot);
      setActionMessage("드래프트를 시작했습니다.");
      setError(null);
    } catch (startError) {
      setActionMessage(
        startError instanceof Error
          ? startError.message
          : "드래프트를 시작하지 못했습니다.",
      );
    } finally {
      setPendingAction(null);
    }
  }

  async function handleSubmitRps(choice: RpsChoice) {
    setPendingAction(`rps:${choice}`);
    setActionMessage(null);

    try {
      const nextSnapshot = await submitRpsDraftChoice(sessionId, { choice });
      applySnapshot(nextSnapshot);
      setActionMessage(`${formatChoice(choice)}를 냈습니다.`);
      setError(null);
    } catch (submitError) {
      setActionMessage(
        submitError instanceof Error
          ? submitError.message
          : "가위바위보를 제출하지 못했습니다.",
      );
    } finally {
      setPendingAction(null);
    }
  }

  async function handlePick(candidateUserId: number) {
    const pickedCandidate = liveState.snapshot?.availableCandidates.find(
      (candidate) => candidate.candidateUserId === candidateUserId,
    );

    setPendingAction(`pick:${candidateUserId}`);
    setActionMessage(null);

    try {
      const nextSnapshot = await pickRpsDraftCandidate(sessionId, {
        candidateUserId,
      });
      applySnapshot(nextSnapshot);
      setActionMessage(
        pickedCandidate
          ? `${formatCandidateUserId(
              pickedCandidate,
              resolvedUserIds,
              "선수",
            )}을 선택했습니다.`
          : "선수를 선택했습니다.",
      );
      setError(null);
    } catch (pickError) {
      setActionMessage(
        pickError instanceof Error
          ? pickError.message
          : "선수를 선택하지 못했습니다.",
      );
    } finally {
      setPendingAction(null);
    }
  }

  const snapshot = liveState.snapshot;
  const permissions = liveState.permissions;
  const sortedTeams = sortTeams(snapshot?.teams ?? []);
  const team1 = sortedTeams[0] ?? null;
  const team2 = sortedTeams[1] ?? null;
  const myTeamId = permissions?.myTeamId ?? null;
  const canControl = Boolean(permissions?.canControl);
  const canSubmitRps = Boolean(permissions?.canSubmitRps);
  const canPick = Boolean(permissions?.canPick);
  const currentTeam = snapshot
    ? findTeamById(sortedTeams, snapshot.session.currentDraftTeamId)
    : null;
  const latestPick = snapshot?.recentPicks[0] ?? null;
  const choicesRevealed = Boolean(
    snapshot?.rps.team1Choice && snapshot?.rps.team2Choice,
  );
  const loginHref = buildLoginHref({
    redirectTo: rpsDraftLivePath(sessionId),
  });

  return (
    <div className="grid gap-4">
      <SurfaceCard className="p-6 sm:p-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-accent">
              Draft
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {snapshot ? <StatusBadge status={snapshot.session.status} /> : null}
              {snapshot ? (
                <ValueBadge>{formatRelativePickNo(snapshot.session.currentPickNo)}</ValueBadge>
              ) : null}
            </div>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
              {snapshot?.session.title ?? "팀배/컨텐츠 드래프트"}
            </h1>
            <p className="mt-4 text-base leading-8 text-muted">
              {snapshot ? describeTurn(snapshot) : "드래프트 진행 화면을 불러오는 중입니다."}
            </p>
            {latestPick ? (
              <p className="mt-3 text-sm text-muted">
                최근 선택: {latestPick.pickNo}픽{" "}
                {formatPickUserId(
                  latestPick,
                  resolvedUserIds,
                  "선수",
                )}{" "}
                ·{" "}
                {latestPick.rpsDraftTeamName}
              </p>
            ) : null}
            {snapshot?.session.startedAt ? (
              <p className="mt-3 text-xs leading-6 text-muted">
                시작 {formatDateTime(snapshot.session.startedAt)}
                {snapshot.session.endedAt
                  ? ` · 종료 ${formatDateTime(snapshot.session.endedAt)}`
                  : ""}
              </p>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-2">
            <Link href={rpsDraftListPath()} className={secondaryLinkClassName}>
              목록
            </Link>
            {snapshot?.session.status === "READY" && canControl ? (
              <Button
                variant="accent"
                disabled={pendingAction !== null}
                onClick={() => {
                  void handleStart();
                }}
              >
                {pendingAction === "start" ? "시작하는 중..." : "시작"}
              </Button>
            ) : null}
          </div>
        </div>

        {!isAuthenticated && status !== "loading" ? (
          <p className="mt-5 text-sm text-muted">
            <Link href={loginHref} className="font-semibold text-accent">
              로그인
            </Link>
            하면 팀장 권한으로 참여할 수 있습니다.
          </p>
        ) : null}

        {actionMessage ? (
          <div className="mt-5 rounded-[24px] border border-line bg-surface-strong px-5 py-4">
            <p className="text-sm text-foreground">{actionMessage}</p>
          </div>
        ) : null}
      </SurfaceCard>

      {notice ? (
        <SurfaceCard className={cn("p-5", buildNoticeClassName(notice.tone))}>
          <p className="text-sm font-medium">{notice.message}</p>
        </SurfaceCard>
      ) : null}

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
        <div className="rounded-[24px] border border-dashed border-line px-6 py-10 text-sm text-muted">
          드래프트 진행 화면을 불러오는 중입니다.
        </div>
      ) : snapshot ? (
        <>
          <SurfaceCard className="p-6 sm:p-8">
            <div className="flex justify-end">
              {choicesRevealed ? (
                <ValueBadge>{formatRoundResult(snapshot.rps.result)}</ValueBadge>
              ) : null}
            </div>

            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              <div className="rounded-[22px] border border-line bg-surface-strong px-4 py-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-foreground">
                    {team1?.teamName ?? "1팀"}
                  </span>
                  <ValueBadge>
                    {snapshot.rps.team1Submitted ? "제출 완료" : "제출 대기"}
                  </ValueBadge>
                </div>
                {choicesRevealed ? (
                  <p className="mt-3 text-sm text-muted">
                    선택 {formatChoice(snapshot.rps.team1Choice)}
                  </p>
                ) : null}
              </div>

              <div className="rounded-[22px] border border-line bg-surface-strong px-4 py-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-foreground">
                    {team2?.teamName ?? "2팀"}
                  </span>
                  <ValueBadge>
                    {snapshot.rps.team2Submitted ? "제출 완료" : "제출 대기"}
                  </ValueBadge>
                </div>
                {choicesRevealed ? (
                  <p className="mt-3 text-sm text-muted">
                    선택 {formatChoice(snapshot.rps.team2Choice)}
                  </p>
                ) : null}
              </div>
            </div>

            <div className="mt-5 grid grid-cols-3 gap-3 sm:flex sm:flex-wrap">
              {RPS_CHOICES.map((choice) => {
                const actionKey = `rps:${choice.value}`;

                return (
                  <Button
                    key={choice.value}
                    variant={canSubmitRps ? "accent" : "outline"}
                    disabled={pendingAction !== null || !canSubmitRps}
                    className="h-24 min-w-0 rounded-[24px] p-0 sm:h-28 sm:w-28"
                    title={choice.label}
                    aria-label={choice.label}
                    onClick={() => {
                      void handleSubmitRps(choice.value);
                    }}
                  >
                    <span className="sr-only">
                      {pendingAction === actionKey
                        ? `${choice.label} 내는 중...`
                        : choice.label}
                    </span>
                    <span className="flex flex-col items-center gap-1.5">
                      <RpsHandIcon choice={choice.value} />
                      <span className="text-sm font-semibold leading-none">
                        {choice.label}
                      </span>
                    </span>
                  </Button>
                );
              })}
            </div>
          </SurfaceCard>

          <SurfaceCard className="p-6 sm:p-8">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-xl font-semibold text-foreground">
                  지금 뽑을 수 있는 후보
                </h2>
                <p className="mt-3 text-sm leading-7 text-muted">
                  {describePickHelp({
                    canPick,
                    currentTeam,
                    status: snapshot.session.status,
                  })}
                </p>
              </div>
              <ValueBadge>남은 후보 {snapshot.availableCandidates.length}명</ValueBadge>
            </div>

            {snapshot.availableCandidates.length === 0 ? (
              <div className="mt-5 rounded-[24px] border border-dashed border-line px-6 py-8 text-sm text-muted">
                {snapshot.session.status === "FINISHED"
                  ? "모든 후보 선택이 끝났습니다."
                  : "지금은 선택할 후보가 없습니다."}
              </div>
            ) : (
              <div className="mt-5 grid gap-3">
                {snapshot.availableCandidates.map((candidate) => {
                  const actionKey = `pick:${candidate.candidateUserId}`;

                  return (
                    <div
                      key={candidate.candidateUserId}
                      className="rounded-[22px] border border-line bg-surface-strong px-4 py-4"
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-semibold text-foreground">
                              {formatCandidateUserId(
                                candidate,
                                resolvedUserIds,
                                "user",
                              )}
                            </span>
                            <ValueBadge>{formatRace(candidate.race)}</ValueBadge>
                          </div>
                        </div>

                        <Button
                          variant={canPick ? "accent" : "outline"}
                          disabled={pendingAction !== null || !canPick}
                          onClick={() => {
                            void handlePick(candidate.candidateUserId);
                          }}
                        >
                          {pendingAction === actionKey ? "선택 중..." : "선택"}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </SurfaceCard>

          <div className="grid gap-4 lg:grid-cols-2">
            {sortedTeams.map((team) => (
              <TeamPanel
                key={team.id}
                team={team}
                myTeamId={myTeamId}
                resolvedUserIds={resolvedUserIds}
                sessionCurrentTeamId={snapshot.session.currentDraftTeamId}
                sessionPendingTeamId={snapshot.session.pendingDraftTeamId}
              />
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
