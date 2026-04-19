"use client";

import Link from "next/link";
import { startTransition, useEffect, useState } from "react";
import {
  deleteDraftPick,
  getDraftErrorDebugInfo,
  getDraftSessionDetail,
  listDraftSessions,
  type DraftPick,
  type DraftSessionDetail,
  type DraftSessionSummary,
} from "@/lib/api/draft";
import { SurfaceCard } from "@/components/site/surface-card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type NoticeTone = "error" | "neutral" | "success";

type NoticeState = {
  tone: NoticeTone;
  text: string;
};

const SESSION_STATUS_LABELS: Record<string, string> = {
  READY: "준비",
  LIVE: "진행 중",
  PAUSED: "일시정지",
  FINISHED: "종료",
  CANCELLED: "취소",
};

const SELECT_CLASS_NAME =
  "w-full rounded-2xl border border-line bg-surface-strong px-4 py-3 text-sm text-foreground outline-none transition-colors focus:border-accent-soft focus:bg-white disabled:cursor-not-allowed disabled:opacity-70";

function readErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return "요청을 처리하지 못했다. 잠시 후 다시 시도해라.";
}

function logDraftHistoryIssue(
  action: string,
  error: unknown,
  context?: Record<string, unknown>,
) {
  const message = readErrorMessage(error);

  console.groupCollapsed(`[Draft History] ${action} 실패: ${message}`);

  if (context) {
    console.log("context", context);
  }

  console.error("detail", getDraftErrorDebugInfo(error));
  console.groupEnd();
}

function getNoticeClassName(tone: NoticeTone) {
  if (tone === "success") {
    return "border border-success-ink/15 bg-success-soft text-success-ink";
  }

  if (tone === "error") {
    return "border border-danger-ink/15 bg-danger-soft text-danger-ink";
  }

  return "border border-line bg-surface-muted text-foreground";
}

function formatDateTime(value: string | null | undefined) {
  if (!value) {
    return "-";
  }

  const timestamp = Date.parse(value);

  if (Number.isNaN(timestamp)) {
    return value;
  }

  return new Intl.DateTimeFormat("ko-KR", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(timestamp);
}

function formatSessionStatus(status: string | null | undefined) {
  if (!status) {
    return "미정";
  }

  return SESSION_STATUS_LABELS[status] ?? status;
}

function sortSessions(sessions: DraftSessionSummary[]) {
  const priority = new Map([
    ["LIVE", 0],
    ["PAUSED", 1],
    ["READY", 2],
    ["FINISHED", 3],
    ["CANCELLED", 4],
  ]);

  return [...sessions].sort((left, right) => {
    const leftPriority = priority.get(left.status) ?? 99;
    const rightPriority = priority.get(right.status) ?? 99;

    if (leftPriority !== rightPriority) {
      return leftPriority - rightPriority;
    }

    return right.id - left.id;
  });
}

function sortPicks(picks: DraftPick[]) {
  return [...picks].sort((left, right) => left.pickNo - right.pickNo);
}

function chooseSessionId(
  sessions: DraftSessionSummary[],
  preferredSessionId: number | null | undefined,
  currentSessionId: number | null,
) {
  if (
    typeof preferredSessionId === "number" &&
    sessions.some((session) => session.id === preferredSessionId)
  ) {
    return preferredSessionId;
  }

  if (
    typeof currentSessionId === "number" &&
    sessions.some((session) => session.id === currentSessionId)
  ) {
    return currentSessionId;
  }

  return sessions[0]?.id ?? null;
}

function PickHistoryRow({
  pendingAction,
  pick,
  onDelete,
}: {
  pendingAction: string | null;
  pick: DraftPick;
  onDelete: () => Promise<void>;
}) {
  const isDeleting = pendingAction === `pick-delete:${pick.pickNo}`;

  return (
    <div className="rounded-[24px] border border-line bg-surface-strong px-4 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-foreground">
            {pick.roundNo}R · #{pick.pickNo} · {pick.candidateName}
          </p>
          <p className="mt-1 text-xs text-muted">
            {pick.draftTeamName} · pickedBy {pick.pickedByUserName} ·{" "}
            {formatDateTime(pick.pickedAt)}
          </p>
        </div>
        <Button
          size="sm"
          variant="danger"
          disabled={pendingAction !== null}
          onClick={() => {
            void onDelete();
          }}
        >
          {isDeleting ? "삭제 중" : "기록 삭제"}
        </Button>
      </div>
    </div>
  );
}

export function DraftHistoryConsole() {
  const [sessions, setSessions] = useState<DraftSessionSummary[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(null);
  const [selectedSessionDetail, setSelectedSessionDetail] =
    useState<DraftSessionDetail | null>(null);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [notice, setNotice] = useState<NoticeState | null>(null);

  const sortedPicks = selectedSessionDetail ? sortPicks(selectedSessionDetail.picks) : [];
  const latestPick = sortedPicks.at(-1) ?? null;

  async function refreshSelectedSession(sessionId: number) {
    const [nextSessions, detail] = await Promise.all([
      listDraftSessions(),
      getDraftSessionDetail(sessionId),
    ]);

    startTransition(() => {
      setSessions(sortSessions(nextSessions));
      setSelectedSessionId(sessionId);
    });

    setSelectedSessionDetail(detail);

    return detail;
  }

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      setLoadingSessions(true);

      try {
        const nextSessions = sortSessions(await listDraftSessions());

        if (cancelled) {
          return;
        }

        const nextSelectedSessionId = chooseSessionId(nextSessions, null, null);

        startTransition(() => {
          setSessions(nextSessions);
          setSelectedSessionId(nextSelectedSessionId);
        });

        if (nextSelectedSessionId === null) {
          setSelectedSessionDetail(null);
        }
      } catch (error) {
        if (cancelled) {
          return;
        }

        logDraftHistoryIssue("세션 목록 초기 로드", error);
        setNotice({
          tone: "error",
          text: readErrorMessage(error),
        });
      } finally {
        if (!cancelled) {
          setLoadingSessions(false);
        }
      }
    }

    void bootstrap();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (selectedSessionId === null) {
      return;
    }

    const sessionId = selectedSessionId;
    let cancelled = false;

    async function loadDetail() {
      setLoadingDetail(true);

      try {
        const detail = await getDraftSessionDetail(sessionId);

        if (cancelled) {
          return;
        }

        setSelectedSessionDetail(detail);
      } catch (error) {
        if (cancelled) {
          return;
        }

        logDraftHistoryIssue("세션 상세 로드", error, { sessionId });
        setNotice({
          tone: "error",
          text: readErrorMessage(error),
        });
      } finally {
        if (!cancelled) {
          setLoadingDetail(false);
        }
      }
    }

    void loadDetail();

    return () => {
      cancelled = true;
    };
  }, [selectedSessionId]);

  async function handleDeletePick(pickNo: number) {
    if (selectedSessionId === null) {
      return;
    }

    setPendingAction(`pick-delete:${pickNo}`);
    setNotice(null);

    try {
      await deleteDraftPick(selectedSessionId, pickNo);
      await refreshSelectedSession(selectedSessionId);
      setNotice({
        tone: "success",
        text: "픽 기록을 삭제했다. 필요하면 관리 탭에서 후보와 순서를 다시 맞추면 된다.",
      });
    } catch (error) {
      logDraftHistoryIssue("픽 기록 삭제", error, {
        pickNo,
        sessionId: selectedSessionId,
      });
      setNotice({
        tone: "error",
        text: readErrorMessage(error),
      });
    } finally {
      setPendingAction(null);
    }
  }

  return (
    <div className="space-y-4">
      <SurfaceCard className="p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-foreground">드래프트 이력 정리</p>
            <p className="mt-2 max-w-3xl text-sm leading-7 text-muted">
              잘못 들어간 픽 기록을 여기서 정리하고, 삭제 직후 같은 세션 상세를 다시 읽어서
              상태를 바로 맞춘다. 후보와 순서 보정이 필요하면 관리 탭으로 돌아가서 이어서
              작업하면 된다.
            </p>
          </div>
          <Link
            href="/admin/draft"
            className="rounded-full border border-line px-4 py-2 text-sm text-muted transition-colors hover:border-accent-soft hover:bg-surface-strong hover:text-foreground"
          >
            관리 탭으로
          </Link>
        </div>

        {notice ? (
          <div
            className={cn(
              "mt-5 rounded-[24px] px-4 py-4 text-sm",
              getNoticeClassName(notice.tone),
            )}
          >
            {notice.text}
          </div>
        ) : null}

        <div className="mt-5 grid gap-3 md:grid-cols-3">
          <div className="rounded-[24px] border border-line bg-surface-strong px-4 py-4">
            <p className="text-sm font-semibold text-foreground">선택 세션</p>
            <p className="mt-4 text-2xl font-semibold tracking-tight text-foreground">
              {selectedSessionDetail?.title ?? "-"}
            </p>
            <p className="mt-2 text-sm text-muted">
              상태 {formatSessionStatus(selectedSessionDetail?.status)}
            </p>
          </div>
          <div className="rounded-[24px] border border-line bg-surface-strong px-4 py-4">
            <p className="text-sm font-semibold text-foreground">픽 기록 수</p>
            <p className="mt-4 text-2xl font-semibold tracking-tight text-foreground">
              {sortedPicks.length}
            </p>
            <p className="mt-2 text-sm text-muted">현재 세션에 쌓인 전체 픽 기록</p>
          </div>
          <div className="rounded-[24px] border border-line bg-surface-strong px-4 py-4">
            <p className="text-sm font-semibold text-foreground">마지막 픽</p>
            <p className="mt-4 text-lg font-semibold tracking-tight text-foreground">
              {latestPick ? `${latestPick.pickNo}번 ${latestPick.candidateName}` : "-"}
            </p>
            <p className="mt-2 text-sm text-muted">
              {latestPick ? latestPick.draftTeamName : "아직 기록 없음"}
            </p>
          </div>
        </div>
      </SurfaceCard>

      <SurfaceCard className="p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-foreground">세션별 픽 기록</p>
            <p className="mt-2 text-sm leading-7 text-muted">
              세션을 고르면 아래에 픽 기록이 시간순으로 나온다. 잘못된 기록만 골라서
              삭제하면 된다.
            </p>
          </div>

          <div className="w-full max-w-sm">
            <select
              className={SELECT_CLASS_NAME}
              disabled={loadingSessions || sessions.length === 0}
              value={selectedSessionId ?? ""}
              onChange={(event) => {
                const nextValue = event.target.value;
                setNotice(null);
                setSelectedSessionId(nextValue ? Number(nextValue) : null);

                if (!nextValue) {
                  setSelectedSessionDetail(null);
                }
              }}
            >
              <option value="">세션 선택</option>
              {sessions.map((session) => (
                <option key={session.id} value={session.id}>
                  {session.title} · {formatSessionStatus(session.status)}
                </option>
              ))}
            </select>
          </div>
        </div>

        {loadingDetail ? (
          <div className="mt-5 rounded-[24px] border border-dashed border-line px-5 py-10 text-center text-sm text-muted">
            세션 이력을 불러오는 중이다.
          </div>
        ) : !selectedSessionDetail ? (
          <div className="mt-5 rounded-[24px] border border-dashed border-line px-5 py-10 text-center text-sm text-muted">
            정리할 세션을 먼저 선택해라.
          </div>
        ) : sortedPicks.length === 0 ? (
          <div className="mt-5 rounded-[24px] border border-dashed border-line px-5 py-10 text-center text-sm text-muted">
            현재 세션에는 정리할 픽 기록이 없다.
          </div>
        ) : (
          <div className="mt-5 space-y-3">
            {sortedPicks.map((pick) => (
              <PickHistoryRow
                key={pick.pickNo}
                pick={pick}
                pendingAction={pendingAction}
                onDelete={() => handleDeletePick(pick.pickNo)}
              />
            ))}
          </div>
        )}
      </SurfaceCard>
    </div>
  );
}
