"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  deleteProleagueHistories,
  getProleagueHistoryDetail,
  listProleagueHistory,
  type ProleagueHistoryDetail,
  type ProleagueHistoryPage,
  type ProleagueHistorySummary,
} from "@/lib/api/proleague";
import { proleagueDraftLivePath } from "@/lib/proleague-draft/routes";
import { SurfaceCard } from "@/components/site/surface-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type NoticeTone = "error" | "neutral";

type NoticeState = {
  tone: NoticeTone;
  text: string;
};

const PAGE_SIZE = 10;

function readErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return fallback;
}

function getNoticeClassName(tone: NoticeTone) {
  return tone === "error"
    ? "border border-danger-ink/15 bg-danger-soft text-danger-ink"
    : "border border-line bg-surface-muted text-foreground";
}

function toTimestamp(value: string | null | undefined) {
  if (!value) {
    return 0;
  }

  const timestamp = Date.parse(value.includes("T") ? value : `${value}T00:00:00`);

  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function formatDate(value: string | null | undefined) {
  const timestamp = toTimestamp(value);

  if (!timestamp) {
    return "-";
  }

  return new Intl.DateTimeFormat("ko-KR", {
    day: "numeric",
    month: "numeric",
    year: "numeric",
  }).format(timestamp);
}

function formatNullableText(value: string | null | undefined) {
  return value?.trim() || "-";
}

function formatDraftStatus(value: string | null) {
  if (value === "FINISHED") {
    return "종료";
  }

  if (value === "LIVE") {
    return "진행중";
  }

  if (value === "READY") {
    return "준비중";
  }

  return value ?? "-";
}

function createEmptyHistoryPage(page = 0): ProleagueHistoryPage {
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

export function ProleagueHistoryConsole() {
  const [historyPage, setHistoryPage] = useState<ProleagueHistoryPage>(() =>
    createEmptyHistoryPage(),
  );
  const [page, setPage] = useState(0);
  const [searchInput, setSearchInput] = useState("");
  const [keyword, setKeyword] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(() => new Set());
  const [selectedLeagueId, setSelectedLeagueId] = useState<number | null>(null);
  const [selectedDetail, setSelectedDetail] =
    useState<ProleagueHistoryDetail | null>(null);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [deletingSelected, setDeletingSelected] = useState(false);
  const [notice, setNotice] = useState<NoticeState | null>(null);

  const currentItems = historyPage.items;
  const selectedCount = selectedIds.size;
  const hasCurrentItems = currentItems.length > 0;
  const allCurrentSelected =
    hasCurrentItems && currentItems.every((league) => selectedIds.has(league.id));
  const currentPageLabel = historyPage.totalPages > 0 ? historyPage.page + 1 : 0;
  const filterActive = Boolean(keyword || fromDate || toDate);
  const selectedTitleById = useMemo(
    () => new Map(currentItems.map((league) => [league.id, league.leagueName])),
    [currentItems],
  );

  const loadHistoryPage = useCallback(
    async (targetPage: number) => {
      setLoadingList(true);
      setNotice(null);

      try {
        const nextPage = await listProleagueHistory({
          fromDate,
          keyword,
          page: targetPage,
          size: PAGE_SIZE,
          toDate,
        });

        setHistoryPage(nextPage);
        setSelectedIds(new Set());
      } catch (error) {
        setHistoryPage(createEmptyHistoryPage(targetPage));
        setSelectedIds(new Set());
        setNotice({
          tone: "error",
          text: readErrorMessage(error, "프로리그 이력을 불러오지 못했습니다."),
        });
      } finally {
        setLoadingList(false);
      }
    },
    [fromDate, keyword, toDate],
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
    if (selectedLeagueId === null) {
      return;
    }

    const leagueId = selectedLeagueId;
    let cancelled = false;

    async function loadDetail() {
      setLoadingDetail(true);
      setNotice(null);

      try {
        const detail = await getProleagueHistoryDetail(leagueId);

        if (!cancelled) {
          setSelectedDetail(detail);
        }
      } catch (error) {
        if (!cancelled) {
          setSelectedDetail(null);
          setNotice({
            tone: "error",
            text: readErrorMessage(error, "프로리그 상세를 불러오지 못했습니다."),
          });
        }
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
  }, [selectedLeagueId]);

  function selectLeague(leagueId: number) {
    if (selectedLeagueId === leagueId) {
      setSelectedLeagueId(null);
      setSelectedDetail(null);
      setLoadingDetail(false);
      return;
    }

    setSelectedDetail(null);
    setSelectedLeagueId(leagueId);
  }

  function toggleLeague(leagueId: number) {
    setSelectedIds((current) => {
      const next = new Set(current);

      if (next.has(leagueId)) {
        next.delete(leagueId);
      } else {
        next.add(leagueId);
      }

      return next;
    });
  }

  function toggleCurrentPage() {
    setSelectedIds((current) => {
      if (allCurrentSelected) {
        return new Set(
          [...current].filter(
            (leagueId) => !currentItems.some((league) => league.id === leagueId),
          ),
        );
      }

      const next = new Set(current);
      currentItems.forEach((league) => next.add(league.id));
      return next;
    });
  }

  function updateFromDate(value: string) {
    setFromDate(value);
    setPage(0);
    setSelectedLeagueId(null);
    setSelectedDetail(null);
    setLoadingDetail(false);
  }

  function updateToDate(value: string) {
    setToDate(value);
    setPage(0);
    setSelectedLeagueId(null);
    setSelectedDetail(null);
    setLoadingDetail(false);
  }

  function navigatePage(nextPage: number) {
    if (nextPage < 0 || nextPage === page || loadingList) {
      return;
    }

    setPage(nextPage);
    setSelectedLeagueId(null);
    setSelectedDetail(null);
    setLoadingDetail(false);
  }

  async function deleteSelectedLeagues() {
    const ids = [...selectedIds];

    if (ids.length === 0) {
      return;
    }

    setDeletingSelected(true);
    setNotice(null);

    try {
      await deleteProleagueHistories(ids);

      if (selectedLeagueId !== null && ids.includes(selectedLeagueId)) {
        setSelectedLeagueId(null);
        setSelectedDetail(null);
        setLoadingDetail(false);
      }

      const shouldMoveToPreviousPage = ids.length >= currentItems.length && page > 0;
      const nextPage = shouldMoveToPreviousPage ? page - 1 : page;

      setPage(nextPage);
      await loadHistoryPage(nextPage);
      setNotice({
        tone: "neutral",
        text: "삭제되었습니다.",
      });
    } catch (error) {
      setNotice({
        tone: "error",
        text: readErrorMessage(error, "프로리그 이력 삭제에 실패했습니다."),
      });
    } finally {
      setDeletingSelected(false);
    }
  }

  const emptyMessage = filterActive
    ? "검색 결과가 없습니다."
    : "종료된 프로리그 이력이 없습니다.";

  return (
    <div className="space-y-4">
      <SurfaceCard className="p-5 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-accent">
              Proleague History
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-foreground">
              프로리그 이력
            </h1>
            <p className="mt-3 text-sm leading-6 text-muted">
              종료된 프로리그 결과와 팀 구성을 확인합니다.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-sm">
            <span className="rounded-full bg-surface-muted px-3 py-1 font-semibold text-muted">
              총 {historyPage.totalElements}개
            </span>
            <span className="rounded-full bg-accent-soft px-3 py-1 font-semibold text-accent-ink">
              선택 {selectedCount}개
            </span>
          </div>
        </div>
      </SurfaceCard>

      <div className="grid gap-4 2xl:grid-cols-[minmax(0,1fr)_420px]">
        <SurfaceCard className="space-y-4 p-5 sm:p-6">
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_180px_180px]">
            <Input
              type="search"
              value={searchInput}
              placeholder="프로리그명, 시즌, 팀장/부팀장 ID 검색"
              onChange={(event) => setSearchInput(event.target.value)}
            />
            <Input
              type="date"
              value={fromDate}
              aria-label="시작일 필터"
              onChange={(event) => updateFromDate(event.target.value)}
            />
            <Input
              type="date"
              value={toDate}
              aria-label="종료일 필터"
              onChange={(event) => updateToDate(event.target.value)}
            />
          </div>

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
                void deleteSelectedLeagues();
              }}
            >
              {deletingSelected ? "삭제 중" : "선택 삭제"}
            </Button>
          </div>

          {notice ? <HistoryNotice notice={notice} /> : null}

          <div className="overflow-x-auto">
            <div className="min-w-[1120px] overflow-hidden rounded-lg border border-line">
              <div className="grid grid-cols-[52px_76px_minmax(210px,1fr)_150px_90px_110px_140px_140px_140px_120px] items-center gap-3 bg-surface-muted px-4 py-3 text-sm font-semibold text-foreground">
                <label
                  className="flex justify-center"
                  aria-label="현재 페이지 전체 선택"
                >
                  <input
                    type="checkbox"
                    checked={allCurrentSelected}
                    disabled={!hasCurrentItems || loadingList}
                    className="h-4 w-4 accent-[var(--accent)]"
                    onChange={toggleCurrentPage}
                  />
                </label>
                <span>상태</span>
                <span>프로리그명</span>
                <span>시즌명</span>
                <span className="text-center">팀 수</span>
                <span className="text-center">총 참가자</span>
                <span>우승팀</span>
                <span>준우승팀</span>
                <span>종료일</span>
                <span className="text-center">관리</span>
              </div>

              {loadingList ? (
                <div className="px-4 py-12 text-center text-sm text-muted">
                  프로리그 이력을 불러오는 중입니다.
                </div>
              ) : currentItems.length === 0 ? (
                <div className="px-4 py-12 text-center text-sm text-muted">
                  {emptyMessage}
                </div>
              ) : (
                currentItems.map((league) => (
                  <HistoryRow
                    key={league.id}
                    league={league}
                    checked={selectedIds.has(league.id)}
                    onSelect={() => selectLeague(league.id)}
                    onToggle={() => toggleLeague(league.id)}
                  />
                ))
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

        <ProleagueHistoryDetailPanel
          detail={selectedDetail}
          loading={loadingDetail}
          selectedTitle={
            selectedLeagueId === null ? null : selectedTitleById.get(selectedLeagueId)
          }
        />
      </div>
    </div>
  );
}

function HistoryRow({
  checked,
  league,
  onSelect,
  onToggle,
}: {
  checked: boolean;
  league: ProleagueHistorySummary;
  onSelect: () => void;
  onToggle: () => void;
}) {
  return (
    <article className="grid grid-cols-[52px_76px_minmax(210px,1fr)_150px_90px_110px_140px_140px_140px_120px] items-center gap-3 border-t border-line px-4 py-4">
      <label className="flex justify-center" aria-label={`${league.leagueName} 선택`}>
        <input
          type="checkbox"
          checked={checked}
          className="h-4 w-4 accent-[var(--accent)]"
          onChange={onToggle}
        />
      </label>
      <span className="w-fit rounded-full bg-success-soft px-3 py-1 text-xs font-semibold text-success-ink">
        종료
      </span>
      <button
        type="button"
        className="min-w-0 truncate text-left text-base font-semibold text-foreground hover:text-accent-ink"
        onClick={onSelect}
      >
        {league.leagueName}
      </button>
      <span className="truncate text-sm text-muted">{league.seasonName}</span>
      <span className="text-center text-sm font-semibold text-foreground">
        {league.teamCount}팀
      </span>
      <span className="text-center text-sm font-semibold text-foreground">
        {league.participantCount}명
      </span>
      <span className="truncate text-sm text-muted">
        {formatNullableText(league.championTeamName)}
      </span>
      <span className="truncate text-sm text-muted">
        {formatNullableText(league.runnerUpTeamName)}
      </span>
      <span className="text-sm text-muted">{formatDate(league.endDate)}</span>
      <div className="flex justify-center">
        <Button size="sm" variant="outline" onClick={onSelect}>
          상세 보기
        </Button>
      </div>
    </article>
  );
}

function ProleagueHistoryDetailPanel({
  detail,
  loading,
  selectedTitle,
}: {
  detail: ProleagueHistoryDetail | null;
  loading: boolean;
  selectedTitle: string | null | undefined;
}) {
  if (!selectedTitle && !detail && !loading) {
    return (
      <SurfaceCard className="p-5 sm:p-6">
        <div className="rounded-lg border border-dashed border-line px-5 py-10 text-center text-sm text-muted">
          상세 보기를 선택해 주세요.
        </div>
      </SurfaceCard>
    );
  }

  if (loading) {
    return (
      <SurfaceCard className="p-5 sm:p-6">
        <div className="rounded-lg border border-dashed border-line px-5 py-10 text-center text-sm text-muted">
          {selectedTitle ? `${selectedTitle} 상세를 불러오는 중입니다.` : "상세를 불러오는 중입니다."}
        </div>
      </SurfaceCard>
    );
  }

  if (!detail) {
    return (
      <SurfaceCard className="p-5 sm:p-6">
        <div className="rounded-lg border border-dashed border-line px-5 py-10 text-center text-sm text-muted">
          프로리그 상세를 표시할 수 없습니다.
        </div>
      </SurfaceCard>
    );
  }

  const draftHref =
    typeof detail.draftSessionId === "number"
      ? proleagueDraftLivePath(detail.draftSessionId)
      : null;

  return (
    <SurfaceCard className="space-y-5 p-5 sm:p-6">
      <div className="min-w-0">
        <div className="mb-3 flex flex-wrap gap-2">
          <span className="rounded-full bg-success-soft px-3 py-1 text-xs font-semibold text-success-ink">
            종료
          </span>
          <span className="rounded-full bg-surface-muted px-3 py-1 text-xs font-semibold text-muted">
            {detail.teamCount}팀
          </span>
          <span className="rounded-full bg-surface-muted px-3 py-1 text-xs font-semibold text-muted">
            {detail.participantCount}명
          </span>
        </div>
        <h2 className="truncate text-2xl font-semibold text-foreground">
          {detail.leagueName}
        </h2>
        <p className="mt-2 truncate text-sm text-muted">{detail.seasonName}</p>
      </div>

      <dl className="grid gap-3 text-sm">
        <DetailLine label="기간" value={`${formatDate(detail.startDate)} ~ ${formatDate(detail.endDate)}`} />
        <DetailLine label="우승팀" value={formatNullableText(detail.championTeamName)} />
        <DetailLine label="준우승팀" value={formatNullableText(detail.runnerUpTeamName)} />
        <DetailLine label="드래프트 상태" value={formatDraftStatus(detail.draftStatus)} />
      </dl>

      {draftHref ? (
        <Link
          href={draftHref}
          className="inline-flex rounded-full border border-line-strong bg-white px-4 py-2 text-sm font-semibold text-muted transition-colors hover:border-accent hover:bg-accent-soft hover:text-accent-ink"
        >
          드래프트 보기
        </Link>
      ) : null}

      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-foreground">팀 구성</h3>
        {detail.teams.length === 0 ? (
          <div className="rounded-lg border border-dashed border-line px-4 py-8 text-center text-sm text-muted">
            팀 구성이 없습니다.
          </div>
        ) : (
          <div className="grid gap-3">
            {detail.teams.map((team) => (
              <article
                key={`${team.teamName}-${team.leaderUserId ?? ""}-${team.viceLeaderUserId ?? ""}`}
                className="rounded-lg border border-line bg-surface-strong px-4 py-4"
              >
                <h4 className="truncate text-base font-semibold text-foreground">
                  {team.teamName}
                </h4>
                <dl className="mt-3 grid gap-2 text-sm">
                  <DetailLine
                    label="팀장 ID"
                    value={formatNullableText(team.leaderUserId)}
                  />
                  <DetailLine
                    label="부팀장 ID"
                    value={formatNullableText(team.viceLeaderUserId)}
                  />
                </dl>
              </article>
            ))}
          </div>
        )}
      </section>
    </SurfaceCard>
  );
}

function DetailLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="shrink-0 text-muted">{label}</dt>
      <dd className="min-w-0 truncate font-semibold text-foreground">{value}</dd>
    </div>
  );
}
