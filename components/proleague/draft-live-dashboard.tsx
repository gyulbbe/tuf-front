"use client";

import {
  startTransition,
  useDeferredValue,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  extendDraftTurn,
  finishDraftSession,
  getDraftSnapshot,
  listDraftSessions,
  pauseDraftSession,
  pickDraftCandidate,
  resumeDraftSession,
  skipDraftTurn,
  startDraftSession,
  type DraftCandidate,
  type DraftLiveSessionInfo,
  type DraftLiveSnapshot,
  type DraftLiveTeam,
  type DraftSessionSummary,
} from "@/lib/api/draft";
import { subscribeToDraftSession } from "@/lib/draft/live-events";
import { useAuth } from "@/components/auth/auth-provider";
import { SurfaceCard } from "@/components/site/surface-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type NoticeTone = "error" | "neutral" | "success";

type ConnectionState =
  | "connecting"
  | "connected"
  | "reconnecting"
  | "disconnected"
  | "error";

type NoticeState = {
  tone: NoticeTone;
  text: string;
};

const STATUS_LABELS: Record<string, string> = {
  READY: "준비",
  LIVE: "진행 중",
  PAUSED: "일시정지",
  FINISHED: "종료",
};

const CONNECTION_LABELS: Record<ConnectionState, string> = {
  connecting: "소켓 연결 중",
  connected: "실시간 연결됨",
  reconnecting: "재연결 시도 중",
  disconnected: "연결 종료",
  error: "연결 오류",
};

function formatDraftStatus(status: string | null | undefined) {
  if (!status) {
    return "미정";
  }

  return STATUS_LABELS[status] ?? status;
}

function formatMyRole(role: string | null | undefined) {
  if (role === "PICKER") {
    return "PICKER";
  }

  return "권한 없음";
}

function formatUserRole(role: string | null | undefined) {
  switch (role) {
    case "ROLE_MASTER":
      return "마스터";
    case "ROLE_MANAGER":
      return "매니저";
    case "ROLE_ADMIN":
      return "관리자";
    case "ROLE_SYSTEM":
      return "시스템";
    default:
      return role ?? "일반 사용자";
  }
}

function readErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return "요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.";
}

function toTimestamp(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const timestamp = Date.parse(value);

  if (Number.isNaN(timestamp)) {
    return null;
  }

  return timestamp;
}

function formatDateTime(value: string | null | undefined) {
  const timestamp = toTimestamp(value);

  if (timestamp === null) {
    return "-";
  }

  return new Intl.DateTimeFormat("ko-KR", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(timestamp);
}

function formatCountdown(totalSeconds: number) {
  const safeSeconds = Math.max(totalSeconds, 0);
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function getStatusPriority(status: string) {
  switch (status) {
    case "LIVE":
      return 0;
    case "PAUSED":
      return 1;
    case "READY":
      return 2;
    case "FINISHED":
      return 3;
    default:
      return 4;
  }
}

function sortSessions(sessions: DraftSessionSummary[]) {
  return [...sessions].sort((left, right) => {
    const priorityGap = getStatusPriority(left.status) - getStatusPriority(right.status);

    if (priorityGap !== 0) {
      return priorityGap;
    }

    const leftActivity =
      toTimestamp(left.startedAt) ??
      toTimestamp(left.endedAt) ??
      toTimestamp(left.deadlineAt) ??
      left.id;
    const rightActivity =
      toTimestamp(right.startedAt) ??
      toTimestamp(right.endedAt) ??
      toTimestamp(right.deadlineAt) ??
      right.id;

    return rightActivity - leftActivity;
  });
}

function sortTeams(teams: DraftLiveTeam[]) {
  return [...teams].sort((left, right) => {
    if (left.displayOrder !== right.displayOrder) {
      return left.displayOrder - right.displayOrder;
    }

    return left.id - right.id;
  });
}

function chooseInitialSessionId(sessions: DraftSessionSummary[]) {
  return sessions[0]?.id ?? null;
}

function mergeSessionSummary(
  currentSessions: DraftSessionSummary[],
  session: DraftLiveSessionInfo,
) {
  const nextSessions = currentSessions.map((item) =>
    item.id === session.id
      ? {
          ...item,
          status: session.status,
          teamCount: session.teamCount,
          pickTimeSeconds: session.pickTimeSeconds,
          currentPickNo: session.currentPickNo,
          currentDraftTeamId: session.currentDraftTeamId,
          deadlineAt: session.deadlineAt,
          startedAt: session.startedAt,
          endedAt: session.endedAt,
          title: session.title,
        }
      : item,
  );

  if (nextSessions.some((item) => item.id === session.id)) {
    return sortSessions(nextSessions);
  }

  return sortSessions([
    ...nextSessions,
    {
      id: session.id,
      title: session.title,
      status: session.status,
      teamCount: session.teamCount,
      pickTimeSeconds: session.pickTimeSeconds,
      currentPickNo: session.currentPickNo,
      currentDraftTeamId: session.currentDraftTeamId,
      deadlineAt: session.deadlineAt,
      startedAt: session.startedAt,
      endedAt: session.endedAt,
    },
  ]);
}

function calculateRemainingSeconds(
  snapshot: DraftLiveSnapshot | null,
  nowTickMs: number,
  serverOffsetMs: number,
) {
  if (!snapshot) {
    return 0;
  }

  const deadlineAt = toTimestamp(snapshot.session.deadlineAt);

  if (deadlineAt === null) {
    return Math.max(snapshot.currentTurn?.remainingSeconds ?? 0, 0);
  }

  const referenceNow = nowTickMs + serverOffsetMs;
  return Math.max(Math.ceil((deadlineAt - referenceNow) / 1000), 0);
}

function readServerOffsetMs(serverNow: string | null | undefined) {
  const timestamp = toTimestamp(serverNow);

  if (timestamp === null) {
    return 0;
  }

  return timestamp - Date.now();
}

function parsePositiveSeconds(value: string, fallback?: number) {
  const trimmed = value.trim();

  if (!trimmed) {
    if (typeof fallback === "number") {
      return fallback;
    }

    throw new Error("초 단위를 입력해 달라.");
  }

  const parsed = Number(trimmed);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error("1초 이상의 정수를 입력해 달라.");
  }

  return parsed;
}

function getToneClassName(tone: NoticeTone) {
  if (tone === "success") {
    return "border border-success-ink/15 bg-success-soft text-success-ink";
  }

  if (tone === "error") {
    return "border border-danger-ink/15 bg-danger-soft text-danger-ink";
  }

  return "border border-line bg-surface-muted text-foreground";
}

function getStatusBadgeClassName(status: string | null | undefined) {
  switch (status) {
    case "LIVE":
      return "bg-success-soft text-success-ink";
    case "PAUSED":
      return "bg-danger-soft text-danger-ink";
    case "FINISHED":
      return "bg-surface-muted text-muted";
    default:
      return "bg-accent-soft text-accent-ink";
  }
}

function TeamCard({
  currentTeamId,
  draftTeam,
}: {
  currentTeamId: number | null;
  draftTeam: DraftLiveTeam;
}) {
  const isCurrentTeam = draftTeam.id === currentTeamId;

  return (
    <article
      className={cn(
        "rounded-[28px] border px-5 py-5 shadow-[0_18px_50px_-40px_rgba(31,42,40,0.7)]",
        isCurrentTeam
          ? "border-accent/20 bg-[linear-gradient(180deg,rgba(220,229,222,0.65)_0%,rgba(255,255,255,0.95)_100%)]"
          : "border-line bg-surface-strong",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-lg font-semibold text-foreground">{draftTeam.teamName}</p>
          <p className="mt-1 text-sm text-muted">
            로스터 {draftTeam.roster.length}명
            {isCurrentTeam ? " · 현재 차례" : ""}
          </p>
        </div>
        <span className="rounded-full bg-surface px-3 py-1 text-xs font-semibold text-muted">
          #{draftTeam.displayOrder}
        </span>
      </div>

      <div className="mt-4 rounded-2xl border border-line/80 bg-surface px-4 py-4">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">
          Picker
        </p>
        <p className="mt-2 text-sm font-semibold text-foreground">
          {draftTeam.pickerName ?? "미지정"}
        </p>
        <p className="mt-1 text-xs text-muted">
          {draftTeam.pickerUserId ? `pickerUserId ${draftTeam.pickerUserId}` : "아직 지정되지 않음"}
        </p>
      </div>

      <div className="mt-5 space-y-2">
        <p className="text-sm font-semibold text-foreground">현재 로스터</p>
        {draftTeam.roster.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-line px-4 py-4 text-sm text-muted">
            아직 지명한 선수가 없다.
          </p>
        ) : (
          draftTeam.roster.map((player) => (
            <div
              key={`${draftTeam.id}-${player.pickNo}`}
              className="rounded-2xl bg-surface-muted px-4 py-3"
            >
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-foreground">
                  {player.candidateName}
                </p>
                <span className="text-xs font-semibold text-muted">
                  {player.roundNo}R · #{player.pickNo}
                </span>
              </div>
              <p className="mt-1 text-xs text-muted">
                {player.pickedByUserName} · {formatDateTime(player.pickedAt)}
              </p>
            </div>
          ))
        )}
      </div>
    </article>
  );
}

function CandidateCard({
  canPick,
  candidate,
  pendingAction,
  onPick,
}: {
  canPick: boolean;
  candidate: DraftCandidate;
  pendingAction: string | null;
  onPick: (candidateUserId: number, candidateName: string) => Promise<void>;
}) {
  const actionKey = `pick-${candidate.candidateUserId}`;

  return (
    <article className="rounded-[24px] border border-line bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(236,239,232,0.78)_100%)] px-5 py-5 shadow-[0_18px_46px_-38px_rgba(31,42,40,0.8)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-lg font-semibold text-foreground">
            {candidate.candidateName}
          </p>
          <p className="mt-1 text-sm text-muted">
            {candidate.race || "종족 미정"} · ID {candidate.candidateUserId}
          </p>
        </div>
        <span className="rounded-full bg-surface px-3 py-1 text-xs font-semibold text-muted">
          대기
        </span>
      </div>

      <div className="mt-5 flex items-center justify-between gap-3">
        <p className="text-sm text-muted">
          현재 픽 권한이 있으면 바로 로스터에 반영된다.
        </p>
        <Button
          variant="accent"
          disabled={!canPick || pendingAction !== null}
          onClick={() => {
            void onPick(candidate.candidateUserId, candidate.candidateName);
          }}
          className="min-w-24"
        >
          {pendingAction === actionKey ? "지명 중" : "지명"}
        </Button>
      </div>
    </article>
  );
}

type DraftLiveDashboardProps = {
  refreshSignal?: number;
};

export function DraftLiveDashboard({
  refreshSignal = 0,
}: DraftLiveDashboardProps) {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<DraftSessionSummary[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(null);
  const [snapshot, setSnapshot] = useState<DraftLiveSnapshot | null>(null);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [loadingSnapshot, setLoadingSnapshot] = useState(false);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [notice, setNotice] = useState<NoticeState | null>(null);
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [resumeSeconds, setResumeSeconds] = useState("30");
  const [extendSeconds, setExtendSeconds] = useState("30");
  const [connectionState, setConnectionState] =
    useState<ConnectionState>("disconnected");
  const [serverOffsetMs, setServerOffsetMs] = useState(0);
  const [nowTickMs, setNowTickMs] = useState(() => Date.now());
  const sessionsRequestRef = useRef(0);
  const snapshotRequestRef = useRef(0);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNowTickMs(Date.now());
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, [refreshSignal]);

  useEffect(() => {
    let cancelled = false;
    const requestId = sessionsRequestRef.current + 1;
    sessionsRequestRef.current = requestId;

    async function loadSessions() {
      try {
        const nextSessions = sortSessions(await listDraftSessions());

        if (cancelled || sessionsRequestRef.current !== requestId) {
          return;
        }

        startTransition(() => {
          setSessions(nextSessions);
          setSelectedSessionId((currentSessionId) => {
            if (nextSessions.length === 0) {
              return null;
            }

            if (currentSessionId !== null) {
              const stillExists = nextSessions.some(
                (session) => session.id === currentSessionId,
              );

              if (stillExists) {
                return currentSessionId;
              }
            }

            return chooseInitialSessionId(nextSessions);
          });
        });

        if (nextSessions.length === 0) {
          setNotice({
            tone: "neutral",
            text: "등록된 드래프트 세션이 없다. 관리자 콘솔에서 먼저 세션을 만들어 달라.",
          });
        }
      } catch (error) {
        if (cancelled || sessionsRequestRef.current !== requestId) {
          return;
        }

        setNotice({
          tone: "error",
          text: readErrorMessage(error),
        });
      } finally {
        if (!cancelled && sessionsRequestRef.current === requestId) {
          setLoadingSessions(false);
        }
      }
    }

    void loadSessions();

    return () => {
      cancelled = true;
    };
  }, [refreshSignal]);

  useEffect(() => {
    if (selectedSessionId === null) {
      startTransition(() => {
        setSnapshot(null);
      });
      return;
    }

    const sessionId = selectedSessionId;
    let cancelled = false;
    const requestId = snapshotRequestRef.current + 1;
    snapshotRequestRef.current = requestId;
    startTransition(() => {
      setLoadingSnapshot(true);
    });

    async function loadSnapshot() {
      try {
        const nextSnapshot = await getDraftSnapshot(sessionId);

        if (cancelled || snapshotRequestRef.current !== requestId) {
          return;
        }

        startTransition(() => {
          setSnapshot(nextSnapshot);
          setServerOffsetMs(readServerOffsetMs(nextSnapshot.session.serverNow));
          setSessions((currentSessions) =>
            mergeSessionSummary(currentSessions, nextSnapshot.session),
          );
        });
      } catch (error) {
        if (cancelled || snapshotRequestRef.current !== requestId) {
          return;
        }

        setNotice({
          tone: "error",
          text: readErrorMessage(error),
        });
      } finally {
        if (!cancelled && snapshotRequestRef.current === requestId) {
          setLoadingSnapshot(false);
        }
      }
    }

    void loadSnapshot();

    return () => {
      cancelled = true;
    };
  }, [selectedSessionId, refreshSignal]);

  useEffect(() => {
    if (selectedSessionId === null) {
      return;
    }

    const sessionId = selectedSessionId;
    let disposed = false;

    const unsubscribe = subscribeToDraftSession({
      sessionId,
      onStateChange: (state) => {
        setConnectionState(state);
      },
      onError: (message) => {
        setNotice({
          tone: "error",
          text: message,
        });
      },
      onEvent: (event) => {
        if (event.snapshot) {
          const broadcastSnapshot = event.snapshot;

          startTransition(() => {
            setSnapshot((currentSnapshot) => ({
              ...broadcastSnapshot,
              permissions:
                broadcastSnapshot.permissions ?? currentSnapshot?.permissions ?? null,
            }));
            setServerOffsetMs(readServerOffsetMs(broadcastSnapshot.session.serverNow));
            setSessions((currentSessions) =>
              mergeSessionSummary(currentSessions, broadcastSnapshot.session),
            );
          });

          void getDraftSnapshot(sessionId)
            .then((nextSnapshot) => {
              if (disposed) {
                return;
              }

              startTransition(() => {
                setSnapshot(nextSnapshot);
                setServerOffsetMs(readServerOffsetMs(nextSnapshot.session.serverNow));
                setSessions((currentSessions) =>
                  mergeSessionSummary(currentSessions, nextSnapshot.session),
                );
              });
            })
            .catch(() => {
              if (disposed) {
                return;
              }

              setNotice({
                tone: "error",
                text: "이벤트 수신 후 최신 스냅샷을 다시 불러오지 못했다.",
              });
            });
        }

        if (event.message) {
          setNotice({
            tone: "success",
            text: event.message,
          });
        }
      },
    });

    return () => {
      disposed = true;
      unsubscribe();
    };
  }, [selectedSessionId]);

  async function runSnapshotAction(
    actionKey: string,
    request: () => Promise<DraftLiveSnapshot>,
    successText: string,
  ) {
    setPendingAction(actionKey);
    setNotice(null);

    try {
      const nextSnapshot = await request();

      startTransition(() => {
        setSnapshot(nextSnapshot);
        setServerOffsetMs(readServerOffsetMs(nextSnapshot.session.serverNow));
        setSessions((currentSessions) =>
          mergeSessionSummary(currentSessions, nextSnapshot.session),
        );
      });
      setNotice({
        tone: "success",
        text: successText,
      });
    } catch (error) {
      setNotice({
        tone: "error",
        text: readErrorMessage(error),
      });
    } finally {
      setPendingAction(null);
    }
  }

  async function handlePick(candidateUserId: number, candidateName: string) {
    if (selectedSessionId === null) {
      return;
    }

    const sessionId = selectedSessionId;
    await runSnapshotAction(
      `pick-${candidateUserId}`,
      () => pickDraftCandidate(sessionId, candidateUserId),
      `${candidateName} 지명을 반영했다.`,
    );
  }

  const filteredCandidates = snapshot?.availableCandidates.filter((candidate) => {
    const keyword = deferredSearch.trim().toLowerCase();

    if (!keyword) {
      return true;
    }

    const haystacks = [
      candidate.candidateName,
      candidate.race ?? "",
      String(candidate.candidateUserId),
    ];

    return haystacks.some((value) => value.toLowerCase().includes(keyword));
  }) ?? [];

  const teams = sortTeams(snapshot?.teams ?? []);
  const totalCandidates =
    (snapshot?.availableCandidates.length ?? 0) +
    (snapshot?.pickedCandidates.length ?? 0);
  const currentTeamId =
    snapshot?.session.currentDraftTeamId ?? snapshot?.currentTurn?.teamId ?? null;
  const currentTeam = teams.find((team) => team.id === currentTeamId) ?? null;
  const myTeam = teams.find((team) => team.id === snapshot?.permissions?.myTeamId) ?? null;
  const canControl = snapshot?.permissions?.canControl ?? false;
  const canPick = snapshot?.permissions?.canPick ?? false;
  const isBusy = pendingAction !== null;
  const remainingSeconds = calculateRemainingSeconds(
    snapshot,
    nowTickMs,
    serverOffsetMs,
  );

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
      <SurfaceCard className="p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-semibold",
                  getStatusBadgeClassName(snapshot?.session.status),
                )}
              >
                {snapshot ? formatDraftStatus(snapshot.session.status) : "세션 선택 대기"}
              </span>
              <span className="rounded-full bg-surface-muted px-3 py-1 text-xs text-muted">
                {CONNECTION_LABELS[connectionState]}
              </span>
            </div>
            <h2 className="mt-4 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              {snapshot?.currentTurn
                ? `${snapshot.currentTurn.roundNo}라운드 · ${snapshot.currentTurn.teamName} 차례`
                : "진행 중인 차례 없음"}
            </h2>
            <p className="mt-3 text-sm leading-7 text-muted">
              서버 시간 {formatDateTime(snapshot?.session.serverNow)}
              {snapshot?.session.deadlineAt
                ? ` · 마감 ${formatDateTime(snapshot.session.deadlineAt)}`
                : ""}
            </p>
          </div>

          <div className="w-full max-w-sm space-y-3">
            <select
              className="w-full rounded-[20px] border border-line bg-surface px-4 py-3 text-sm text-foreground outline-none transition-colors focus:border-accent-soft focus:bg-white"
              value={selectedSessionId ?? ""}
              onChange={(event) => {
                const nextSessionId = event.target.value
                  ? Number(event.target.value)
                  : null;
                setSelectedSessionId(nextSessionId);
              }}
            >
              {loadingSessions && sessions.length === 0 ? (
                <option value="">세션 목록 불러오는 중</option>
              ) : sessions.length === 0 ? (
                <option value="">세션 없음</option>
              ) : null}

              {sessions.map((session) => (
                <option key={session.id} value={session.id}>
                  {session.title} · {formatDraftStatus(session.status)}
                </option>
              ))}
            </select>

            <div className="rounded-[24px] border border-line/70 bg-white/70 px-5 py-4 text-right">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
                Remaining
              </p>
              <p className="mt-2 text-4xl font-semibold tracking-tight text-foreground">
                {formatCountdown(remainingSeconds)}
              </p>
              <p className="mt-2 text-sm text-muted">
                {currentTeam ? `${currentTeam.teamName} 응답 대기` : "대기 중"}
              </p>
            </div>
          </div>
        </div>

        {notice ? (
          <div className={cn("mt-6 rounded-[24px] px-4 py-4 text-sm", getToneClassName(notice.tone))}>
            {notice.text}
          </div>
        ) : null}

        {selectedSessionId !== null ? (
          <div className="mt-6 space-y-5">
            <section className="rounded-[30px] border border-line bg-[radial-gradient(circle_at_top_right,rgba(220,229,222,0.84),transparent_42%),linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(238,241,236,0.9)_100%)] p-6 shadow-[0_24px_60px_-48px_rgba(31,42,40,0.72)]">
              {loadingSnapshot && !snapshot ? (
                <div className="space-y-3">
                  <div className="h-5 w-40 rounded-full bg-surface-muted" />
                  <div className="h-10 w-72 rounded-full bg-surface-muted" />
                  <div className="h-24 rounded-[24px] bg-surface-muted" />
                </div>
              ) : snapshot ? (
                <>
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    {[
                      {
                        label: "진행률",
                        value: `${snapshot.pickedCandidates.length}/${totalCandidates}`,
                        subtext: "완료 / 전체 후보",
                      },
                      {
                        label: "현재 픽",
                        value: snapshot.session.currentPickNo ?? "-",
                        subtext: snapshot.currentTurn
                          ? `라운드 ${snapshot.currentTurn.roundNo}`
                          : "시작 대기",
                      },
                      {
                        label: "픽 권한",
                        value: canPick
                          ? "지명 가능"
                          : canControl
                            ? "관리 가능"
                            : "관전",
                        subtext:
                          snapshot.permissions?.myRole === "PICKER"
                            ? "PICKER"
                            : "권한 없음",
                      },
                      {
                        label: "내 팀",
                        value: myTeam?.teamName ?? "-",
                        subtext: user?.username ? `${user.username}` : "로그인 사용자",
                      },
                    ].map((stat) => (
                      <div
                        key={stat.label}
                        className="rounded-[24px] border border-line bg-white/70 px-4 py-4"
                      >
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">
                          {stat.label}
                        </p>
                        <p className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
                          {stat.value}
                        </p>
                        <p className="mt-1 text-sm text-muted">{stat.subtext}</p>
                      </div>
                    ))}
                  </div>
                </>
              ) : null}
            </section>

            <section className="rounded-[28px] border border-line bg-surface-strong px-5 py-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold text-foreground">후보 풀</h2>
                  <p className="mt-2 text-sm leading-7 text-muted">
                    후보를 검색하고 현재 픽 권한이 있으면 바로 지명할 수 있다.
                  </p>
                </div>

                <div className="w-full max-w-xs">
                  <Input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="이름, 종족, ID 검색"
                  />
                </div>
              </div>

              <div className="mt-5 grid gap-4 lg:grid-cols-2">
                {filteredCandidates.length === 0 ? (
                  <div className="rounded-[24px] border border-dashed border-line px-5 py-10 text-center text-sm leading-7 text-muted lg:col-span-2">
                    {snapshot && snapshot.availableCandidates.length === 0
                      ? "남아 있는 후보가 없다."
                      : "검색 조건에 맞는 후보가 없다."}
                  </div>
                ) : (
                  filteredCandidates.map((candidate) => (
                    <CandidateCard
                      key={candidate.candidateUserId}
                      canPick={canPick}
                      candidate={candidate}
                      pendingAction={pendingAction}
                      onPick={handlePick}
                    />
                  ))
                )}
              </div>
            </section>

            <section className="rounded-[28px] border border-line bg-surface-strong px-5 py-5">
              <div>
                <h2 className="text-xl font-semibold text-foreground">팀 보드</h2>
                <p className="mt-2 text-sm leading-7 text-muted">
                  각 팀의 현재 픽커와 로스터를 한 번에 확인할 수 있다.
                </p>
              </div>

              <div className="mt-5 grid gap-4 xl:grid-cols-2">
                {teams.map((team) => (
                  <TeamCard
                    key={team.id}
                    currentTeamId={currentTeamId}
                    draftTeam={team}
                  />
                ))}
              </div>
            </section>
          </div>
        ) : null}
      </SurfaceCard>

      <div className="grid gap-4">
        <SurfaceCard className="p-6">
          <p className="text-sm font-semibold text-foreground">운영 정보</p>
          <p className="mt-3 text-sm leading-7 text-muted">
            관리자는 세션 제어를, 픽커는 실제 지명을 담당한다.
          </p>

          {snapshot ? (
            <div className="mt-5 space-y-4">
              <div className="rounded-[22px] bg-surface-muted px-4 py-4">
                <p className="text-sm font-semibold text-foreground">
                  {user?.username ?? "로그인 사용자"}
                </p>
                <p className="mt-1 text-sm text-muted">
                  계정 권한: {formatUserRole(user?.role)}
                </p>
                <p className="mt-1 text-sm text-muted">
                  드래프트 권한: {formatMyRole(snapshot.permissions?.myRole)}
                </p>
                <p className="mt-1 text-sm text-muted">
                  {myTeam?.teamName ?? "소속 팀 없음"}
                </p>
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                <Button
                  variant="accent"
                  disabled={!canControl || isBusy || snapshot.session.status !== "READY"}
                  onClick={() => {
                    const sessionId = selectedSessionId;

                    if (sessionId === null) {
                      return;
                    }

                    void runSnapshotAction(
                      "start",
                      () => startDraftSession(sessionId),
                      "드래프트를 시작했다.",
                    );
                  }}
                >
                  {pendingAction === "start" ? "시작 중" : "시작"}
                </Button>

                <Button
                  disabled={!canControl || isBusy || snapshot.session.status !== "LIVE"}
                  onClick={() => {
                    const sessionId = selectedSessionId;

                    if (sessionId === null) {
                      return;
                    }

                    void runSnapshotAction(
                      "pause",
                      () => pauseDraftSession(sessionId),
                      "드래프트를 일시정지했다.",
                    );
                  }}
                >
                  {pendingAction === "pause" ? "정지 중" : "일시정지"}
                </Button>
              </div>

              <div className="rounded-[22px] border border-line bg-surface px-4 py-4">
                <p className="text-sm font-semibold text-foreground">재개 시간</p>
                <div className="mt-3 flex gap-2">
                  <Input
                    type="number"
                    min={1}
                    value={resumeSeconds}
                    onChange={(event) => setResumeSeconds(event.target.value)}
                    placeholder="기본 30"
                  />
                  <Button
                    variant="accent"
                    disabled={!canControl || isBusy || snapshot.session.status !== "PAUSED"}
                    onClick={() => {
                      const sessionId = selectedSessionId;

                      if (sessionId === null) {
                        return;
                      }

                      try {
                        const seconds = parsePositiveSeconds(
                          resumeSeconds,
                          snapshot.session.pickTimeSeconds,
                        );

                        void runSnapshotAction(
                          "resume",
                          () => resumeDraftSession(sessionId, seconds),
                          `${seconds}초로 드래프트를 재개했다.`,
                        );
                      } catch (error) {
                        setNotice({
                          tone: "error",
                          text: readErrorMessage(error),
                        });
                      }
                    }}
                  >
                    {pendingAction === "resume" ? "재개 중" : "재개"}
                  </Button>
                </div>
              </div>

              <div className="rounded-[22px] border border-line bg-surface px-4 py-4">
                <p className="text-sm font-semibold text-foreground">현재 턴 연장</p>
                <div className="mt-3 flex gap-2">
                  <Input
                    type="number"
                    min={1}
                    value={extendSeconds}
                    onChange={(event) => setExtendSeconds(event.target.value)}
                    placeholder="30"
                  />
                  <Button
                    disabled={!canControl || isBusy || snapshot.session.status !== "LIVE"}
                    onClick={() => {
                      const sessionId = selectedSessionId;

                      if (sessionId === null) {
                        return;
                      }

                      try {
                        const seconds = parsePositiveSeconds(extendSeconds);

                        void runSnapshotAction(
                          "extend",
                          () => extendDraftTurn(sessionId, seconds),
                          `${seconds}초 연장했다.`,
                        );
                      } catch (error) {
                        setNotice({
                          tone: "error",
                          text: readErrorMessage(error),
                        });
                      }
                    }}
                  >
                    {pendingAction === "extend" ? "연장 중" : "연장"}
                  </Button>
                </div>
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                <Button
                  variant="danger"
                  disabled={!canControl || isBusy || snapshot.session.status !== "LIVE"}
                  onClick={() => {
                    const sessionId = selectedSessionId;

                    if (sessionId === null) {
                      return;
                    }

                    void runSnapshotAction(
                      "skip",
                      () => skipDraftTurn(sessionId, "manual"),
                      "현재 턴을 스킵했다.",
                    );
                  }}
                >
                  {pendingAction === "skip" ? "스킵 중" : "강제 스킵"}
                </Button>

                <Button
                  variant="danger"
                  disabled={!canControl || isBusy || snapshot.session.status === "FINISHED"}
                  onClick={() => {
                    const sessionId = selectedSessionId;

                    if (sessionId === null) {
                      return;
                    }

                    void runSnapshotAction(
                      "finish",
                      () => finishDraftSession(sessionId, "manual-finish"),
                      "드래프트를 종료했다.",
                    );
                  }}
                >
                  {pendingAction === "finish" ? "종료 중" : "세션 종료"}
                </Button>
              </div>

              {!canControl ? (
                <p className="rounded-[18px] bg-surface-muted px-4 py-3 text-sm leading-7 text-muted">
                  이 계정은 세션 제어 권한이 없다. `ROLE_MASTER`, `ROLE_MANAGER`,
                  `ROLE_ADMIN` 계정만 사용할 수 있다.
                </p>
              ) : null}
            </div>
          ) : (
            <p className="mt-4 text-sm leading-7 text-muted">
              세션을 선택하면 운영 정보가 표시된다.
            </p>
          )}
        </SurfaceCard>

        <SurfaceCard className="p-6">
          <p className="text-sm font-semibold text-foreground">최근 지명</p>
          <div className="mt-4 space-y-3">
            {snapshot?.recentPicks?.length ? (
              snapshot.recentPicks.slice(0, 8).map((pick) => (
                <div
                  key={`${pick.draftSessionId}-${pick.pickNo}`}
                  className="rounded-[22px] bg-surface-muted px-4 py-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-foreground">
                      {pick.candidateName}
                    </p>
                    <span className="text-xs font-semibold text-muted">
                      {pick.roundNo}R · #{pick.pickNo}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-muted">
                    {pick.draftTeamName} · {pick.pickedByUserName}
                  </p>
                  <p className="mt-1 text-xs text-muted">
                    {formatDateTime(pick.pickedAt)}
                  </p>
                </div>
              ))
            ) : (
              <p className="rounded-[22px] border border-dashed border-line px-4 py-6 text-sm text-muted">
                아직 기록된 지명이 없다.
              </p>
            )}
          </div>
        </SurfaceCard>

        <SurfaceCard className="p-6">
          <p className="text-sm font-semibold text-foreground">현재 상태</p>
          <div className="mt-4 space-y-3">
            <div className="rounded-[22px] bg-surface-muted px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">
                Current Team
              </p>
              <p className="mt-2 text-lg font-semibold text-foreground">
                {currentTeam?.teamName ?? "-"}
              </p>
              <p className="mt-1 text-sm text-muted">
                {snapshot?.currentTurn
                  ? `${snapshot.currentTurn.roundNo}라운드 · ${snapshot.currentTurn.pickNo}번째 픽`
                  : "대기 중"}
              </p>
            </div>

            <div className="rounded-[22px] bg-surface-muted px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">
                Current Picker
              </p>
              <p className="mt-2 text-lg font-semibold text-foreground">
                {currentTeam?.pickerName ?? "-"}
              </p>
              <p className="mt-1 text-sm text-muted">
                {currentTeam?.pickerUserId
                  ? `pickerUserId ${currentTeam.pickerUserId}`
                  : "미지정"}
              </p>
            </div>

            <div className="rounded-[22px] bg-surface-muted px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">
                Available / Picked
              </p>
              <p className="mt-2 text-lg font-semibold text-foreground">
                {snapshot?.availableCandidates.length ?? 0} /{" "}
                {snapshot?.pickedCandidates.length ?? 0}
              </p>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-white">
                <div
                  className="h-full rounded-full bg-accent transition-[width]"
                  style={{
                    width:
                      totalCandidates > 0
                        ? `${((snapshot?.pickedCandidates.length ?? 0) / totalCandidates) * 100}%`
                        : "0%",
                  }}
                />
              </div>
            </div>
          </div>
        </SurfaceCard>
      </div>
    </div>
  );
}
