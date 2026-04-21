"use client";

import { useState } from "react";
import { BoardCommentComposer } from "@/components/board/board-comment-composer";
import {
  BoardEmptyState,
  alertBoardError,
  formatBoardDateTime,
  getBoardAuthorLabel,
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
  return ["댓글을 삭제할까?", "", "하위 답글도 함께 삭제돼."].join("\n");
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

  return (
    <div className="space-y-2" style={{ marginLeft: `${comment.depth * 12}px` }}>
      <article
        className={cn(
          "rounded-2xl border border-line bg-surface-strong px-4 py-3",
          comment.depth > 0 && "border-l-4 border-l-accent-soft",
        )}
      >
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
              <span className="font-semibold text-foreground">
                {getBoardAuthorLabel(comment.authorUserId)}
              </span>
              <span>{formatBoardDateTime(comment.regDate)}</span>
            </div>
          </div>

          <div className="flex flex-wrap gap-1">
            <Button
              type="button"
              size="sm"
              className="px-3 py-1.5 text-xs"
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
                className="px-3 py-1.5 text-xs"
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
                className="px-3 py-1.5 text-xs"
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
          <div className="mt-3 border-t border-dashed border-line pt-3">
            <BoardCommentComposer
              boardId={boardId}
              commentId={comment.id}
              mode="edit"
              initialContent={comment.content}
              onCancel={() => setIsEditing(false)}
              onCommentsChanged={onCommentsChanged}
              onSuccess={() => setIsEditing(false)}
              placeholder="수정할 내용을 입력해 줘."
              submitLabel="수정"
            />
          </div>
        ) : (
          <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-foreground">
            {comment.content}
          </p>
        )}
      </article>

      {isReplying ? (
        <div className="border-l border-dashed border-line pl-3">
          <BoardCommentComposer
            boardId={boardId}
            mode="create"
            parentId={comment.id}
            onCancel={() => setIsReplying(false)}
            onCommentsChanged={onCommentsChanged}
            onSuccess={() => setIsReplying(false)}
            placeholder="답글 내용을 입력해 줘."
            submitLabel="등록"
          />
        </div>
      ) : null}

      {comment.children.length ? (
        <div className="space-y-2">
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
    return <BoardEmptyState className="py-6" text="등록된 댓글이 없어." />;
  }

  return (
    <div className="space-y-2">
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
