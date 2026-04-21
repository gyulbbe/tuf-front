"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import {
  formatChoice,
  formatDateTime,
  formatRace,
  formatRole,
  formatRoundResult,
  StatusBadge,
  ValueBadge,
} from "@/components/rps-draft/rps-draft-ui";
import { SectionCard } from "@/components/site/section-card";
import { SurfaceCard } from "@/components/site/surface-card";
import { TabPageShell } from "@/components/site/tab-page-shell";
import { Button } from "@/components/ui/button";
import {
  finishRpsDraftSession,
  getRpsDraftSnapshot,
  pickRpsDraftCandidate,
  startRpsDraftSession,
  submitRpsDraftChoice,
  type RpsChoice,
  type RpsDraftLivePermissions,
  type RpsDraftLiveSnapshot,
  type RpsDraftLiveTeam,
} from "@/lib/api/rps-draft";
import { buildLoginHref } from "@/lib/auth/auth-navigation";
import {
  subscribeToRpsDraftSession,
  type RpsDraftConnectionState,
} from "@/lib/rps-draft/live-events";
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
      return "오너가 세션 시작을 기다리는 중이다.";
    case "RPS_PENDING":
      return "양 팀 픽커가 가위바위보를 제출하는 중이다.";
    case "PICKING":
      return currentTeam
        ? `현재 지명 팀은 ${currentTeam.teamName}이다${
            pendingTeam ? ` · 다음은 ${pendingTeam.teamName}` : ""
          }.`
        : "현재 지명 팀을 기다리는 중이다.";
    case "FINISHED":
      return "세션이 종료됐다.";
    default:
      return "현재 상태를 확인 중이다.";
  }
}

function TeamPanel({
  myTeamId,
  sessionCurrentTeamId,
  sessionPendingTeamId,
  team,
}: {
  myTeamId: number | null;
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
        {isCurrent ? <ValueBadge className="border-accent/20">현재 차례</ValueBadge> : null}
        {!isCurrent && isPending ? (
          <ValueBadge className="border-amber-300/40 bg-amber-100 text-amber-900">
            다음 차례
          </ValueBadge>
        ) : null}
      </div>
      <p className="mt-3 text-sm leading-7 text-muted">
        픽커:{" "}
        {team.pickerName
          ? `${team.pickerName} (#${team.pickerUserId})`
          : "미지정"}
      </p>

      <div className="mt-5 space-y-3">
        {roster.length === 0 ? (
          <div className="rounded-[22px] border border-dashed border-line px-4 py-5 text-sm text-muted">
            아직 지명된 후보가 없다.
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
                  {item.candidateName}
                </span>
              </div>
              <p className="mt-2 text-xs leading-6 text-muted">
                지명자 {item.pickedByUserName || item.pickedByUserId} ·{" "}
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
  const { isAuthenticated, status } = useAuth();
  const [liveState, setLiveState] = useState(INITIAL_LIVE_STATE);
  const [connectionState, setConnectionState] =
    useState<RpsDraftConnectionState>("disconnected");
  const [loading, setLoading] = useState(true);
  const [bootstrapped, setBootstrapped] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [lastEventMessage, setLastEventMessage] = useState<string | null>(null);
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
        const nextMessage =
          refreshError instanceof Error
            ? refreshError.message
            : "라이브 스냅샷을 불러오지 못했습니다.";

        if (options?.background) {
          setLastEventMessage((current) => current ?? nextMessage);
        } else {
          setError(nextMessage);
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
            : "라이브 스냅샷을 불러오지 못했습니다.",
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
        if (event.message) {
          setLastEventMessage(event.message);
        }

        if (event.snapshot) {
          applySnapshot(event.snapshot, {
            keepPermissions: true,
          });
        }

        if (event.type === "RPS_RESOLVED" && event.roundResult === "DRAW") {
          setNotice({
            message: event.message || "비겼다. 다시 가위바위보를 제출해 주세요.",
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
        setConnectionState(nextState);

        if (nextState === "connected" && status === "authenticated") {
          void refreshSnapshot({
            background: true,
            keepMessage: true,
          });
        }
      },
      onError: (message) => {
        setNotice({
          message,
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
      setActionMessage("세션을 시작했다.");
      setError(null);
    } catch (startError) {
      setActionMessage(
        startError instanceof Error ? startError.message : "세션 시작에 실패했다.",
      );
    } finally {
      setPendingAction(null);
    }
  }

  async function handleFinish() {
    setPendingAction("finish");
    setActionMessage(null);

    try {
      const nextSnapshot = await finishRpsDraftSession(sessionId);
      applySnapshot(nextSnapshot);
      setActionMessage("세션을 종료했다.");
      setError(null);
    } catch (finishError) {
      setActionMessage(
        finishError instanceof Error ? finishError.message : "세션 종료에 실패했다.",
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
      setActionMessage(`${formatChoice(choice)}를 제출했다.`);
      setError(null);
    } catch (submitError) {
      setActionMessage(
        submitError instanceof Error
          ? submitError.message
          : "가위바위보 제출에 실패했다.",
      );
    } finally {
      setPendingAction(null);
    }
  }

  async function handlePick(candidateUserId: number) {
    setPendingAction(`pick:${candidateUserId}`);
    setActionMessage(null);

    try {
      const nextSnapshot = await pickRpsDraftCandidate(sessionId, {
        candidateUserId,
      });
      applySnapshot(nextSnapshot);
      setActionMessage("후보를 지명했다.");
      setError(null);
    } catch (pickError) {
      setActionMessage(
        pickError instanceof Error ? pickError.message : "후보 지명에 실패했다.",
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
  const loginHref = buildLoginHref({
    redirectTo: `/rps-draft/${sessionId}/live`,
  });

  return (
    <TabPageShell
      label="RPS Draft"
      title={snapshot?.session.title ?? "가위바위보 드래프트 라이브"}
      description="이 화면은 snapshot 기준으로만 렌더링한다. draw는 snapshot에 남지 않으므로 websocket event 메시지로만 별도 알린다."
      sidebar={
        <>
          <SectionCard
            title="접속 상태"
            description="실시간 이벤트는 websocket, 화면 기준 상태는 snapshot을 따른다."
          >
            <div className="mt-5 space-y-3 text-sm text-foreground">
              <p>소켓: {connectionState}</p>
              <p>역할: {formatRole(permissions?.myRole)}</p>
              <p>내 팀 ID: {myTeamId ?? "없음"}</p>
              <p>서버 시각: {formatDateTime(snapshot?.session.serverNow)}</p>
            </div>
          </SectionCard>

          <SectionCard
            title="바로 가기"
            description="설정과 라이브 화면을 오가며 준비 상태와 실시간 진행을 확인할 수 있다."
          >
            <div className="mt-5 flex flex-col gap-2">
              <Link
                href={`/rps-draft/${sessionId}`}
                className="inline-flex items-center justify-center rounded-full border border-line px-4 py-2 text-sm text-muted transition-colors hover:border-accent-soft hover:bg-surface-strong hover:text-foreground"
              >
                설정 화면
              </Link>
              <Link
                href="/rps-draft"
                className="inline-flex items-center justify-center rounded-full border border-line px-4 py-2 text-sm text-muted transition-colors hover:border-accent-soft hover:bg-surface-strong hover:text-foreground"
              >
                세션 목록
              </Link>
              {!isAuthenticated && status !== "loading" ? (
                <Link
                  href={loginHref}
                  className="inline-flex items-center justify-center rounded-full bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-ink"
                >
                  로그인
                </Link>
              ) : null}
            </div>
          </SectionCard>
        </>
      }
    >
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

      {actionMessage ? (
        <SurfaceCard className="border-line bg-surface-strong p-5">
          <p className="text-sm text-foreground">{actionMessage}</p>
        </SurfaceCard>
      ) : null}

      {lastEventMessage ? (
        <SurfaceCard className="border-line bg-surface-strong p-5">
          <p className="text-sm text-muted">최근 이벤트: {lastEventMessage}</p>
        </SurfaceCard>
      ) : null}

      {loading ? (
        <div className="rounded-[24px] border border-dashed border-line px-6 py-10 text-sm text-muted">
          라이브 스냅샷을 불러오는 중...
        </div>
      ) : snapshot ? (
        <div className="grid gap-4">
          <SurfaceCard className="p-5 sm:p-6">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={snapshot.session.status} />
                  <ValueBadge>
                    {typeof snapshot.session.currentPickNo === "number"
                      ? `${snapshot.session.currentPickNo}픽`
                      : "대기"}
                  </ValueBadge>
                  <ValueBadge>{formatRole(permissions?.myRole)}</ValueBadge>
                </div>
                <h2 className="mt-3 text-xl font-semibold text-foreground">
                  {snapshot.session.title}
                </h2>
                <p className="mt-2 text-sm leading-7 text-muted">
                  {describeTurn(snapshot)}
                </p>
                <p className="mt-2 text-xs leading-6 text-muted">
                  시작 {formatDateTime(snapshot.session.startedAt)} · 종료{" "}
                  {formatDateTime(snapshot.session.endedAt)}
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  variant="accent"
                  disabled={
                    pendingAction !== null ||
                    !canControl ||
                    snapshot.session.status !== "READY"
                  }
                  onClick={() => {
                    void handleStart();
                  }}
                >
                  {pendingAction === "start" ? "시작 중..." : "세션 시작"}
                </Button>
                <Button
                  variant="danger"
                  disabled={
                    pendingAction !== null ||
                    !canControl ||
                    snapshot.session.status === "FINISHED"
                  }
                  onClick={() => {
                    void handleFinish();
                  }}
                >
                  {pendingAction === "finish" ? "종료 중..." : "세션 종료"}
                </Button>
              </div>
            </div>

            {!isAuthenticated && status !== "loading" ? (
              <p className="mt-4 text-sm text-muted">
                액션을 수행하려면{" "}
                <Link href={loginHref} className="font-semibold text-accent">
                  로그인
                </Link>
                이 필요하다.
              </p>
            ) : null}
            {isAuthenticated && !canControl && !canSubmitRps && !canPick ? (
              <p className="mt-4 text-sm text-muted">
                현재 계정은 조회 전용이다.
              </p>
            ) : null}
          </SurfaceCard>

          <SurfaceCard className="p-5 sm:p-6">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-foreground">RPS 상태</h2>
                <p className="mt-2 text-sm leading-7 text-muted">
                  choice는 snapshot 값만 보여 준다. 둘 다 제출되기 전에는 비공개다.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <ValueBadge>{formatRoundResult(snapshot.rps.result)}</ValueBadge>
                <ValueBadge>
                  {team1?.teamName ?? "1팀"} 제출 {snapshot.rps.team1Submitted ? "완료" : "대기"}
                </ValueBadge>
                <ValueBadge>
                  {team2?.teamName ?? "2팀"} 제출 {snapshot.rps.team2Submitted ? "완료" : "대기"}
                </ValueBadge>
              </div>
            </div>

            <div className="mt-5 grid gap-4 xl:grid-cols-2">
              <div className="rounded-[22px] border border-line bg-surface-strong px-4 py-4">
                <p className="text-sm font-semibold text-foreground">
                  {team1?.teamName ?? "1팀"}
                </p>
                <p className="mt-2 text-sm text-muted">
                  제출 상태: {snapshot.rps.team1Submitted ? "완료" : "대기"}
                </p>
                <p className="mt-1 text-sm text-muted">
                  선택값: {formatChoice(snapshot.rps.team1Choice)}
                </p>
              </div>
              <div className="rounded-[22px] border border-line bg-surface-strong px-4 py-4">
                <p className="text-sm font-semibold text-foreground">
                  {team2?.teamName ?? "2팀"}
                </p>
                <p className="mt-2 text-sm text-muted">
                  제출 상태: {snapshot.rps.team2Submitted ? "완료" : "대기"}
                </p>
                <p className="mt-1 text-sm text-muted">
                  선택값: {formatChoice(snapshot.rps.team2Choice)}
                </p>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              {RPS_CHOICES.map((choice) => {
                const actionKey = `rps:${choice.value}`;

                return (
                  <Button
                    key={choice.value}
                    variant={canSubmitRps ? "accent" : "outline"}
                    disabled={pendingAction !== null || !canSubmitRps}
                    onClick={() => {
                      void handleSubmitRps(choice.value);
                    }}
                  >
                    {pendingAction === actionKey
                      ? `${choice.label} 제출 중...`
                      : `${choice.label} 제출`}
                  </Button>
                );
              })}
            </div>
          </SurfaceCard>

          <div className="grid gap-4 xl:grid-cols-2">
            {sortedTeams.map((team) => (
              <TeamPanel
                key={team.id}
                team={team}
                myTeamId={myTeamId}
                sessionCurrentTeamId={snapshot.session.currentDraftTeamId}
                sessionPendingTeamId={snapshot.session.pendingDraftTeamId}
              />
            ))}
          </div>

          <SurfaceCard className="p-5 sm:p-6">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-foreground">지명 가능 후보</h2>
                <p className="mt-2 text-sm leading-7 text-muted">
                  `permissions.canPick` 이 true일 때만 지명 버튼이 열린다.
                </p>
              </div>
              <ValueBadge>남은 후보 {snapshot.availableCandidates.length}명</ValueBadge>
            </div>

            {snapshot.availableCandidates.length === 0 ? (
              <div className="mt-5 rounded-[24px] border border-dashed border-line px-6 py-8 text-sm text-muted">
                남은 후보가 없다.
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
                              {candidate.candidateName}
                            </span>
                            <ValueBadge>{formatRace(candidate.race)}</ValueBadge>
                          </div>
                          <p className="mt-2 text-xs leading-6 text-muted">
                            userPk #{candidate.candidateUserId}
                          </p>
                        </div>
                        <Button
                          variant={canPick ? "accent" : "outline"}
                          disabled={pendingAction !== null || !canPick}
                          onClick={() => {
                            void handlePick(candidate.candidateUserId);
                          }}
                        >
                          {pendingAction === actionKey ? "지명 중..." : "지명"}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </SurfaceCard>

          <SurfaceCard className="p-5 sm:p-6">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-foreground">최근 지명</h2>
                <p className="mt-2 text-sm leading-7 text-muted">
                  최신 픽이 위에 오도록 snapshot.recentPicks 를 그대로 보여 준다.
                </p>
              </div>
              <ValueBadge>{snapshot.recentPicks.length}건</ValueBadge>
            </div>

            {snapshot.recentPicks.length === 0 ? (
              <div className="mt-5 rounded-[24px] border border-dashed border-line px-6 py-8 text-sm text-muted">
                아직 완료된 지명이 없다.
              </div>
            ) : (
              <div className="mt-5 grid gap-3">
                {snapshot.recentPicks.map((pick) => (
                  <div
                    key={`${pick.pickNo}-${pick.candidateUserId}`}
                    className="rounded-[22px] border border-line bg-surface-strong px-4 py-4"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <ValueBadge>{pick.pickNo}픽</ValueBadge>
                      <span className="text-sm font-semibold text-foreground">
                        {pick.candidateName}
                      </span>
                      <ValueBadge>{pick.rpsDraftTeamName}</ValueBadge>
                    </div>
                    <p className="mt-2 text-xs leading-6 text-muted">
                      지명자 {pick.pickedByUserName || pick.pickedByUserId} ·{" "}
                      {formatDateTime(pick.pickedAt)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </SurfaceCard>
        </div>
      ) : null}
    </TabPageShell>
  );
}
