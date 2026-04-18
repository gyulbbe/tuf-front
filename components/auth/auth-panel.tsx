"use client";

import { useActionState } from "react";
import { loginAction, logoutAction } from "@/app/actions/auth";
import { AuthSubmitButton } from "@/components/auth/auth-submit-button";
import { SurfaceCard } from "@/components/site/surface-card";
import {
  initialAuthActionState,
  type AuthActionState,
} from "@/lib/auth/auth-action-state";
import type { PublicUser } from "@/lib/auth/users";

type AuthPanelProps = {
  user: PublicUser | null;
};

function AuthMessage({ state }: { state: AuthActionState }) {
  if (state.status === "idle" || !state.message) {
    return null;
  }

  const stateClass =
    state.status === "success"
      ? "border-success-soft bg-success-soft text-success-ink"
      : "border-danger-soft bg-danger-soft text-danger-ink";

  return (
    <p
      aria-live="polite"
      className={[
        "mt-4 rounded-2xl border px-4 py-3 text-sm leading-6",
        stateClass,
      ].join(" ")}
    >
      {state.message}
    </p>
  );
}

export function AuthPanel({ user }: AuthPanelProps) {
  const [loginState, loginFormAction, loginPending] = useActionState(
    loginAction,
    initialAuthActionState,
  );

  if (user) {
    const joinedDate = new Intl.DateTimeFormat("ko-KR", {
      dateStyle: "long",
    }).format(new Date(user.createdAt));

    return (
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <SurfaceCard className="p-6">
          <p className="text-sm font-semibold text-foreground">
            현재 로그인된 계정
          </p>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl bg-surface-muted px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
                아이디
              </p>
              <p className="mt-2 text-base font-semibold text-foreground">
                {user.username}
              </p>
            </div>
            <div className="rounded-2xl bg-surface-muted px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
                닉네임
              </p>
              <p className="mt-2 text-base font-semibold text-foreground">
                {user.nickname}
              </p>
            </div>
            <div className="rounded-2xl bg-surface-muted px-4 py-4 sm:col-span-2">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
                등록일
              </p>
              <p className="mt-2 text-base font-semibold text-foreground">
                {joinedDate}
              </p>
            </div>
          </div>
        </SurfaceCard>

        <SurfaceCard className="flex flex-col justify-between p-6">
          <div>
            <p className="text-sm font-semibold text-foreground">세션 관리</p>
            <p className="mt-3 text-sm leading-7 text-muted">
              현재 브라우저에는 로그인 세션이 유지되고 있습니다. 로그아웃하면
              지금 세션만 정리됩니다.
            </p>
          </div>

          <form action={logoutAction} className="mt-6">
            <AuthSubmitButton
              idleText="로그아웃"
              pendingText="로그아웃 중..."
            />
          </form>
        </SurfaceCard>
      </div>
    );
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_280px]">
      <SurfaceCard className="p-6">
        <h2 className="text-xl font-semibold text-foreground">로그인</h2>
        <p className="mt-3 text-sm leading-7 text-muted">
          관리자가 미리 등록한 계정으로 로그인합니다.
        </p>

        <form action={loginFormAction} className="mt-6 space-y-4">
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

          <AuthMessage state={loginState} />

          <AuthSubmitButton
            idleText="로그인"
            pendingText="로그인 중..."
            pending={loginPending}
          />
        </form>
      </SurfaceCard>

        <SurfaceCard className="p-6">
          <p className="text-sm font-semibold text-foreground">안내</p>
          <p className="mt-3 text-sm leading-7 text-muted">
            새 계정이 필요하면 관리자에게 요청해 주세요. 계정은 직접 등록
            방식으로 운영합니다.
          </p>
        </SurfaceCard>
      </div>
    );
  }
