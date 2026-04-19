"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/auth-provider";
import { SurfaceCard } from "@/components/site/surface-card";

function formatExpiration(exp: number) {
  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "long",
    timeStyle: "short",
  }).format(new Date(exp * 1000));
}

export function AuthPanel() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  if (!user) {
    return null;
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
      <SurfaceCard className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-foreground">
              현재 로그인된 계정
            </p>
            <p className="mt-2 text-sm leading-7 text-muted">
              JWT claim에서 복원한 사용자 정보다. 앱을 다시 열어도 저장된 토큰이
              유효하면 자동으로 로그인 상태를 되살린다.
            </p>
          </div>

          <span
            className="h-14 w-14 rounded-full border border-line bg-surface-muted bg-cover bg-center"
            style={
              user.photo
                ? {
                    backgroundImage: `url("${user.photo}")`,
                  }
                : undefined
            }
            aria-hidden="true"
          />
        </div>

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
              권한
            </p>
            <p className="mt-2 text-base font-semibold text-foreground">
              {user.role}
            </p>
          </div>
          <div className="rounded-2xl bg-surface-muted px-4 py-4 sm:col-span-2">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
              만료 시각
            </p>
            <p className="mt-2 text-base font-semibold text-foreground">
              {formatExpiration(user.exp)}
            </p>
          </div>
        </div>
      </SurfaceCard>

      <SurfaceCard className="flex flex-col justify-between p-6">
        <div>
          <p className="text-sm font-semibold text-foreground">세션 관리</p>
          <p className="mt-3 text-sm leading-7 text-muted">
            인증 요청에는 `Authorization` 헤더가 자동으로 붙고, 401 또는 만료가
            감지되면 로그인 페이지로 이동한다.
          </p>
        </div>

        <button
          type="button"
          disabled={isLoggingOut}
          onClick={() => {
            setIsLoggingOut(true);
            logout();
            router.replace("/notice");
          }}
          className="mt-6 inline-flex w-full items-center justify-center rounded-full bg-accent px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-accent-ink disabled:cursor-not-allowed disabled:bg-accent/70"
        >
          {isLoggingOut ? "로그아웃 중..." : "로그아웃"}
        </button>
      </SurfaceCard>
    </div>
  );
}
