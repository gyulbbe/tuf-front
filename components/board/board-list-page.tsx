"use client";

import Link from "next/link";
import { startTransition, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BoardPagination } from "@/components/board/board-pagination";
import {
  BoardEmptyState,
  BoardLinkButton,
  BoardNotice,
  alertBoardError,
  buildBoardListHref,
  formatBoardDateTime,
  getBoardAuthorLabel,
  readBoardErrorMessage,
  type BoardListQuery,
  type NoticeState,
} from "@/components/board/board-shared";
import { SurfaceCard } from "@/components/site/surface-card";
import { listBoards, type BoardListData } from "@/lib/api/boards";

type BoardListPageProps = {
  initialQuery: BoardListQuery;
};

export function BoardListPage({ initialQuery }: BoardListPageProps) {
  const router = useRouter();
  const queryKeyword = initialQuery.keyword;
  const queryPage = initialQuery.page;
  const querySearchType = initialQuery.searchType;
  const querySize = initialQuery.size;
  const [notice, setNotice] = useState<NoticeState | null>(null);
  const [result, setResult] = useState<BoardListData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

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

  function navigateToPage(page: number) {
    startTransition(() => {
      router.push(
        buildBoardListHref({
          ...initialQuery,
          page,
        }),
      );
    });
  }

  const activeKeyword = queryKeyword.trim();

  return (
    <div className="w-full space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          터프 갤러리
        </h1>
        <BoardLinkButton href="/gallery/new" variant="accent">
          글쓰기
        </BoardLinkButton>
      </div>

      {notice ? <BoardNotice notice={notice} /> : null}

      <SurfaceCard className="overflow-hidden p-0">
        <div className="hidden grid-cols-[minmax(0,1fr)_160px_190px] gap-3 border-b border-line bg-surface-muted px-5 py-4 text-sm font-semibold text-foreground md:grid">
          <span>제목</span>
          <span className="text-center">작성자</span>
          <span className="text-right">작성일</span>
        </div>

        {isLoading ? (
          <div className="px-5 py-12 text-center text-sm text-muted">
            게시글 목록을 불러오는 중이야.
          </div>
        ) : result?.boards.length ? (
          <div>
            {result.boards.map((board) => (
              <article key={board.id} className="border-t border-line first:border-t-0">
                <Link
                  href={`/gallery/${board.id}`}
                  className="block px-5 py-4 transition-colors hover:bg-surface-muted/50"
                >
                  <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_160px_190px] md:gap-3">
                    <span className="truncate text-base font-medium text-foreground">
                      {board.title}
                    </span>
                    <span className="truncate text-sm text-muted md:text-center">
                      {getBoardAuthorLabel(board.authorUserId)}
                    </span>
                    <span className="text-sm text-muted md:text-right">
                      {formatBoardDateTime(board.regDate)}
                    </span>
                  </div>
                </Link>
              </article>
            ))}
          </div>
        ) : (
          <BoardEmptyState
            className="rounded-none border-0"
            text={
              activeKeyword
                ? "검색 조건에 맞는 게시글이 없어."
                : "등록된 게시글이 없어."
            }
          />
        )}
      </SurfaceCard>

      {result ? (
        <SurfaceCard className="p-4">
          <BoardPagination
            disabled={isLoading}
            pagination={result.pagination}
            onNavigate={navigateToPage}
          />
        </SurfaceCard>
      ) : null}
    </div>
  );
}
