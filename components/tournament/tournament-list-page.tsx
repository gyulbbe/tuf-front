"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SurfaceCard } from "@/components/site/surface-card";
import { deleteTournaments, listTournaments } from "@/lib/api/tournament";
import { isAdminRole } from "@/lib/auth/roles";
import type {
  TournamentBracketType,
  TournamentPage,
  TournamentStatus,
  TournamentSummary,
} from "@/lib/tournament/types";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 10;

const statusLabels: Record<TournamentStatus, string> = {
  LIVE: "진행중",
  FINISHED: "종료",
};

const bracketTypeLabels: Record<TournamentBracketType, string> = {
  SINGLE_ELIMINATION: "싱글 엘리미네이션",
  DUAL_GROUP: "듀얼 조별전",
};

const createTournamentLinkClassName =
  "inline-flex items-center justify-center rounded-full bg-accent px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-accent-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background";
const manageTournamentLinkClassName =
  "inline-flex items-center justify-center rounded-full border border-line-strong bg-white px-3 py-2 text-xs font-semibold text-muted transition-colors hover:border-accent hover:bg-accent-soft hover:text-accent-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background";

function createEmptyTournamentPage(page = 0): TournamentPage {
  return {
    items: [],
    page,
    size: PAGE_SIZE,
    totalElements: 0,
    totalPages: 0,
    hasNext: false,
    hasPrevious: false,
  };
}

function getStatusClassName(status: TournamentStatus) {
  switch (status) {
    case "FINISHED":
      return "bg-surface-muted text-muted";
    case "LIVE":
    default:
      return "bg-success-soft text-success-ink";
  }
}

function formatDate(value: string | null | undefined) {
  if (!value) {
    return "-";
  }

  const timestamp = Date.parse(value);

  if (Number.isNaN(timestamp)) {
    return "-";
  }

  return new Intl.DateTimeFormat("ko-KR", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(timestamp);
}

function getGridClassName(canManage: boolean) {
  return canManage
    ? "md:grid-cols-[44px_minmax(0,1fr)_110px_120px_120px_150px]"
    : "md:grid-cols-[minmax(0,1fr)_110px_120px_150px]";
}

function TournamentRow({
  canManage,
  isSelected,
  onToggleSelected,
  tournament,
}: {
  canManage: boolean;
  isSelected: boolean;
  onToggleSelected: (tournamentId: string) => void;
  tournament: TournamentSummary;
}) {
  return (
    <article className="border-t border-line first:border-t-0">
      <div className="px-5 py-4 transition-colors hover:bg-surface-muted/50">
        <div
          className={cn(
            "grid gap-3 md:items-center",
            getGridClassName(canManage),
          )}
        >
          {canManage ? (
            <label className="flex items-center md:justify-center">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-line-strong text-accent focus:ring-accent"
                checked={isSelected}
                onChange={() => onToggleSelected(tournament.id)}
                aria-label={`${tournament.title} 선택`}
              />
            </label>
          ) : null}

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-semibold",
                  getStatusClassName(tournament.status),
                )}
              >
                {statusLabels[tournament.status]}
              </span>
              {tournament.bracketType ? (
                <span className="rounded-full bg-surface-muted px-3 py-1 text-xs font-semibold text-muted">
                  {bracketTypeLabels[tournament.bracketType]}
                </span>
              ) : null}
            </div>
            <Link
              href={`/tournament/${tournament.id}`}
              className="mt-2 block truncate text-base font-semibold text-foreground hover:text-accent-ink"
            >
              {tournament.title}
            </Link>
          </div>

          <span className="text-sm text-muted md:text-center">
            {tournament.participantCount || "-"}명
          </span>
          <span className="text-sm text-muted md:text-center">
            {tournament.groupCount || "-"}개
          </span>
          {canManage ? (
            <Link
              href={`/admin/tournament/${tournament.id}`}
              className={manageTournamentLinkClassName}
            >
              진행 관리
            </Link>
          ) : null}
          <span className="text-sm text-muted md:text-right">
            {formatDate(tournament.updateDate ?? tournament.regDate)}
          </span>
        </div>
      </div>
    </article>
  );
}

export function TournamentListPage() {
  const { user } = useAuth();
  const [tournamentPage, setTournamentPage] = useState<TournamentPage>(() =>
    createEmptyTournamentPage(),
  );
  const [page, setPage] = useState(0);
  const [searchInput, setSearchInput] = useState("");
  const [keyword, setKeyword] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [reloadKey, setReloadKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const [deletingSelected, setDeletingSelected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canManageTournament = isAdminRole(user?.role);
  const tournaments = tournamentPage.items;
  const currentPageIds = useMemo(
    () => tournaments.map((tournament) => tournament.id),
    [tournaments],
  );
  const allCurrentPageSelected =
    currentPageIds.length > 0 &&
    currentPageIds.every((tournamentId) => selectedIds.has(tournamentId));

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setKeyword(searchInput.trim());
      setPage(0);
    }, 300);

    return () => {
      window.clearTimeout(timer);
    };
  }, [searchInput]);

  useEffect(() => {
    let cancelled = false;

    async function loadTournamentPage() {
      setLoading(true);
      setError(null);

      try {
        const nextTournamentPage = await listTournaments({
          page,
          size: PAGE_SIZE,
          keyword,
        });

        if (!cancelled) {
          setTournamentPage(nextTournamentPage);
          setSelectedIds(new Set());
        }
      } catch (loadError) {
        if (!cancelled) {
          setTournamentPage(createEmptyTournamentPage(page));
          setSelectedIds(new Set());
          setError(
            loadError instanceof Error
              ? loadError.message
              : "토너먼트 목록을 불러오지 못했습니다.",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadTournamentPage();

    return () => {
      cancelled = true;
    };
  }, [keyword, page, reloadKey]);

  function toggleTournament(tournamentId: string) {
    setSelectedIds((previousIds) => {
      const nextIds = new Set(previousIds);
      if (nextIds.has(tournamentId)) {
        nextIds.delete(tournamentId);
      } else {
        nextIds.add(tournamentId);
      }
      return nextIds;
    });
  }

  function toggleCurrentPage() {
    setSelectedIds((previousIds) => {
      const nextIds = new Set(previousIds);
      if (allCurrentPageSelected) {
        currentPageIds.forEach((tournamentId) => nextIds.delete(tournamentId));
      } else {
        currentPageIds.forEach((tournamentId) => nextIds.add(tournamentId));
      }
      return nextIds;
    });
  }

  async function deleteSelected() {
    const ids = Array.from(selectedIds);
    if (ids.length === 0 || deletingSelected) {
      return;
    }

    setDeletingSelected(true);
    setError(null);

    try {
      await deleteTournaments(ids);
      const shouldMovePreviousPage = ids.length >= tournaments.length && page > 0;
      if (shouldMovePreviousPage) {
        setPage((currentPage) => Math.max(currentPage - 1, 0));
      } else {
        setReloadKey((currentKey) => currentKey + 1);
      }
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "선택한 토너먼트를 삭제하지 못했습니다.",
      );
    } finally {
      setDeletingSelected(false);
    }
  }

  const displayPage =
    tournamentPage.totalPages > 0 ? tournamentPage.page + 1 : 0;

  return (
    <div className="mx-auto w-full max-w-6xl space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase text-accent">
            Tournament
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            토너먼트
          </h1>
        </div>

        {canManageTournament ? (
          <Link
            href="/admin/tournament/new"
            className={createTournamentLinkClassName}
          >
            대진표 등록
          </Link>
        ) : null}
      </div>

      <SurfaceCard className="space-y-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <Input
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="토너먼트명 검색"
            className="lg:max-w-md"
          />
          {canManageTournament ? (
            <Button
              variant="danger"
              disabled={selectedIds.size === 0 || deletingSelected}
              onClick={deleteSelected}
            >
              선택 삭제
            </Button>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2 text-sm text-muted">
          <span>총 {tournamentPage.totalElements}개</span>
          {keyword ? <span>검색어: {keyword}</span> : null}
          {canManageTournament ? <span>선택 {selectedIds.size}개</span> : null}
        </div>
      </SurfaceCard>

      {error ? (
        <div className="rounded-lg border border-danger-ink/20 bg-danger-soft px-5 py-4">
          <p className="text-sm font-medium text-danger-ink">{error}</p>
          <p className="mt-2 text-xs leading-6 text-danger-ink/80">
            백엔드 공개 목록 API `GET /tournaments` 응답과 관리자 삭제 API
            `POST /tournaments/delete` 응답을 확인해 주세요.
          </p>
        </div>
      ) : null}

      <SurfaceCard className="overflow-hidden p-0">
        <div
          className={cn(
            "hidden gap-3 border-b border-line bg-surface-muted px-5 py-4 text-sm font-semibold text-foreground md:grid",
            getGridClassName(canManageTournament),
          )}
        >
          {canManageTournament ? (
            <label className="flex items-center justify-center">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-line-strong text-accent focus:ring-accent"
                checked={allCurrentPageSelected}
                onChange={toggleCurrentPage}
                aria-label="현재 페이지 전체 선택"
              />
            </label>
          ) : null}
          <span>대회</span>
          <span className="text-center">참가자</span>
          <span className="text-center">조</span>
          {canManageTournament ? (
            <span className="text-center">관리</span>
          ) : null}
          <span className="text-right">업데이트</span>
        </div>

        {loading ? (
          <div className="px-5 py-12 text-center text-sm text-muted">
            토너먼트 목록을 불러오는 중입니다.
          </div>
        ) : tournaments.length > 0 ? (
          <div>
            {tournaments.map((tournament) => (
              <TournamentRow
                key={tournament.id}
                canManage={canManageTournament}
                isSelected={selectedIds.has(tournament.id)}
                onToggleSelected={toggleTournament}
                tournament={tournament}
              />
            ))}
          </div>
        ) : (
          <div className="px-5 py-12 text-center text-sm text-muted">
            표시할 토너먼트가 없습니다.
          </div>
        )}
      </SurfaceCard>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted">
          {displayPage} / {tournamentPage.totalPages} 페이지, 총{" "}
          {tournamentPage.totalElements}개
        </p>
        <div className="flex gap-2">
          <Button
            size="sm"
            disabled={!tournamentPage.hasPrevious || loading}
            onClick={() => setPage((currentPage) => Math.max(currentPage - 1, 0))}
          >
            이전
          </Button>
          <Button
            size="sm"
            disabled={!tournamentPage.hasNext || loading}
            onClick={() => setPage((currentPage) => currentPage + 1)}
          >
            다음
          </Button>
        </div>
      </div>
    </div>
  );
}
