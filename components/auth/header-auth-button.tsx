"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { createPortal } from "react-dom";
import { loginAction } from "@/app/actions/auth";
import { AuthSubmitButton } from "@/components/auth/auth-submit-button";
import { initialAuthActionState } from "@/lib/auth/auth-action-state";
import type { PublicUser } from "@/lib/auth/users";

type HeaderAuthButtonProps = {
  user: PublicUser | null;
};

export function HeaderAuthButton({ user }: HeaderAuthButtonProps) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(
    loginAction,
    initialAuthActionState,
  );
  const showModal = open && state.status !== "success";

  if (user) {
    return (
      <Link
        href="/me"
        className="inline-flex rounded-full border border-line px-4 py-2 text-sm text-muted transition-colors hover:border-accent-soft hover:bg-surface-strong hover:text-foreground"
      >
        내정보
      </Link>
    );
  }

  const modal =
    showModal && typeof document !== "undefined"
      ? createPortal(
          <div
            className="fixed inset-0 z-[100] flex items-start justify-center bg-black/28 px-4 py-10 backdrop-blur-[2px] sm:items-center"
            onClick={() => setOpen(false)}
          >
            <div
              className="w-full max-w-md rounded-[28px] border border-line bg-surface p-6 shadow-[0_24px_80px_-40px_rgba(31,42,40,0.7)] backdrop-blur-xl"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-4">
                <h2 className="text-2xl font-semibold tracking-tight text-foreground">
                  로그인
                </h2>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-full border border-line px-3 py-1 text-sm text-muted transition-colors hover:border-accent-soft hover:bg-surface-strong hover:text-foreground"
                  aria-label="닫기"
                >
                  닫기
                </button>
              </div>

              <form action={formAction} className="mt-6 space-y-4">
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-foreground">
                    아이디
                  </span>
                  <input
                    required
                    name="username"
                    autoComplete="username"
                    className="w-full rounded-2xl border border-line bg-surface-strong px-4 py-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted focus:border-accent-soft focus:bg-white"
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-foreground">
                    비밀번호
                  </span>
                  <input
                    required
                    type="password"
                    name="password"
                    autoComplete="current-password"
                    className="w-full rounded-2xl border border-line bg-surface-strong px-4 py-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted focus:border-accent-soft focus:bg-white"
                  />
                </label>

                <AuthSubmitButton
                  idleText="로그인"
                  pendingText="로그인"
                />
              </form>
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex rounded-full border border-line px-4 py-2 text-sm text-muted transition-colors hover:border-accent-soft hover:bg-surface-strong hover:text-foreground"
      >
        로그인
      </button>

      {modal}
    </>
  );
}
