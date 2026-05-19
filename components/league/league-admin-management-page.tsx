"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { SurfaceCard } from "@/components/site/surface-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  deleteAdminLeague,
  finishAdminLeague,
  listAdminLeagues,
  type AdminLeagueLinkedFilter,
  type AdminLeagueStatus,
  type AdminLeagueSummary,
  type AdminLeagueType,
} from "@/lib/api/league";
import { cn } from "@/lib/utils";

const leagueTypes: Array<{
  value: AdminLeagueType;
  label: string;
  description: string;
}> = [
  {
    value: "PROLEAGUE",
    label: "프로리그",
    description: "팀, 팀장, 부팀장, 팀원과 드래프트를 관리합니다.",
  },
  {
    value: "PERSONAL",
    label: "개인리그",
    description: "선수 목록과 토너먼트를 관리합니다.",
  },
  {
    value: "ULTIMATE_BATTLE",
    label: "끝장전",
    description: "두 선수가 정해진 총 판수를 끝까지 진행합니다.",
  },
  {
    value: "RACE_SURVIVAL",
    label: "종족 최강전",
    description: "세 종족 대표가 승자연전으로 진행합니다.",
  },
];

const statusLabels: Record<AdminLeagueStatus, string> = {
  LIVE: "진행중",
  FINISHED: "종료",
};

const linkedFilterOptions: Array<{
  value: AdminLeagueLinkedFilter;
  label: string;
}> = [
  { value: "ALL", label: "연동 전체" },
  { value: "LINKED", label: "연동 있음" },
  { value: "UNLINKED", label: "연동 없음" },
];

function formatPeriod(item: AdminLeagueSummary) {
  return `${item.startDate ?? "-"} ~ ${item.endDate ?? "-"}`;
}

function participantLabel(item: AdminLeagueSummary) {
  if (item.leagueType === "PROLEAGUE") {
    const teams = item.teamCount ?? 0;
    return `${teams}팀 / ${item.participantCount}명`;
  }
  if (item.leagueType === "RACE_SURVIVAL") {
    return `3종족 / ${item.participantCount}명`;
  }
  return `${item.participantCount}명`;
}

function linkedLabel(item: AdminLeagueSummary) {
  return item.linkedLabel ?? "-";
}

export function LeagueAdminManagementPage({
  initialType = "PROLEAGUE",
}: {
  initialType?: AdminLeagueType;
}) {
  const [leagueType, setLeagueType] = useState<AdminLeagueType>(initialType);
  const [keywordInput, setKeywordInput] = useState("");
  const [keyword, setKeyword] = useState("");
  const [status, setStatus] = useState<"ALL" | AdminLeagueStatus>("ALL");
  const [linked, setLinked] = useState<AdminLeagueLinkedFilter>("ALL");
  const [page, setPage] = useState(0);
  const [items, setItems] = useState<AdminLeagueSummary[]>([]);
  const [totalElements, setTotalElements] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [hasNext, setHasNext] = useState(false);
  const [hasPrevious, setHasPrevious] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminLeagueSummary | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);

  const activeType = useMemo(
    () => leagueTypes.find((type) => type.value === leagueType) ?? leagueTypes[0],
    [leagueType],
  );

  async function loadLeagues(nextPage = page) {
    setLoading(true);
    setError(null);
    try {
      const result = await listAdminLeagues({
        leagueType,
        keyword,
        status,
        linked,
        page: nextPage,
        size: 20,
      });
      setItems(result.items);
      setPage(result.page);
      setTotalElements(result.totalElements);
      setTotalPages(result.totalPages);
      setHasNext(result.hasNext);
      setHasPrevious(result.hasPrevious);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "리그 목록을 불러오지 못했습니다.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadLeagues(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leagueType, keyword, status, linked]);

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPage(0);
    setKeyword(keywordInput.trim());
  }

  function changeType(nextType: AdminLeagueType) {
    setLeagueType(nextType);
    setKeyword("");
    setKeywordInput("");
    setStatus("ALL");
    setLinked("ALL");
    setPage(0);
    setMessage(null);
    setError(null);
  }

  async function finish(item: AdminLeagueSummary) {
    if (item.status === "FINISHED") {
      return;
    }
    setActionLoadingId(item.id);
    setMessage(null);
    setError(null);
    try {
      await finishAdminLeague(item.id);
      setMessage(`${item.leagueName} 리그를 종료 처리했습니다.`);
      await loadLeagues(page);
    } catch (finishError) {
      setError(
        finishError instanceof Error
          ? finishError.message
          : "리그를 종료 처리하지 못했습니다.",
      );
    } finally {
      setActionLoadingId(null);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) {
      return;
    }
    setActionLoadingId(deleteTarget.id);
    setMessage(null);
    setError(null);
    try {
      await deleteAdminLeague(deleteTarget.id);
      setMessage(`${deleteTarget.leagueName} 리그를 삭제했습니다.`);
      setDeleteTarget(null);
      await loadLeagues(page);
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "리그를 삭제하지 못했습니다.",
      );
    } finally {
      setActionLoadingId(null);
    }
  }

  return (
    <div className="space-y-5">
      <SurfaceCard className="p-8 sm:p-10">
        <p className="text-xs font-bold uppercase tracking-[0.24em] text-accent">
          ADMIN LEAGUE
        </p>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
          리그 관리
        </h1>
        <p className="mt-6 max-w-3xl text-base leading-8 text-muted">
          프로리그, 개인리그, 끝장전, 종족 최강전 등을 조회하고 수정, 종료,
          삭제합니다.
        </p>
      </SurfaceCard>

      <SurfaceCard className="space-y-5">
        <div className="grid gap-3 lg:grid-cols-4">
          {leagueTypes.map((type) => (
            <button
              key={type.value}
              type="button"
              onClick={() => changeType(type.value)}
              className={cn(
                "rounded-lg border bg-surface p-5 text-left transition-colors",
                leagueType === type.value
                  ? "border-accent bg-accent-soft shadow-[inset_0_0_0_1px_rgba(22,135,184,0.35)]"
                  : "border-line hover:border-accent",
              )}
            >
              <strong className="block text-lg font-semibold text-foreground">
                {type.label}
              </strong>
              <span className="mt-2 block text-sm leading-6 text-muted">
                {type.description}
              </span>
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-4 rounded-lg border border-line bg-white p-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-foreground">
              {activeType.label}
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted">
              {activeType.description}
            </p>
          </div>
          <Link
            href={`/admin/league?mode=create&type=${leagueType}`}
            className="inline-flex min-h-11 items-center justify-center rounded-full bg-accent px-5 text-sm font-semibold text-white transition-colors hover:bg-accent-ink"
          >
            새로 등록
          </Link>
        </div>

        <form
          onSubmit={submitSearch}
          className="grid gap-3 rounded-lg border border-line bg-white p-4 lg:grid-cols-[minmax(260px,1fr)_180px_200px_auto]"
        >
          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-foreground">
              검색어
            </span>
            <Input
              value={keywordInput}
              onChange={(event) => setKeywordInput(event.target.value)}
              placeholder="리그명 또는 시즌명 검색"
            />
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-foreground">
              상태
            </span>
            <select
              value={status}
              onChange={(event) => {
                setPage(0);
                setStatus(event.target.value as "ALL" | AdminLeagueStatus);
              }}
              className="min-h-12 w-full rounded-lg border border-line bg-surface px-4 text-sm font-semibold text-foreground outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
            >
              <option value="ALL">전체</option>
              <option value="LIVE">진행중</option>
              <option value="FINISHED">종료</option>
            </select>
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-foreground">
              연동
            </span>
            <select
              value={linked}
              onChange={(event) => {
                setPage(0);
                setLinked(event.target.value as AdminLeagueLinkedFilter);
              }}
              className="min-h-12 w-full rounded-lg border border-line bg-surface px-4 text-sm font-semibold text-foreground outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
            >
              {linkedFilterOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <div className="flex items-end gap-2">
            <Button type="submit" variant="accent" className="min-h-12">
              검색
            </Button>
            <Button
              type="button"
              className="min-h-12"
              onClick={() => {
                setKeywordInput("");
                setKeyword("");
                setStatus("ALL");
                setLinked("ALL");
                setPage(0);
              }}
            >
              초기화
            </Button>
          </div>
        </form>

        {message ? (
          <div className="rounded-lg border border-success-ink/20 bg-success-soft px-5 py-4 text-sm font-semibold text-success-ink">
            {message}
          </div>
        ) : null}
        {error ? (
          <div className="rounded-lg border border-danger-ink/20 bg-danger-soft px-5 py-4 text-sm font-semibold text-danger-ink">
            {error}
          </div>
        ) : null}

        <div className="overflow-hidden rounded-lg border border-line bg-white">
          <div className="flex items-center justify-between border-b border-line px-5 py-4">
            <div>
              <h3 className="text-lg font-semibold text-foreground">
                리그 목록
              </h3>
              <p className="mt-1 text-sm text-muted">총 {totalElements}개</p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] border-collapse text-left text-sm">
              <thead className="bg-accent-soft text-xs uppercase tracking-[0.08em] text-muted">
                <tr>
                  <th className="px-5 py-3">리그명</th>
                  <th className="px-5 py-3">시즌</th>
                  <th className="px-5 py-3">상태</th>
                  <th className="px-5 py-3">기간</th>
                  <th className="px-5 py-3">연동</th>
                  <th className="px-5 py-3">참가</th>
                  <th className="px-5 py-3 text-right">액션</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-12 text-center text-muted">
                      불러오는 중입니다.
                    </td>
                  </tr>
                ) : items.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-12 text-center text-muted">
                      조건에 맞는 리그가 없습니다.
                    </td>
                  </tr>
                ) : (
                  items.map((item) => (
                    <tr key={item.id} className="align-middle">
                      <td className="px-5 py-4">
                        <div className="font-semibold text-foreground">
                          {item.leagueName || "-"}
                        </div>
                      </td>
                      <td className="px-5 py-4 text-muted">
                        {item.seasonName || "-"}
                      </td>
                      <td className="px-5 py-4">
                        <span
                          className={cn(
                            "inline-flex rounded-full px-3 py-1 text-xs font-semibold",
                            item.status === "FINISHED"
                              ? "bg-muted/10 text-muted"
                              : "bg-success-soft text-success-ink",
                          )}
                        >
                          {statusLabels[item.status]}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-muted">{formatPeriod(item)}</td>
                      <td className="px-5 py-4 text-muted">{linkedLabel(item)}</td>
                      <td className="px-5 py-4 text-muted">
                        {participantLabel(item)}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex justify-end gap-2">
                          <Link
                            href={`/admin/league/${item.id}?type=${item.leagueType}`}
                            className="inline-flex min-h-10 items-center justify-center rounded-full border border-line-strong bg-white px-4 text-sm font-semibold text-muted transition-colors hover:border-accent hover:bg-accent-soft hover:text-accent-ink"
                          >
                            수정
                          </Link>
                          <Button
                            size="sm"
                            disabled={
                              item.status === "FINISHED" ||
                              actionLoadingId === item.id
                            }
                            onClick={() => void finish(item)}
                          >
                            종료
                          </Button>
                          {item.canDelete ? (
                            <Button
                              size="sm"
                              variant="danger"
                              disabled={actionLoadingId === item.id}
                              onClick={() => setDeleteTarget(item)}
                            >
                              삭제
                            </Button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between border-t border-line px-5 py-4">
            <Button
              size="sm"
              disabled={!hasPrevious || loading}
              onClick={() => void loadLeagues(Math.max(page - 1, 0))}
            >
              이전
            </Button>
            <span className="text-sm text-muted">
              {totalPages === 0 ? 0 : page + 1} / {Math.max(totalPages, 1)}
              페이지
            </span>
            <Button
              size="sm"
              disabled={!hasNext || loading}
              onClick={() => void loadLeagues(page + 1)}
            >
              다음
            </Button>
          </div>
        </div>
      </SurfaceCard>

      {deleteTarget ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4">
          <div className="w-full max-w-xl rounded-lg border border-danger-ink/20 bg-surface p-8 shadow-[0_24px_70px_rgba(23,33,43,0.22)]">
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-muted">
              DANGER ZONE
            </p>
            <h2 className="mt-4 text-3xl font-semibold text-foreground">
              리그 삭제
            </h2>
            <p className="mt-5 leading-8 text-muted">
              <strong className="text-foreground">{deleteTarget.leagueName}</strong>
              을 완전히 삭제합니다. 이 작업은 되돌릴 수 없습니다.
            </p>
            <div className="mt-8 flex justify-end gap-3">
              <Button
                disabled={actionLoadingId === deleteTarget.id}
                onClick={() => setDeleteTarget(null)}
              >
                취소
              </Button>
              <Button
                variant="danger"
                disabled={actionLoadingId === deleteTarget.id}
                onClick={() => void confirmDelete()}
              >
                삭제
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
