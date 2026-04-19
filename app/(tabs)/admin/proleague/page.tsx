import type { Metadata } from "next";
import Link from "next/link";
import { AdminProleagueWorkspace } from "@/components/proleague/admin-proleague-workspace";
import { SurfaceCard } from "@/components/site/surface-card";
import { requireServerAuth } from "@/lib/auth/server-auth";
import { isAdminRole } from "@/lib/auth/roles";

export const metadata: Metadata = {
  title: "관리자 프로리그",
};

export default async function AdminProleaguePage() {
  const session = await requireServerAuth("/admin/proleague");

  if (!isAdminRole(session.user.role)) {
    return (
      <SurfaceCard className="p-7 sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-accent">
          Admin Proleague
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          접근 권한 없음
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-8 text-muted">
          이 화면은 드래프트를 실제로 제어하는 관리자 전용 화면이다.
        </p>
      </SurfaceCard>
    );
  }

  return (
    <div className="space-y-4">
      <SurfaceCard className="p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-accent">
              Admin Proleague
            </p>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              프로리그 드래프트 관리
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-muted">
              여기서 세션 시작, 일시정지, 재개, 시간 연장, 강제 스킵, 종료,
              팀별 픽 권한자 지정, 라이브 보드 확인까지 할 수 있다.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href="/admin"
              className="rounded-full border border-line px-4 py-2 text-sm text-muted transition-colors hover:border-accent-soft hover:bg-surface-strong hover:text-foreground"
            >
              관리자 홈
            </Link>
            <Link
              href="/proleague/draft"
              className="rounded-full border border-line px-4 py-2 text-sm text-muted transition-colors hover:border-accent-soft hover:bg-surface-strong hover:text-foreground"
            >
              라이브 화면 보기
            </Link>
          </div>
        </div>
      </SurfaceCard>

      <AdminProleagueWorkspace />
    </div>
  );
}
