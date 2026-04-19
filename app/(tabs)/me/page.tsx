import type { Metadata } from "next";
import { AuthPanel } from "@/components/auth/auth-panel";
import { SurfaceCard } from "@/components/site/surface-card";
import { requireServerAuth } from "@/lib/auth/server-auth";

export const metadata: Metadata = {
  title: "내정보",
};

export default async function MePage() {
  await requireServerAuth("/me");

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)]">
      <SurfaceCard className="p-7 sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-accent">
          Account
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          내정보
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-8 text-muted">
          저장된 JWT를 복원해서 현재 로그인 계정과 권한, 만료 시각을 확인하는
          화면이다. 토큰이 만료되거나 401 응답이 오면 자동으로 로그인 페이지로
          이동한다.
        </p>

        <div className="mt-8">
          <AuthPanel />
        </div>
      </SurfaceCard>

      <div className="grid gap-4">
        <SurfaceCard className="p-6">
          <p className="text-sm font-semibold text-foreground">현재 인증 구조</p>
          <p className="mt-3 text-sm leading-7 text-muted">
            로그인 성공 시 응답 헤더의 `Authorization` 값을 `localStorage`와
            동기화된 auth cookie에 저장하고, 앱 시작 시 JWT를 decode해서 auth
            상태를 복원한다.
          </p>
        </SurfaceCard>

        <SurfaceCard className="p-6">
          <p className="text-sm font-semibold text-foreground">처리 방식</p>
          <ul className="mt-4 space-y-3 text-sm leading-7 text-muted">
            <li className="rounded-2xl bg-surface-muted px-4 py-3 text-foreground">
              axios 인스턴스가 인증 헤더 자동 주입
            </li>
            <li className="rounded-2xl bg-surface-muted px-4 py-3 text-foreground">
              exp 기준 자동 만료 처리
            </li>
            <li className="rounded-2xl bg-surface-muted px-4 py-3 text-foreground">
              서버 페이지에서 로그인 여부 확인 후 진입 허용
            </li>
          </ul>
        </SurfaceCard>
      </div>
    </div>
  );
}
