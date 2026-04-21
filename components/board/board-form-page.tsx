"use client";

import { startTransition, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/auth-provider";
import {
  BoardEmptyState,
  BoardLinkButton,
  BoardNotice,
  type NoticeState,
  alertBoardError,
  formatBoardDateTime,
  readBoardErrorMessage,
} from "@/components/board/board-shared";
import { InfoList } from "@/components/site/info-list";
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
      return "비회원 작성자는 작성자명을 입력해야 합니다.";
    }

    if (trimmedAuthorName.length > 50) {
      return "작성자명은 50자 이하여야 합니다.";
    }
  }

  if (!trimmedTitle) {
    return "제목은 필수입니다.";
  }

  if (trimmedTitle.length > 255) {
    return "제목은 255자 이하여야 합니다.";
  }

  if (!trimmedText) {
    return "본문은 비워둘 수 없습니다.";
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
  const backHref = isEditMode && boardId ? `/notice/${boardId}` : "/notice";
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
            text: "이 게시글은 응답 기준으로 수정 권한이 없습니다.",
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

  const guideItems = isAuthenticated
    ? [
        "로그인 사용자는 작성자명이 계정 이름 기준으로 저장됩니다.",
        "수정/삭제 노출은 응답의 editable, deletable 값만 따릅니다.",
        "제목은 255자, 비회원 작성자명은 50자까지 입력할 수 있습니다.",
      ]
    : [
        "비회원은 작성자명을 직접 입력해야 합니다.",
        "비회원 글과 댓글은 수정/삭제가 불가능합니다.",
        "제목은 255자, 작성자명은 50자까지 입력할 수 있습니다.",
      ];

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)]">
      <SurfaceCard className="p-7 sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-accent">
          Notice
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          {isEditMode ? "게시글 수정" : "게시글 작성"}
        </h1>
        <p className="mt-4 max-w-3xl text-base leading-8 text-muted">
          현재 프론트 프로젝트의 기존 입력 컴포넌트와 레이아웃을 유지한 게시글 폼입니다.
        </p>

        {notice ? <BoardNotice notice={notice} className="mt-6" /> : null}

        {isLoading ? (
          <div className="mt-8">
            <BoardEmptyState text="게시글 정보를 불러오는 중입니다." />
          </div>
        ) : cannotEdit ? (
          <div className="mt-8 flex flex-wrap gap-2">
            <BoardLinkButton href={backHref}>상세로 돌아가기</BoardLinkButton>
            <BoardLinkButton href="/notice/new" variant="accent">
              새 글쓰기
            </BoardLinkButton>
          </div>
        ) : isEditMode && !loadedBoard ? (
          <div className="mt-8 flex flex-wrap gap-2">
            <BoardLinkButton href="/notice">목록으로</BoardLinkButton>
          </div>
        ) : (
          <form
            className="mt-8 space-y-4"
            onSubmit={async (event) => {
              event.preventDefault();

              if (isAuthLoading) {
                setNotice({
                  tone: "neutral",
                  text: "로그인 상태를 확인하는 중입니다. 잠시 후 다시 시도해 주세요.",
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
                  router.replace(`/notice/${board.id}`);
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
            {isAuthLoading ? (
              <div className="rounded-2xl border border-line bg-surface-muted px-4 py-3 text-sm text-muted">
                로그인 상태를 확인하는 중입니다.
              </div>
            ) : isAuthenticated ? (
              <div className="rounded-2xl border border-line bg-surface-muted px-4 py-3 text-sm text-muted">
                작성자명은 현재 로그인 계정 정보 기준으로 처리됩니다.
              </div>
            ) : null}

            {showGuestAuthorField ? (
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-foreground">
                  작성자명
                </span>
                <Input
                  maxLength={50}
                  value={form.authorName}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      authorName: event.target.value,
                    }))
                  }
                  placeholder="비회원 작성자명을 입력해 주세요."
                />
              </label>
            ) : null}

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-foreground">
                제목
              </span>
              <Input
                maxLength={255}
                value={form.title}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    title: event.target.value,
                  }))
                }
                placeholder="제목을 입력해 주세요."
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-foreground">
                본문
              </span>
              <Textarea
                rows={14}
                value={form.text}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    text: event.target.value,
                  }))
                }
                placeholder="본문을 입력해 주세요."
                className="resize-y"
              />
            </label>

            <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
              <BoardLinkButton href={backHref}>취소</BoardLinkButton>
              <Button
                type="submit"
                variant="accent"
                disabled={isSubmitting || isAuthLoading}
              >
                {isSubmitting
                  ? isEditMode
                    ? "저장 중..."
                    : "등록 중..."
                  : isEditMode
                    ? "수정 저장"
                    : "등록하기"}
              </Button>
            </div>
          </form>
        )}
      </SurfaceCard>

      <div className="grid gap-4">
        <SurfaceCard className="p-6">
          <p className="text-sm font-semibold text-foreground">작성 안내</p>
          <InfoList items={guideItems} />
        </SurfaceCard>

        {loadedBoard ? (
          <SurfaceCard className="p-6">
            <p className="text-sm font-semibold text-foreground">기존 정보</p>
            <div className="mt-4 space-y-3 text-sm leading-7 text-muted">
              <p>
                작성자{" "}
                <span className="font-medium text-foreground">
                  {loadedBoard.authorName}
                </span>
              </p>
              <p>작성일 {formatBoardDateTime(loadedBoard.regDate)}</p>
              <p>수정일 {formatBoardDateTime(loadedBoard.updateDate)}</p>
              <p>댓글 수 {loadedBoard.commentCount}</p>
            </div>
          </SurfaceCard>
        ) : null}
      </div>
    </div>
  );
}
