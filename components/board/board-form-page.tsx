"use client";

import { startTransition, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/auth-provider";
import {
  BoardEmptyState,
  BoardLinkButton,
  BoardNotice,
  alertBoardError,
  readBoardErrorMessage,
  type NoticeState,
} from "@/components/board/board-shared";
import { SurfaceCard } from "@/components/site/surface-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  createBoard,
  getBoard,
  updateBoard,
  type BoardDetail,
} from "@/lib/api/boards";

type BoardFormPageProps = {
  boardId?: number;
  mode: "create" | "edit";
};

type BoardFormState = {
  authorName: string;
  text: string;
  title: string;
};

const INITIAL_FORM: BoardFormState = {
  authorName: "",
  text: "",
  title: "",
};

function validateBoardForm(form: BoardFormState, isAuthenticated: boolean) {
  const trimmedAuthorName = form.authorName.trim();
  const trimmedTitle = form.title.trim();
  const trimmedText = form.text.trim();

  if (!isAuthenticated) {
    if (!trimmedAuthorName) {
      return "비회원 작성자명을 입력해 주세요.";
    }

    if (trimmedAuthorName.length > 50) {
      return "작성자명은 50자 이하여야 합니다.";
    }
  }

  if (!trimmedTitle) {
    return "제목을 입력해 주세요.";
  }

  if (trimmedTitle.length > 255) {
    return "제목은 255자 이하여야 합니다.";
  }

  if (!trimmedText) {
    return "본문을 입력해 주세요.";
  }

  return null;
}

export function BoardFormPage({ boardId, mode }: BoardFormPageProps) {
  const router = useRouter();
  const { status } = useAuth();
  const [form, setForm] = useState(INITIAL_FORM);
  const [loadedBoard, setLoadedBoard] = useState<BoardDetail | null>(null);
  const [isLoading, setIsLoading] = useState(mode === "edit");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notice, setNotice] = useState<NoticeState | null>(null);

  const isAuthenticated = status === "authenticated";
  const isAuthLoading = status === "loading";
  const isEditMode = mode === "edit";
  const backHref = isEditMode && boardId ? `/gallery/${boardId}` : "/gallery";
  const cannotEdit = isEditMode && loadedBoard ? !loadedBoard.editable : false;
  const showGuestAuthorField = status === "unauthenticated";

  useEffect(() => {
    if (!isEditMode || typeof boardId !== "number") {
      return;
    }

    const resolvedBoardId = boardId;
    let cancelled = false;

    async function loadBoard() {
      setIsLoading(true);
      setNotice(null);

      try {
        const board = await getBoard(resolvedBoardId);

        if (cancelled) {
          return;
        }

        setLoadedBoard(board);
        setForm((current) => ({
          ...current,
          text: board.text,
          title: board.title,
        }));

        if (!board.editable) {
          setNotice({
            tone: "neutral",
            text: "이 게시글은 수정 권한이 없습니다.",
          });
        }
      } catch (error) {
        if (cancelled) {
          return;
        }

        setLoadedBoard(null);
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
  }, [boardId, isEditMode]);

  return (
    <div className="w-full space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          {isEditMode ? "글 수정" : "글쓰기"}
        </h1>
        <BoardLinkButton href={backHref}>목록으로</BoardLinkButton>
      </div>

      {notice ? <BoardNotice notice={notice} /> : null}

      <SurfaceCard className="p-7 sm:p-8">
        {isLoading ? (
          <BoardEmptyState text="게시글 정보를 불러오는 중이다." />
        ) : cannotEdit ? (
          <div className="flex flex-wrap justify-end gap-2">
            <BoardLinkButton href={backHref}>돌아가기</BoardLinkButton>
            <BoardLinkButton href="/gallery/new" variant="accent">
              글쓰기
            </BoardLinkButton>
          </div>
        ) : isEditMode && !loadedBoard ? (
          <div className="flex flex-wrap justify-end gap-2">
            <BoardLinkButton href="/gallery">목록으로</BoardLinkButton>
          </div>
        ) : (
          <form
            className="max-w-5xl space-y-4"
            onSubmit={async (event) => {
              event.preventDefault();

              if (isAuthLoading) {
                setNotice({
                  tone: "neutral",
                  text: "로그인 상태를 확인하는 중이다. 잠시 뒤 다시 시도해 주세요.",
                });
                return;
              }

              const validationError = validateBoardForm(form, isAuthenticated);

              if (validationError) {
                setNotice({
                  tone: "error",
                  text: validationError,
                });
                return;
              }

              if (isEditMode && typeof boardId !== "number") {
                setNotice({
                  tone: "error",
                  text: "수정할 게시글 정보를 찾지 못했습니다.",
                });
                return;
              }

              setIsSubmitting(true);
              setNotice(null);

              try {
                const title = form.title.trim();
                const text = form.text.trim();
                const board = isEditMode
                  ? await updateBoard(boardId!, {
                      text,
                      title,
                    })
                  : await createBoard(
                      isAuthenticated
                        ? { text, title }
                        : {
                            authorName: form.authorName.trim(),
                            text,
                            title,
                          },
                    );

                startTransition(() => {
                  router.replace(`/gallery/${board.id}`);
                });
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
            {showGuestAuthorField ? (
              <Input
                maxLength={50}
                value={form.authorName}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    authorName: event.target.value,
                  }))
                }
                placeholder="비회원 작성자명"
              />
            ) : null}

            <Input
              maxLength={255}
              value={form.title}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  title: event.target.value,
                }))
              }
              placeholder="제목"
            />

            <Textarea
              rows={16}
              value={form.text}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  text: event.target.value,
                }))
              }
              placeholder="본문"
              className="resize-y"
            />

            <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
              <BoardLinkButton href={backHref}>취소</BoardLinkButton>
              <Button
                type="submit"
                variant="accent"
                disabled={isSubmitting || isAuthLoading}
              >
                {isSubmitting
                  ? "처리 중..."
                  : isEditMode
                    ? "수정 저장"
                    : "등록"}
              </Button>
            </div>
          </form>
        )}
      </SurfaceCard>
    </div>
  );
}
