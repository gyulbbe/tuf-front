"use client";

import { useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import {
  BoardNotice,
  type NoticeState,
  alertBoardError,
  readBoardErrorMessage,
} from "@/components/board/board-shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { createBoardComment, updateBoardComment } from "@/lib/api/boards";
import { cn } from "@/lib/utils";

type BoardCommentComposerProps = {
  boardId: number;
  className?: string;
  commentId?: number;
  initialAuthorName?: string;
  initialContent?: string;
  mode: "create" | "edit";
  onCancel?: () => void;
  onCommentsChanged: () => Promise<void>;
  onSuccess?: () => void;
  parentId?: number | null;
  placeholder?: string;
  showAuthenticatedHint?: boolean;
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
      return "비회원 작성자는 작성자명을 입력해야 합니다.";
    }

    if (trimmedAuthorName.length > 50) {
      return "작성자명은 50자 이하여야 합니다.";
    }
  }

  if (!trimmedContent) {
    return "댓글 내용은 비워둘 수 없습니다.";
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
  showAuthenticatedHint = false,
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
    submitLabel ?? (mode === "create" ? "댓글 등록" : "댓글 저장");

  return (
    <form
      className={cn("space-y-3", className)}
      onSubmit={async (event) => {
        event.preventDefault();

        if (isAuthLoading) {
          setNotice({
            tone: "neutral",
            text: "로그인 상태를 확인하는 중입니다. 잠시 후 다시 시도해 주세요.",
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

          if (mode === "create") {
            await createBoardComment(boardId, {
              authorName: isAuthenticated ? undefined : authorName.trim(),
              content: trimmedContent,
              parentId,
            });
          } else {
            if (typeof commentId !== "number") {
              throw new Error("수정할 댓글 정보를 찾지 못했습니다.");
            }

            await updateBoardComment(boardId, commentId, {
              content: trimmedContent,
            });
          }

          await onCommentsChanged();

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

      {isAuthLoading ? (
        <div className="rounded-2xl border border-line bg-surface-muted px-4 py-3 text-sm text-muted">
          로그인 상태를 확인하는 중입니다.
        </div>
      ) : null}

      {status === "unauthenticated" ? (
        <label className="block">
          <span className="mb-2 block text-sm font-medium text-foreground">
            작성자명
          </span>
          <Input
            maxLength={50}
            value={authorName}
            onChange={(event) => setAuthorName(event.target.value)}
            placeholder="비회원 작성자명을 입력해 주세요."
          />
        </label>
      ) : null}

      {isAuthenticated && showAuthenticatedHint ? (
        <p className="rounded-2xl border border-line bg-surface-muted px-4 py-3 text-xs leading-6 text-muted">
          로그인 사용자는 작성자명이 계정 정보 기준으로 저장됩니다.
        </p>
      ) : null}

      <label className="block">
        <span className="mb-2 block text-sm font-medium text-foreground">
          댓글
        </span>
        <Textarea
          maxLength={4000}
          rows={4}
          value={content}
          onChange={(event) => setContent(event.target.value)}
          placeholder={placeholder}
          className="resize-y"
        />
      </label>

      <div className="flex flex-wrap items-center justify-end gap-2">
        {onCancel ? (
          <Button
            type="button"
            size="sm"
            onClick={onCancel}
          >
            취소
          </Button>
        ) : null}

        <Button
          type="submit"
          size="sm"
          variant="accent"
          disabled={isSubmitting || isAuthLoading}
        >
          {isSubmitting
            ? mode === "create"
              ? "등록 중..."
              : "저장 중..."
            : resolvedSubmitLabel}
        </Button>
      </div>
    </form>
  );
}
