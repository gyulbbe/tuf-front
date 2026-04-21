"use client";

import { useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import {
  BoardNotice,
  alertBoardError,
  readBoardErrorMessage,
  type NoticeState,
} from "@/components/board/board-shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  createBoardComment,
  updateBoardComment,
  type BoardCommentsSnapshot,
} from "@/lib/api/boards";
import { cn } from "@/lib/utils";

type BoardCommentComposerProps = {
  boardId: number;
  className?: string;
  commentId?: number;
  initialAuthorName?: string;
  initialContent?: string;
  mode: "create" | "edit";
  onCancel?: () => void;
  onCommentsChanged: (snapshot: BoardCommentsSnapshot) => void;
  onSuccess?: () => void;
  parentId?: number | null;
  placeholder?: string;
  submitLabel?: string;
};

function validateCommentForm(options: {
  authorName: string;
  content: string;
  isAuthenticated: boolean;
}) {
  const trimmedAuthorName = options.authorName.trim();
  const trimmedContent = options.content.trim();

  if (!options.isAuthenticated) {
    if (!trimmedAuthorName) {
      return "비회원 작성자명을 입력해 주세요.";
    }

    if (trimmedAuthorName.length > 50) {
      return "작성자명은 50자 이하여야 합니다.";
    }
  }

  if (!trimmedContent) {
    return "내용을 입력해 주세요.";
  }

  if (trimmedContent.length > 4000) {
    return "댓글 내용은 4000자 이하여야 합니다.";
  }

  return null;
}

export function BoardCommentComposer({
  boardId,
  className,
  commentId,
  initialAuthorName = "",
  initialContent = "",
  mode,
  onCancel,
  onCommentsChanged,
  onSuccess,
  parentId = null,
  placeholder = "댓글 내용을 입력해 주세요.",
  submitLabel,
}: BoardCommentComposerProps) {
  const { status } = useAuth();
  const [authorName, setAuthorName] = useState(initialAuthorName);
  const [content, setContent] = useState(initialContent);
  const [notice, setNotice] = useState<NoticeState | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isAuthenticated = status === "authenticated";
  const isAuthLoading = status === "loading";
  const resolvedSubmitLabel =
    submitLabel ?? (mode === "create" ? "등록" : "수정");

  return (
    <form
      className={cn("space-y-3", className)}
      onSubmit={async (event) => {
        event.preventDefault();

        if (isAuthLoading) {
          setNotice({
            tone: "neutral",
            text: "로그인 상태를 확인하는 중이다. 잠시 뒤 다시 시도해 주세요.",
          });
          return;
        }

        const validationError = validateCommentForm({
          authorName,
          content,
          isAuthenticated,
        });

        if (validationError) {
          setNotice({
            tone: "error",
            text: validationError,
          });
          return;
        }

        setIsSubmitting(true);
        setNotice(null);

        try {
          const trimmedContent = content.trim();
          let snapshot: BoardCommentsSnapshot;

          if (mode === "create") {
            snapshot = await createBoardComment(boardId, {
              authorName: isAuthenticated ? undefined : authorName.trim(),
              content: trimmedContent,
              parentId,
            });
          } else {
            if (typeof commentId !== "number") {
              throw new Error("수정할 댓글 정보를 찾지 못했습니다.");
            }

            snapshot = await updateBoardComment(boardId, commentId, {
              content: trimmedContent,
            });
          }

          onCommentsChanged(snapshot);

          if (mode === "create") {
            setContent("");
          } else {
            setContent(trimmedContent);
          }

          setNotice(null);
          onSuccess?.();
        } catch (error) {
          setNotice({
            tone: "error",
            text: readBoardErrorMessage(error),
          });
          alertBoardError(error);
        } finally {
          setIsSubmitting(false);
        }
      }}
    >
      {notice ? <BoardNotice notice={notice} /> : null}

      {status === "unauthenticated" ? (
        <Input
          maxLength={50}
          value={authorName}
          onChange={(event) => setAuthorName(event.target.value)}
          placeholder="비회원 작성자명"
        />
      ) : null}

      <Textarea
        maxLength={4000}
        rows={3}
        value={content}
        onChange={(event) => setContent(event.target.value)}
        placeholder={placeholder}
        className="resize-y"
      />

      <div className="flex flex-wrap items-center justify-end gap-2">
        {onCancel ? (
          <Button type="button" size="sm" onClick={onCancel}>
            취소
          </Button>
        ) : null}

        <Button
          type="submit"
          size="sm"
          variant="accent"
          disabled={isSubmitting || isAuthLoading}
        >
          {isSubmitting ? "처리 중..." : resolvedSubmitLabel}
        </Button>
      </div>
    </form>
  );
}
