"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { createPortal } from "react-dom";
import { loginAction } from "@/app/actions/auth";
import { AuthSubmitButton } from "@/components/auth/auth-submit-button";
import {
  initialAuthActionState,
  type AuthActionState,
} from "@/lib/auth/auth-action-state";
import type { PublicUser } from "@/lib/auth/users";

type HeaderAuthButtonProps = {
  user: PublicUser | null;
};

function AuthMessage({ state }: { state: AuthActionState }) {
  if (state.status === "idle" || !state.message) {
    return null;
  }

  const toneClass =
    state.status === "success"
      ? "border-success-soft bg-success-soft text-success-ink"
      : "border-danger-soft bg-danger-soft text-danger-ink";

  return (
    <p
      aria-live="polite"
      className={[
        "rounded-2xl border px-4 py-3 text-sm leading-6",
        toneClass,
      ].join(" ")}
    >
      {state.message}
    </p>
  );
}

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
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-accent">
                    Login
                  </p>
                  <h2 className="mt-3 text-2xl font-semibold tracking-tight text-foreground">
                    간단 로그인
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-full border border-line px-3 py-1 text-sm text-muted transition-colors hover:border-accent-soft hover:bg-surface-strong hover:text-foreground"
                  aria-label="로그인 팝업 닫기"
                >
                  닫기
                </button>
              </div>

              <p className="mt-4 text-sm leading-7 text-muted">
                관리자가 등록한 계정으로 로그인합니다.
              </p>

              <form action={formAction} className="mt-6 space-y-4">
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-foreground">
                    아이디
                  </span>
                  <input
                    required
                    name="username"
                    autoComplete="username"
                    placeholder="등록된 아이디"
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
                    placeholder="비밀번호 입력"
                    className="w-full rounded-2xl border border-line bg-surface-strong px-4 py-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted focus:border-accent-soft focus:bg-white"
                  />
                </label>

                <AuthMessage state={state} />

                <AuthSubmitButton
                  idleText="로그인"
                  pendingText="로그인 중..."
                />
              </form>

              <div className="mt-5 rounded-2xl bg-surface-muted px-4 py-4 text-sm leading-7 text-muted">
                계정이 필요하면 관리자에게 요청해 주세요.
              </div>
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
