"use client";

import { startTransition, useEffect, useState } from "react";
import {
  getDraftErrorDebugInfo,
  getDraftSessionDetail,
  isDraftApiError,
  listDraftSessions,
  type DraftCandidate,
  type DraftPick,
  type DraftSessionDetail,
  type DraftSessionSummary,
} from "@/lib/api/draft";
import { SurfaceCard } from "@/components/site/surface-card";
import { cn } from "@/lib/utils";

type NoticeTone = "error" | "neutral";

type NoticeState = {
  tone: NoticeTone;
  text: string;
};

const SELECT_CLASS_NAME =
  "w-full rounded-2xl border border-line bg-surface-strong px-3 py-2 text-sm text-foreground outline-none transition-colors focus:border-accent-soft focus:bg-white disabled:cursor-not-allowed disabled:opacity-70";

function readErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return "요청을 처리하지 못했다. 잠시 후 다시 시도해.";
}

function isMissingSessionError(error: unknown) {
  if (!isDraftApiError(error)) {
    return false;
  }

  const status = error.info.responseStatus ?? error.info.httpStatus;
  return status === 404;
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
  if (tone === "error") {
    return "border border-danger-ink/15 bg-danger-soft text-danger-ink";
  }

  return "border border-line bg-surface-muted text-foreground";
}

function sortHistoricalSessions(sessions: DraftSessionSummary[]) {
  return sessions
    .filter((session) => session.status === "FINISHED")
    .sort((left, right) => right.id - left.id);
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

function findCandidate(
  candidates: DraftCandidate[],
  candidateUserId: number,
) {
  return (
    candidates.find((candidate) => candidate.candidateUserId === candidateUserId) ?? null
  );
}

export function DraftHistoryConsole() {
  const [sessions, setSessions] = useState<DraftSessionSummary[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(null);
  const [selectedSessionDetail, setSelectedSessionDetail] =
    useState<DraftSessionDetail | null>(null);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [notice, setNotice] = useState<NoticeState | null>(null);

  const sortedPicks = selectedSessionDetail ? sortPicks(selectedSessionDetail.picks) : [];

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      setLoadingSessions(true);

      try {
        const nextSessions = sortHistoricalSessions(await listDraftSessions());

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

        logDraftHistoryIssue("드래프트 목록 초기 로드", error);
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

        if (isMissingSessionError(error)) {
          const nextSessions = sortHistoricalSessions(await listDraftSessions()).filter(
            (session) => session.id !== sessionId,
          );
          const nextSelectedSessionId = chooseSessionId(nextSessions, null, null);

          startTransition(() => {
            setSessions(nextSessions);
            setSelectedSessionId(nextSelectedSessionId);
            setSelectedSessionDetail(null);
          });

          setNotice({
            tone: "neutral",
            text: "보던 드래프트가 없어져서 목록에서 제외했다.",
          });
          return;
        }

        logDraftHistoryIssue("드래프트 상세 로드", error, { sessionId });
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

  return (
    <div className="space-y-3">
      <SurfaceCard className="p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-foreground">드래프트 이력</p>
            <p className="mt-1 truncate text-xs text-muted">
              {selectedSessionDetail?.title ?? "종료된 드래프트를 선택해."}
            </p>
          </div>

          <div className="w-full sm:w-80">
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
              <option value="">
                {loadingSessions
                  ? "드래프트 목록 불러오는 중"
                  : sessions.length === 0
                    ? "종료된 드래프트 없음"
                    : "드래프트 선택"}
              </option>
              {sessions.map((session) => (
                <option key={session.id} value={session.id}>
                  {session.title}
                </option>
              ))}
            </select>
          </div>
        </div>

        {notice ? (
          <div
            className={cn(
              "mt-3 rounded-2xl px-3 py-2 text-xs",
              getNoticeClassName(notice.tone),
            )}
          >
            {notice.text}
          </div>
        ) : null}
      </SurfaceCard>

      <SurfaceCard className="p-4">
        {loadingDetail ? (
          <div className="rounded-2xl border border-dashed border-line px-4 py-8 text-center text-sm text-muted">
            이력 불러오는 중
          </div>
        ) : !selectedSessionDetail ? (
          <div className="rounded-2xl border border-dashed border-line px-4 py-8 text-center text-sm text-muted">
            드래프트를 선택해.
          </div>
        ) : sortedPicks.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-line px-4 py-8 text-center text-sm text-muted">
            기록이 없다.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <div className="min-w-[520px] space-y-2">
              <div className="grid grid-cols-[60px_minmax(0,1fr)_110px_70px_70px] items-center gap-2 rounded-xl border border-line bg-surface-muted px-3 py-2 text-[11px] font-semibold text-muted">
                <span>순서</span>
                <span>팀</span>
                <span>user_id</span>
                <span>티어</span>
                <span>종족</span>
              </div>

              {sortedPicks.map((pick) => {
                const candidate = findCandidate(
                  selectedSessionDetail.candidates,
                  pick.candidateUserId,
                );

                return (
                  <div
                    key={pick.pickNo}
                    className="grid grid-cols-[60px_minmax(0,1fr)_110px_70px_70px] items-center gap-2 rounded-xl border border-line bg-surface-strong px-3 py-2 text-xs text-foreground"
                  >
                    <span className="font-semibold">{pick.pickNo}</span>
                    <span className="truncate">{pick.draftTeamName}</span>
                    <span className="truncate">{pick.candidateUserId}</span>
                    <span className="truncate">{candidate?.tier ?? "-"}</span>
                    <span className="truncate">{candidate?.race ?? "-"}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </SurfaceCard>
    </div>
  );
}
