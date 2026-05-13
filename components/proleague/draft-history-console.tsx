"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  deleteDraftSessions,
  getDraftErrorDebugInfo,
  getDraftSessionDetail,
  isDraftApiError,
  listDraftSessionHistory,
  type DraftCandidate,
  type DraftHistoryPage,
  type DraftPick,
  type DraftSessionDetail,
  type DraftSessionSummary,
} from "@/lib/api/draft";
import { SurfaceCard } from "@/components/site/surface-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type NoticeTone = "error" | "neutral";

type NoticeState = {
  tone: NoticeTone;
  text: string;
};

type TeamRosterGroup = {
  id: number;
  name: string;
  picks: DraftPick[];
};

const PAGE_SIZE = 10;

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

function toTimestamp(value: string | null | undefined) {
  if (!value) {
    return 0;
  }

  const timestamp = Date.parse(value);

  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function formatDateTime(value: string | null | undefined) {
  const timestamp = toTimestamp(value);

  if (!timestamp) {
    return "-";
  }

  return new Intl.DateTimeFormat("ko-KR", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(timestamp);
}

function formatDuration(startedAt: string | null, endedAt: string | null) {
  const start = toTimestamp(startedAt);
  const end = toTimestamp(endedAt);

  if (!start || !end || end < start) {
    return null;
  }

  return `${Math.max(1, Math.round((end - start) / 60000))}분 진행`;
}

function formatOrderMode(mode: DraftSessionSummary["orderMode"]) {
  return mode === "SNAKE" ? "스네이크" : "기본 순서";
}

function sortPicks(picks: DraftPick[]) {
  return [...picks].sort((left, right) => left.pickNo - right.pickNo);
}

function formatPickCandidateLoginId(
  pick: DraftPick,
  candidate: DraftCandidate | null,
) {
  const pickLoginId = pick.candidateUserLoginId?.trim();

  if (pickLoginId) {
    return pickLoginId;
  }

  const candidateLoginId = candidate?.candidateUserLoginId?.trim();

  return candidateLoginId || "아이디 확인 필요";
}

function getPickedCount(session: DraftSessionSummary) {
  return typeof session.pickedCount === "number" ? session.pickedCount : 0;
}

function getDetailPickedCount(detail: DraftSessionDetail) {
  return detail.picks.length;
}

function buildRosterGroups(
  detail: DraftSessionDetail,
  candidateByUserId: Map<number, DraftCandidate>,
  query: string,
) {
  const normalizedQuery = query.trim().toLowerCase();
  const sortedPicks = sortPicks(detail.picks).filter((pick) => {
    if (!normalizedQuery) {
      return true;
    }

    const candidate = candidateByUserId.get(pick.candidateUserId) ?? null;
    return formatPickCandidateLoginId(pick, candidate)
      .toLowerCase()
      .includes(normalizedQuery);
  });
  const groupByTeamId = new Map<number, TeamRosterGroup>();

  detail.teams
    .slice()
    .sort((left, right) => left.displayOrder - right.displayOrder)
    .forEach((team) => {
      groupByTeamId.set(team.id, {
        id: team.id,
        name: team.teamName,
        picks: [],
      });
    });

  sortedPicks.forEach((pick) => {
    const existingGroup = groupByTeamId.get(pick.draftTeamId);

    if (existingGroup) {
      existingGroup.picks.push(pick);
      return;
    }

    groupByTeamId.set(pick.draftTeamId, {
      id: pick.draftTeamId,
      name: pick.draftTeamName,
      picks: [pick],
    });
  });

  return Array.from(groupByTeamId.values());
}

function createEmptyHistoryPage(page = 0): DraftHistoryPage {
  return {
    items: [],
    page,
    size: PAGE_SIZE,
    totalElements: 0,
    totalPages: 0,
    hasNext: false,
    hasPrevious: page > 0,
  };
}

function HistoryNotice({ notice }: { notice: NoticeState }) {
  return (
    <div
      className={cn(
        "rounded-lg px-4 py-3 text-sm leading-6",
        getNoticeClassName(notice.tone),
      )}
    >
      {notice.text}
    </div>
  );
}

export function DraftHistoryConsole() {
  const [historyPage, setHistoryPage] = useState<DraftHistoryPage>(() =>
    createEmptyHistoryPage(),
  );
  const [page, setPage] = useState(0);
  const [searchInput, setSearchInput] = useState("");
  const [keyword, setKeyword] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(() => new Set());
  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(null);
  const [selectedSessionDetail, setSelectedSessionDetail] =
    useState<DraftSessionDetail | null>(null);
  const [playerSearch, setPlayerSearch] = useState("");
  const [loadingList, setLoadingList] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [deletingSelected, setDeletingSelected] = useState(false);
  const [notice, setNotice] = useState<NoticeState | null>(null);

  const selectedCount = selectedIds.size;
  const currentItems = historyPage.items;
  const hasCurrentItems = currentItems.length > 0;
  const allCurrentSelected =
    hasCurrentItems && currentItems.every((session) => selectedIds.has(session.id));
  const currentPageLabel =
    historyPage.totalPages > 0 ? historyPage.page + 1 : 0;
  const candidateByUserId = useMemo(() => {
    const candidates = selectedSessionDetail?.candidates ?? [];
    return new Map(
      candidates.map((candidate) => [candidate.candidateUserId, candidate]),
    );
  }, [selectedSessionDetail?.candidates]);
  const rosterGroups = useMemo(() => {
    if (!selectedSessionDetail) {
      return [];
    }

    return buildRosterGroups(selectedSessionDetail, candidateByUserId, playerSearch);
  }, [candidateByUserId, playerSearch, selectedSessionDetail]);

  const loadHistoryPage = useCallback(
    async (targetPage: number) => {
      setLoadingList(true);
      setNotice(null);

      try {
        const nextPage = await listDraftSessionHistory({
          keyword,
          page: targetPage,
          size: PAGE_SIZE,
        });

        setHistoryPage(nextPage);
        setSelectedIds(new Set());
      } catch (error) {
        logDraftHistoryIssue("드래프트 이력 목록 로드", error, {
          keyword,
          page: targetPage,
        });
        setHistoryPage(createEmptyHistoryPage(targetPage));
        setSelectedIds(new Set());
        setNotice({
          tone: "error",
          text: readErrorMessage(error),
        });
      } finally {
        setLoadingList(false);
      }
    },
    [keyword],
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setPage(0);
      setKeyword(searchInput.trim());
    }, 300);

    return () => {
      window.clearTimeout(timer);
    };
  }, [searchInput]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      await Promise.resolve();

      if (!cancelled) {
        await loadHistoryPage(page);
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [loadHistoryPage, page]);

  useEffect(() => {
    if (selectedSessionId === null) {
      return;
    }

    const sessionId = selectedSessionId;
    let cancelled = false;

    async function loadDetail() {
      setLoadingDetail(true);
      setNotice(null);

      try {
        const detail = await getDraftSessionDetail(sessionId);

        if (!cancelled) {
          setSelectedSessionDetail(detail);
          setPlayerSearch("");
        }
      } catch (error) {
        if (cancelled) {
          return;
        }

        if (isMissingSessionError(error)) {
          setSelectedSessionId(null);
          setSelectedSessionDetail(null);
          setNotice({
            tone: "neutral",
            text: "보던 드래프트가 없어져서 목록에서 제외했다.",
          });
          await loadHistoryPage(page);
          return;
        }

        logDraftHistoryIssue("드래프트 상세 로드", error, { sessionId });
        setSelectedSessionDetail(null);
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
  }, [loadHistoryPage, page, selectedSessionId]);

  function toggleSession(sessionId: number) {
    setSelectedIds((current) => {
      const next = new Set(current);

      if (next.has(sessionId)) {
        next.delete(sessionId);
      } else {
        next.add(sessionId);
      }

      return next;
    });
  }

  function selectSession(sessionId: number) {
    setSelectedSessionDetail(null);
    setPlayerSearch("");
    setSelectedSessionId(sessionId);
  }

  function toggleCurrentPage() {
    setSelectedIds((current) => {
      if (allCurrentSelected) {
        return new Set(
          [...current].filter(
            (sessionId) => !currentItems.some((session) => session.id === sessionId),
          ),
        );
      }

      const next = new Set(current);
      currentItems.forEach((session) => next.add(session.id));
      return next;
    });
  }

  async function deleteSelectedSessions() {
    const ids = [...selectedIds];

    if (ids.length === 0) {
      return;
    }

    const titleById = new Map(
      currentItems.map((session) => [session.id, session.title]),
    );
    const deletedTitleText = ids
      .map((sessionId) => titleById.get(sessionId))
      .filter((title): title is string => Boolean(title))
      .join(", ");

    setDeletingSelected(true);
    setNotice(null);

    try {
      await deleteDraftSessions(ids);

      if (selectedSessionId !== null && ids.includes(selectedSessionId)) {
        setSelectedSessionId(null);
        setSelectedSessionDetail(null);
      }

      const shouldMoveToPreviousPage = ids.length >= currentItems.length && page > 0;
      const nextPage = shouldMoveToPreviousPage ? page - 1 : page;

      setPage(nextPage);
      await loadHistoryPage(nextPage);
      setNotice({
        tone: "neutral",
        text: `${deletedTitleText || "선택한 이력"} 삭제되었습니다.`,
      });
    } catch (error) {
      logDraftHistoryIssue("Draft bulk delete", error, { ids });
      setNotice({
        tone: "error",
        text: readErrorMessage(error),
      });
    } finally {
      setDeletingSelected(false);
    }
  }

  function navigatePage(nextPage: number) {
    if (nextPage < 0 || nextPage === page || loadingList) {
      return;
    }

    setPage(nextPage);
    setSelectedSessionId(null);
    setSelectedSessionDetail(null);
  }

  const emptyMessage = keyword
    ? "검색 결과가 없습니다."
    : "종료된 드래프트 이력이 없습니다.";

  return (
    <div className="space-y-4">
      <SurfaceCard className="p-5 sm:p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            종료된 드래프트 이력
          </h1>
          <Button
            disabled={loadingList}
            variant="outline"
            onClick={() => {
              void loadHistoryPage(page);
            }}
          >
            새로고침
          </Button>
        </div>
      </SurfaceCard>

      <SurfaceCard className="space-y-4 p-5 sm:p-6">
        <Input
          type="search"
          value={searchInput}
          placeholder="드래프트명 검색"
          onChange={(event) => setSearchInput(event.target.value)}
        />

        <div className="flex flex-col gap-3 rounded-lg border border-line bg-surface-strong px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted">
            {selectedCount > 0
              ? `${selectedCount}개 이력이 선택되었습니다.`
              : "선택한 이력이 없습니다."}
          </p>
          <Button
            disabled={selectedCount === 0 || deletingSelected}
            variant="danger"
            onClick={() => {
              void deleteSelectedSessions();
            }}
          >
            {deletingSelected ? "삭제 중" : "선택 삭제"}
          </Button>
        </div>

        {notice ? <HistoryNotice notice={notice} /> : null}

        <div className="overflow-x-auto">
          <div className="min-w-[900px] overflow-hidden rounded-lg border border-line">
            <div className="grid grid-cols-[52px_minmax(260px,1fr)_110px_120px_170px_120px] items-center gap-3 bg-surface-muted px-4 py-3 text-sm font-semibold text-foreground">
              <label className="flex justify-center" aria-label="현재 페이지 전체 선택">
                <input
                  type="checkbox"
                  checked={allCurrentSelected}
                  disabled={!hasCurrentItems || loadingList}
                  className="h-4 w-4 accent-[var(--accent)]"
                  onChange={toggleCurrentPage}
                />
              </label>
              <span>드래프트</span>
              <span className="text-center">팀 수</span>
              <span className="text-center">총 인원</span>
              <span>종료 시간</span>
              <span className="text-center">관리</span>
            </div>

            {loadingList ? (
              <div className="px-4 py-12 text-center text-sm text-muted">
                드래프트 이력을 불러오는 중입니다.
              </div>
            ) : currentItems.length === 0 ? (
              <div className="px-4 py-12 text-center text-sm text-muted">
                {emptyMessage}
              </div>
            ) : (
              currentItems.map((session) => {
                const duration = formatDuration(session.startedAt, session.endedAt);

                return (
                  <article
                    key={session.id}
                    className="grid grid-cols-[52px_minmax(260px,1fr)_110px_120px_170px_120px] items-center gap-3 border-t border-line px-4 py-4"
                  >
                    <label
                      className="flex justify-center"
                      aria-label={`${session.title} 선택`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedIds.has(session.id)}
                        className="h-4 w-4 accent-[var(--accent)]"
                        onChange={() => toggleSession(session.id)}
                      />
                    </label>
                    <div className="min-w-0">
                      <div className="mb-2 flex flex-wrap gap-2">
                        <span className="rounded-full bg-success-soft px-3 py-1 text-xs font-semibold text-success-ink">
                          종료
                        </span>
                        <span className="rounded-full bg-surface-muted px-3 py-1 text-xs font-semibold text-muted">
                          {formatOrderMode(session.orderMode)}
                        </span>
                        {duration ? (
                          <span className="rounded-full bg-warning-soft px-3 py-1 text-xs font-semibold text-warning-ink">
                            {duration}
                          </span>
                        ) : null}
                      </div>
                      <button
                        type="button"
                        className="block max-w-full truncate text-left text-base font-semibold text-foreground hover:text-accent-ink"
                        onClick={() => selectSession(session.id)}
                      >
                        {session.title}
                      </button>
                    </div>
                    <span className="text-center text-sm font-semibold text-foreground">
                      {session.teamCount}팀
                    </span>
                    <span className="text-center text-sm font-semibold text-foreground">
                      {getPickedCount(session)}명
                    </span>
                    <span className="text-sm text-muted">
                      {formatDateTime(session.endedAt)}
                    </span>
                    <div className="flex justify-center">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => selectSession(session.id)}
                      >
                        상세 보기
                      </Button>
                    </div>
                  </article>
                );
              })
            )}
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-2">
            <Button
              size="sm"
              disabled={!historyPage.hasPrevious || loadingList}
              onClick={() => navigatePage(page - 1)}
            >
              이전
            </Button>
            <Button
              size="sm"
              disabled={!historyPage.hasNext || loadingList}
              onClick={() => navigatePage(page + 1)}
            >
              다음
            </Button>
          </div>
          <p className="text-sm text-muted">
            {currentPageLabel} / {historyPage.totalPages} 페이지 · 총{" "}
            {historyPage.totalElements}개
          </p>
        </div>
      </SurfaceCard>

      <SurfaceCard className="p-5 sm:p-6">
        {!selectedSessionId ? (
          <div className="rounded-lg border border-dashed border-line px-5 py-10 text-center text-sm text-muted">
            상세 보기를 선택해 주세요.
          </div>
        ) : loadingDetail ? (
          <div className="rounded-lg border border-dashed border-line px-5 py-10 text-center text-sm text-muted">
            상세 이력을 불러오는 중입니다.
          </div>
        ) : !selectedSessionDetail ? (
          <div className="rounded-lg border border-dashed border-line px-5 py-10 text-center text-sm text-muted">
            상세 이력을 표시할 수 없습니다.
          </div>
        ) : (
          <div className="space-y-5">
            <div className="min-w-0">
              <div className="min-w-0">
                <div className="mb-3 flex flex-wrap gap-2">
                  <span className="rounded-full bg-success-soft px-3 py-1 text-xs font-semibold text-success-ink">
                    종료
                  </span>
                  <span className="rounded-full bg-surface-muted px-3 py-1 text-xs font-semibold text-muted">
                    {formatDateTime(selectedSessionDetail.endedAt)}
                  </span>
                  <span className="rounded-full bg-surface-muted px-3 py-1 text-xs font-semibold text-muted">
                    {selectedSessionDetail.teamCount}팀
                  </span>
                  <span className="rounded-full bg-surface-muted px-3 py-1 text-xs font-semibold text-muted">
                    {getDetailPickedCount(selectedSessionDetail)}명
                  </span>
                </div>
                <h2 className="truncate text-2xl font-semibold text-foreground">
                  {selectedSessionDetail.title}
                </h2>
              </div>
            </div>

            <Input
              type="search"
              value={playerSearch}
              placeholder="선수 아이디 검색"
              onChange={(event) => setPlayerSearch(event.target.value)}
            />

            <div className="grid gap-3 xl:grid-cols-2">
              {rosterGroups.map((group) => (
                <article
                  key={group.id}
                  className="overflow-hidden rounded-lg border border-line bg-surface-strong"
                >
                  <header className="flex items-center justify-between gap-3 bg-surface-muted px-4 py-3">
                    <h3 className="truncate text-base font-semibold text-foreground">
                      {group.name}
                    </h3>
                    <span className="rounded-full bg-accent-soft px-3 py-1 text-xs font-semibold text-accent-ink">
                      {group.picks.length}명
                    </span>
                  </header>
                  <div className="grid gap-2 p-3">
                    {group.picks.length === 0 ? (
                      <div className="rounded-lg border border-dashed border-line px-4 py-6 text-center text-sm text-muted">
                        검색 결과 없음
                      </div>
                    ) : (
                      group.picks.map((pick) => {
                        const candidate =
                          candidateByUserId.get(pick.candidateUserId) ?? null;
                        const tier = pick.tier ?? candidate?.tier ?? "-";
                        const race = pick.race ?? candidate?.race ?? "-";

                        return (
                          <div
                            key={pick.pickNo}
                            className="grid grid-cols-[48px_minmax(0,1fr)_auto] items-center gap-3 rounded-lg border border-line bg-white px-3 py-3"
                          >
                            <span className="flex h-8 w-8 items-center justify-center rounded-md bg-accent text-sm font-black text-white">
                              {pick.pickNo}
                            </span>
                            <span className="min-w-0 truncate text-sm font-semibold text-foreground">
                              {formatPickCandidateLoginId(pick, candidate)}
                            </span>
                            <span className="rounded-full bg-surface-muted px-3 py-1 text-xs font-semibold text-muted">
                              티어 {tier} · 종족 {race}
                            </span>
                          </div>
                        );
                      })
                    )}
                  </div>
                </article>
              ))}
            </div>
          </div>
        )}
      </SurfaceCard>
    </div>
  );
}
