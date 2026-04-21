"use client";

import { useState } from "react";
import { BoardCommentComposer } from "@/components/board/board-comment-composer";
import {
  BoardEmptyState,
  alertBoardError,
  formatBoardDateTime,
} from "@/components/board/board-shared";
import { Button } from "@/components/ui/button";
import { deleteBoardComment, type BoardComment } from "@/lib/api/boards";
import { cn } from "@/lib/utils";

type BoardCommentThreadProps = {
  boardId: number;
  comments: BoardComment[];
  onCommentsChanged: () => Promise<void>;
};

function buildCommentDeleteConfirmText() {
  return ["이 댓글을 삭제할까요?", "", "하위 대댓글도 함께 삭제됩니다."].join(
    "\n",
  );
}

function BoardCommentItem({
  boardId,
  comment,
  onCommentsChanged,
}: {
  boardId: number;
  comment: BoardComment;
  onCommentsChanged: () => Promise<void>;
}) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isReplying, setIsReplying] = useState(false);

  const isUpdated =
    Boolean(comment.updateDate) && comment.updateDate !== comment.regDate;

  return (
    <div
      className="space-y-3"
      style={{ marginLeft: `${comment.depth * 16}px` }}
    >
      <article
        className={cn(
          "rounded-[24px] border border-line bg-surface-strong p-4",
          comment.depth > 0 && "border-l-4 border-l-accent-soft",
        )}
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-sm text-muted">
              <span className="font-semibold text-foreground">
                {comment.authorName}
              </span>
              <span>{formatBoardDateTime(comment.regDate)}</span>
              {isUpdated ? (
                <span className="rounded-full bg-accent-soft px-2 py-1 text-[11px] font-medium text-accent-ink">
                  수정됨
                </span>
              ) : null}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              onClick={() => {
                setIsReplying((current) => !current);
                setIsEditing(false);
              }}
            >
              답글
            </Button>

            {comment.editable ? (
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  setIsEditing((current) => !current);
                  setIsReplying(false);
                }}
              >
                수정
              </Button>
            ) : null}

            {comment.deletable ? (
              <Button
                type="button"
                size="sm"
                variant="danger"
                disabled={isDeleting}
                onClick={async () => {
                  if (!window.confirm(buildCommentDeleteConfirmText())) {
                    return;
                  }

                  setIsDeleting(true);

                  try {
                    await deleteBoardComment(boardId, comment.id);
                    await onCommentsChanged();
                    setIsEditing(false);
                    setIsReplying(false);
                  } catch (error) {
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

        {isEditing ? (
          <div className="mt-4 rounded-[22px] border border-dashed border-line bg-surface-muted/60 p-4">
            <BoardCommentComposer
              boardId={boardId}
              commentId={comment.id}
              mode="edit"
              initialContent={comment.content}
              onCancel={() => setIsEditing(false)}
              onCommentsChanged={onCommentsChanged}
              onSuccess={() => setIsEditing(false)}
              placeholder="수정할 댓글 내용을 입력해 주세요."
              submitLabel="수정 저장"
            />
          </div>
        ) : (
          <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-foreground">
            {comment.content}
          </p>
        )}
      </article>

      {isReplying ? (
        <div className="rounded-[22px] border border-dashed border-line bg-surface-muted/60 p-4">
          <BoardCommentComposer
            boardId={boardId}
            mode="create"
            parentId={comment.id}
            onCancel={() => setIsReplying(false)}
            onCommentsChanged={onCommentsChanged}
            onSuccess={() => setIsReplying(false)}
            placeholder="대댓글 내용을 입력해 주세요."
            submitLabel="답글 등록"
          />
        </div>
      ) : null}

      {comment.children.length ? (
        <div className="space-y-3">
          {comment.children.map((child) => (
            <BoardCommentItem
              key={child.id}
              boardId={boardId}
              comment={child}
              onCommentsChanged={onCommentsChanged}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function BoardCommentThread({
  boardId,
  comments,
  onCommentsChanged,
}: BoardCommentThreadProps) {
  if (!comments.length) {
    return <BoardEmptyState text="등록된 댓글이 없습니다." />;
  }

  return (
    <div className="space-y-3">
      {comments.map((comment) => (
        <BoardCommentItem
          key={comment.id}
          boardId={boardId}
          comment={comment}
          onCommentsChanged={onCommentsChanged}
        />
      ))}
    </div>
  );
}
