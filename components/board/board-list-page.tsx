"use client";

import Link from "next/link";
import { startTransition, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/auth-provider";
import { BoardPagination } from "@/components/board/board-pagination";
import {
  BoardLinkButton,
  BoardNotice,
  SEARCH_TYPE_OPTIONS,
  SELECT_CLASS_NAME,
  type BoardListQuery,
  type NoticeState,
  alertBoardError,
  buildBoardListHref,
  formatBoardDateTime,
  readBoardErrorMessage,
} from "@/components/board/board-shared";
import { InfoList } from "@/components/site/info-list";
import { TabPageShell } from "@/components/site/tab-page-shell";
import { SurfaceCard } from "@/components/site/surface-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { listBoards, type BoardListData } from "@/lib/api/boards";

type BoardListPageProps = {
  initialQuery: BoardListQuery;
};

type SearchFormState = {
  keyword: string;
  searchType: BoardListQuery["searchType"];
};

export function BoardListPage({ initialQuery }: BoardListPageProps) {
  const router = useRouter();
  const { status, user } = useAuth();
  const queryKeyword = initialQuery.keyword;
  const queryPage = initialQuery.page;
  const querySearchType = initialQuery.searchType;
  const querySize = initialQuery.size;
  const [notice, setNotice] = useState<NoticeState | null>(null);
  const [result, setResult] = useState<BoardListData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchForm, setSearchForm] = useState<SearchFormState>({
    keyword: queryKeyword,
    searchType: querySearchType,
  });

  useEffect(() => {
    let cancelled = false;

    async function loadBoards() {
      setIsLoading(true);
      setNotice(null);

      try {
        const nextResult = await listBoards({
          keyword: queryKeyword,
          page: queryPage,
          searchType: querySearchType,
          size: querySize,
        });

        if (cancelled) {
          return;
        }

        setResult(nextResult);
      } catch (error) {
        if (cancelled) {
          return;
        }

        setResult(null);
        setNotice({
          tone: "error",
          text: readBoardErrorMessage(error),
        });
        alertBoardError(error);
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadBoards();

    return () => {
      cancelled = true;
    };
  }, [queryKeyword, queryPage, querySearchType, querySize]);

  function navigateToQuery(nextQuery: BoardListQuery) {
    startTransition(() => {
      router.push(buildBoardListHref(nextQuery));
    });
  }

  const activeKeyword = queryKeyword.trim();
  const sidebarItems =
    status === "authenticated"
      ? [
          `${user?.username ?? "회원"} 계정으로 바로 글과 댓글을 작성할 수 있습니다.`,
          "수정/삭제 버튼은 서버 응답의 editable, deletable 값이 true일 때만 노출됩니다.",
          "작성자 검색은 회원 글이면 userId, guest 글이면 authorName 기준으로 동작합니다.",
        ]
      : [
          "비회원도 글과 댓글을 작성할 수 있습니다.",
          "비회원은 작성자명을 직접 입력해야 합니다.",
          "비회원 글과 댓글에는 수정/삭제 버튼이 노출되지 않습니다.",
        ];

  return (
    <TabPageShell
      label="Notice"
      title="게시판"
      description="검색, 페이징, 상세, 작성, 수정, 삭제와 댓글/대댓글까지 현재 프론트의 기존 스택과 컴포넌트 스타일에 맞춰 연결한 게시판 화면입니다."
      sidebar={
        <>
          <SurfaceCard className="p-6">
            <p className="text-sm font-semibold text-foreground">이용 안내</p>
            <InfoList items={sidebarItems} />
          </SurfaceCard>

          <SurfaceCard className="p-6">
            <p className="text-sm font-semibold text-foreground">목록 상태</p>
            <div className="mt-4 space-y-3 text-sm leading-7 text-muted">
              <p>
                전체 게시글{" "}
                <span className="font-semibold text-foreground">
                  {result?.pagination.totalElements ?? 0}
                </span>
                개
              </p>
              <p>
                현재 페이지{" "}
                <span className="font-semibold text-foreground">
                  {result?.pagination.page ?? queryPage}
                </span>
              </p>
              <p>
                검색어{" "}
                <span className="font-semibold text-foreground">
                  {activeKeyword || "없음"}
                </span>
              </p>
            </div>
          </SurfaceCard>
        </>
      }
    >
      <div className="space-y-4">
        <form
          className="rounded-[26px] border border-line bg-surface-strong p-4"
          onSubmit={(event) => {
            event.preventDefault();
            navigateToQuery({
              keyword: searchForm.keyword,
              page: 1,
              searchType: searchForm.searchType,
              size: querySize,
            });
          }}
        >
          <div className="grid gap-3 lg:grid-cols-[180px_minmax(0,1fr)_auto]">
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-foreground">
                검색 기준
              </span>
              <select
                className={SELECT_CLASS_NAME}
                value={searchForm.searchType}
                onChange={(event) =>
                  setSearchForm((current) => ({
                    ...current,
                    searchType: event.target.value as SearchFormState["searchType"],
                  }))
                }
              >
                {SEARCH_TYPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-foreground">
                검색어
              </span>
              <Input
                value={searchForm.keyword}
                onChange={(event) =>
                  setSearchForm((current) => ({
                    ...current,
                    keyword: event.target.value,
                  }))
                }
                placeholder="검색어를 입력해 주세요."
              />
            </label>

            <div className="flex flex-wrap items-end gap-2">
              <Button type="submit" variant="accent">
                검색
              </Button>
              <Button
                type="button"
                onClick={() => {
                  setSearchForm({
                    keyword: "",
                    searchType: "TITLE",
                  });
                  navigateToQuery({
                    keyword: "",
                    page: 1,
                    searchType: "TITLE",
                    size: querySize,
                  });
                }}
              >
                초기화
              </Button>
              <BoardLinkButton href="/notice/new" variant="accent">
                글쓰기
              </BoardLinkButton>
            </div>
          </div>
        </form>

        {notice ? <BoardNotice notice={notice} /> : null}

        <div className="overflow-hidden rounded-[26px] border border-line bg-white/72">
          <div className="hidden grid-cols-[minmax(0,1fr)_120px_180px] gap-3 border-b border-line bg-surface-muted px-5 py-3 text-xs font-semibold text-muted md:grid">
            <span>게시글</span>
            <span>작성자</span>
            <span>작성일</span>
          </div>

          {isLoading ? (
            <div className="px-4 py-8 text-center text-sm text-muted">
              게시글 목록을 불러오는 중입니다.
            </div>
          ) : result?.boards.length ? (
            result.boards.map((board) => {
              const isUpdated =
                Boolean(board.updateDate) && board.updateDate !== board.regDate;

              return (
                <article
                  key={board.id}
                  className="border-t border-line first:border-t-0"
                >
                  <Link
                    href={`/notice/${board.id}`}
                    className="block px-4 py-4 transition-colors hover:bg-surface-muted/60 sm:px-5"
                  >
                    <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_120px_180px] md:items-start">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="truncate text-base font-semibold text-foreground">
                            {board.title}
                          </h2>
                          {isUpdated ? (
                            <span className="rounded-full bg-accent-soft px-2 py-1 text-[11px] font-medium text-accent-ink">
                              수정됨
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-2 line-clamp-2 text-sm leading-7 text-muted">
                          {board.summaryText || "본문 요약이 없습니다."}
                        </p>
                      </div>

                      <div className="text-sm text-muted md:text-right">
                        {board.authorName}
                      </div>

                      <div className="text-sm text-muted md:text-right">
                        {formatBoardDateTime(board.regDate)}
                      </div>
                    </div>
                  </Link>
                </article>
              );
            })
          ) : (
            <div className="px-4 py-8 text-center text-sm text-muted">
              {activeKeyword
                ? "검색 조건에 맞는 게시글이 없습니다."
                : "등록된 게시글이 없습니다."}
            </div>
          )}
        </div>

        {result ? (
          <div className="rounded-[26px] border border-line bg-surface-strong p-3">
            <BoardPagination
              disabled={isLoading}
              pagination={result.pagination}
              onNavigate={(page) =>
                navigateToQuery({
                  ...initialQuery,
                  page,
                })
              }
            />
          </div>
        ) : null}
      </div>
    </TabPageShell>
  );
}
