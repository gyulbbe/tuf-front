"use client";

import { startTransition, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BoardCommentComposer } from "@/components/board/board-comment-composer";
import { BoardCommentThread } from "@/components/board/board-comment-thread";
import {
  BoardEmptyState,
  BoardLinkButton,
  BoardNotice,
  type NoticeState,
  alertBoardError,
  countBoardComments,
  formatBoardDateTime,
  readBoardErrorMessage,
} from "@/components/board/board-shared";
import { SurfaceCard } from "@/components/site/surface-card";
import { Button } from "@/components/ui/button";
import {
  deleteBoard,
  getBoard,
  listBoardComments,
  type BoardDetail,
} from "@/lib/api/boards";

type BoardDetailPageProps = {
  boardId: number;
};

function buildBoardDeleteConfirmText(title: string) {
  return [
    `"${title}" 게시글을 삭제할까요?`,
    "",
    "게시글과 하위 댓글이 함께 삭제됩니다.",
    "삭제 후에는 되돌릴 수 없습니다.",
  ].join("\n");
}

export function BoardDetailPage({ boardId }: BoardDetailPageProps) {
  const router = useRouter();
  const [board, setBoard] = useState<BoardDetail | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshingComments, setIsRefreshingComments] = useState(false);
  const [notice, setNotice] = useState<NoticeState | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadBoard() {
      setIsLoading(true);
      setNotice(null);

      try {
        const nextBoard = await getBoard(boardId);

        if (cancelled) {
          return;
        }

        setBoard(nextBoard);
      } catch (error) {
        if (cancelled) {
          return;
        }

        setBoard(null);
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

    void loadBoard();

    return () => {
      cancelled = true;
    };
  }, [boardId]);

  async function refreshComments(options?: { suppressAlert?: boolean }) {
    setIsRefreshingComments(true);

    try {
      const comments = await listBoardComments(boardId);

      setBoard((current) =>
        current
          ? {
              ...current,
              comments,
              commentCount: countBoardComments(comments),
            }
          : current,
      );
      setNotice(null);
    } catch (error) {
      setNotice({
        tone: "error",
        text: readBoardErrorMessage(error),
      });

      if (!options?.suppressAlert) {
        alertBoardError(error);
      }
    } finally {
      setIsRefreshingComments(false);
    }
  }

  if (isLoading) {
    return (
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)]">
        <SurfaceCard className="p-7 sm:p-8">
          <BoardEmptyState text="게시글을 불러오는 중입니다." />
        </SurfaceCard>
        <div className="grid gap-4">
          <SurfaceCard className="p-6">
            <BoardEmptyState text="게시글 정보를 준비하는 중입니다." />
          </SurfaceCard>
        </div>
      </div>
    );
  }

  if (!board) {
    return (
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)]">
        <SurfaceCard className="p-7 sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-accent">
            Notice
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            게시글 상세
          </h1>
          {notice ? (
            <BoardNotice notice={notice} className="mt-6" />
          ) : (
            <BoardEmptyState className="mt-6" text="게시글을 찾지 못했습니다." />
          )}
        </SurfaceCard>

        <div className="grid gap-4">
          <SurfaceCard className="p-6">
            <BoardLinkButton href="/notice" fullWidth>
              목록으로
            </BoardLinkButton>
          </SurfaceCard>
        </div>
      </div>
    );
  }

  const isUpdated = Boolean(board.updateDate) && board.updateDate !== board.regDate;

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)]">
      <div className="space-y-4">
        <SurfaceCard className="p-7 sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-accent">
            Notice
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            {board.title}
          </h1>

          <div className="mt-4 flex flex-wrap items-center gap-2 text-sm text-muted">
            <span className="font-medium text-foreground">{board.authorName}</span>
            <span>{formatBoardDateTime(board.regDate)}</span>
            {isUpdated ? <span>수정 {formatBoardDateTime(board.updateDate)}</span> : null}
            <span>댓글 {board.commentCount}개</span>
          </div>

          {notice ? <BoardNotice notice={notice} className="mt-6" /> : null}

          <div className="mt-8 whitespace-pre-wrap text-sm leading-8 text-foreground">
            {board.text}
          </div>
        </SurfaceCard>

        <SurfaceCard className="p-6 sm:p-7">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold text-foreground">댓글</h2>
              <p className="mt-1 text-sm text-muted">
                대댓글은 백엔드가 내려준 트리 순서를 그대로 렌더링합니다.
              </p>
            </div>

            <Button
              type="button"
              size="sm"
              disabled={isRefreshingComments}
              onClick={() => void refreshComments()}
            >
              {isRefreshingComments ? "새로고침 중..." : "댓글 새로고침"}
            </Button>
          </div>

          <div className="mt-6 rounded-[24px] border border-line bg-surface-muted/50 p-4">
            <p className="text-sm font-semibold text-foreground">댓글 남기기</p>
            <p className="mt-2 text-xs leading-6 text-muted">
              비회원은 작성자명을 입력해야 하고, 로그인 사용자는 계정 이름으로 저장됩니다.
            </p>
            <BoardCommentComposer
              boardId={board.id}
              className="mt-4"
              mode="create"
              parentId={null}
              onCommentsChanged={() => refreshComments({ suppressAlert: true })}
              showAuthenticatedHint
            />
          </div>

          <div className="mt-6">
            <BoardCommentThread
              boardId={board.id}
              comments={board.comments}
              onCommentsChanged={() => refreshComments({ suppressAlert: true })}
            />
          </div>
        </SurfaceCard>
      </div>

      <div className="grid gap-4">
        <SurfaceCard className="p-6">
          <p className="text-sm font-semibold text-foreground">바로가기</p>
          <div className="mt-4 grid gap-2">
            <BoardLinkButton href="/notice" fullWidth>
              목록으로
            </BoardLinkButton>
            <BoardLinkButton href="/notice/new" fullWidth variant="accent">
              글쓰기
            </BoardLinkButton>
            {board.editable ? (
              <BoardLinkButton href={`/notice/${board.id}/edit`} fullWidth>
                수정
              </BoardLinkButton>
            ) : null}
            {board.deletable ? (
              <Button
                type="button"
                fullWidth
                variant="danger"
                disabled={isDeleting}
                onClick={async () => {
                  if (!window.confirm(buildBoardDeleteConfirmText(board.title))) {
                    return;
                  }

                  setIsDeleting(true);

                  try {
                    await deleteBoard(board.id);
                    startTransition(() => {
                      router.replace("/notice");
                    });
                  } catch (error) {
                    setNotice({
                      tone: "error",
                      text: readBoardErrorMessage(error),
                    });
                    alertBoardError(error);
                  } finally {
                    setIsDeleting(false);
                  }
                }}
              >
                {isDeleting ? "삭제 중..." : "삭제"}
              </Button>
            ) : null}
          </div>
        </SurfaceCard>

        <SurfaceCard className="p-6">
          <p className="text-sm font-semibold text-foreground">게시글 정보</p>
          <div className="mt-4 space-y-3 text-sm leading-7 text-muted">
            <p>
              작성자 <span className="font-medium text-foreground">{board.authorName}</span>
            </p>
            <p>작성일 {formatBoardDateTime(board.regDate)}</p>
            <p>수정일 {formatBoardDateTime(board.updateDate)}</p>
            <p>댓글 수 {board.commentCount}</p>
          </div>
        </SurfaceCard>
      </div>
    </div>
  );
}
