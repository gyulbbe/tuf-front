"use client";

import { startTransition, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BoardCommentComposer } from "@/components/board/board-comment-composer";
import { BoardCommentThread } from "@/components/board/board-comment-thread";
import {
  BoardEmptyState,
  BoardLinkButton,
  BoardNotice,
  alertBoardError,
  formatBoardDateTime,
  getBoardAuthorLabel,
  readBoardErrorMessage,
  type NoticeState,
} from "@/components/board/board-shared";
import { SurfaceCard } from "@/components/site/surface-card";
import { Button } from "@/components/ui/button";
import {
  deleteBoard,
  getBoard,
  type BoardCommentsSnapshot,
  type BoardDetail,
} from "@/lib/api/boards";

type BoardDetailPageProps = {
  boardId: number;
};

function buildBoardDeleteConfirmText(title: string) {
  return [
    `"${title}" 게시글을 삭제할까?`,
    "",
    "게시글과 하위 댓글이 함께 삭제돼.",
    "삭제 후에는 복구할 수 없어.",
  ].join("\n");
}

export function BoardDetailPage({ boardId }: BoardDetailPageProps) {
  const router = useRouter();
  const [board, setBoard] = useState<BoardDetail | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
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

  function applyCommentsSnapshot(snapshot: BoardCommentsSnapshot) {
    setBoard((current) =>
      current
        ? {
            ...current,
            comments: snapshot.comments,
            commentCount: snapshot.commentCount,
          }
        : current,
    );
    setNotice(null);
  }

  if (isLoading) {
    return (
      <div className="w-full">
        <SurfaceCard className="p-7 sm:p-8">
          <BoardEmptyState text="게시글을 불러오는 중이야." />
        </SurfaceCard>
      </div>
    );
  }

  if (!board) {
    return (
      <div className="w-full space-y-4">
        {notice ? <BoardNotice notice={notice} /> : null}
        <SurfaceCard className="p-7 sm:p-8">
          <BoardEmptyState text="게시글을 찾지 못했어." />
        </SurfaceCard>
        <div className="flex justify-end">
          <BoardLinkButton href="/gallery">목록으로</BoardLinkButton>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full space-y-4">
      {notice ? <BoardNotice notice={notice} /> : null}

      <SurfaceCard className="p-7 sm:p-8">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          {board.title}
        </h1>
        <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-muted">
          <span>{getBoardAuthorLabel(board.authorUserId)}</span>
          <span>{formatBoardDateTime(board.regDate)}</span>
          <span>댓글 {board.commentCount}개</span>
        </div>
        <div className="mt-8 max-w-5xl whitespace-pre-wrap text-base leading-8 text-foreground">
          {board.text}
        </div>
      </SurfaceCard>

      <SurfaceCard className="p-4 sm:p-5">
        <BoardCommentComposer
          boardId={board.id}
          mode="create"
          parentId={null}
          onCommentsChanged={applyCommentsSnapshot}
        />

        <div className="mt-4 border-t border-line pt-4">
          <BoardCommentThread
            boardId={board.id}
            comments={board.comments}
            onCommentsChanged={applyCommentsSnapshot}
          />
        </div>
      </SurfaceCard>

      <div className="flex flex-wrap justify-end gap-2">
        <BoardLinkButton href="/gallery">목록으로</BoardLinkButton>
        <BoardLinkButton href="/gallery/new" variant="accent">
          글쓰기
        </BoardLinkButton>
        {board.editable ? (
          <BoardLinkButton href={`/gallery/${board.id}/edit`}>수정</BoardLinkButton>
        ) : null}
        {board.deletable ? (
          <Button
            type="button"
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
                  router.replace("/gallery");
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
    </div>
  );
}
