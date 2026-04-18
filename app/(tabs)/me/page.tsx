import type { Metadata } from "next";
import { AuthPanel } from "@/components/auth/auth-panel";
import { SurfaceCard } from "@/components/site/surface-card";
import { getSessionUser } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "내정보",
};

export default async function MePage() {
  const currentUser = await getSessionUser();

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
          이 탭에서는 로그인 상태와 내 계정 정보를 확인할 수 있습니다. 계정은
          관리자가 직접 추가하는 방식으로 운영하고, 일반 사용자는 로그인만
          진행하도록 구성했습니다.
        </p>

        <div className="mt-8">
          <AuthPanel user={currentUser} />
        </div>
      </SurfaceCard>

      <div className="grid gap-4">
        <SurfaceCard className="p-6">
          <p className="text-sm font-semibold text-foreground">현재 인증 구조</p>
          <p className="mt-3 text-sm leading-7 text-muted">
            계정 정보는 로컬 파일에 저장되고, 로그인 상태는 서명된 쿠키로
            유지됩니다. 초기 운영 단계에서 가볍게 관리하기 좋은 방식입니다.
          </p>
        </SurfaceCard>

        <SurfaceCard className="p-6">
          <p className="text-sm font-semibold text-foreground">계정 발급 정책</p>
          <ul className="mt-4 space-y-3 text-sm leading-7 text-muted">
            <li className="rounded-2xl bg-surface-muted px-4 py-3 text-foreground">
              계정은 관리자가 직접 추가
            </li>
            <li className="rounded-2xl bg-surface-muted px-4 py-3 text-foreground">
              일반 사용자는 로그인만 진행
            </li>
            <li className="rounded-2xl bg-surface-muted px-4 py-3 text-foreground">
              권한 분리는 관리자 탭에서 확장 예정
            </li>
          </ul>
        </SurfaceCard>
      </div>
    </div>
  );
}
