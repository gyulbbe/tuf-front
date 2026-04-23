import type { ReactNode } from "react";
import { AdminDraftNav } from "@/components/proleague/admin-draft-nav";
import { SurfaceCard } from "@/components/site/surface-card";
import { requireServerAuth } from "@/lib/auth/server-auth";
import { isAdminRole } from "@/lib/auth/roles";

export default async function AdminDraftLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await requireServerAuth("/admin/draft");

  if (!isAdminRole(session.user.role)) {
    return (
      <SurfaceCard className="p-7 sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-accent">
          Admin Draft
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          접근 권한 없음
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-8 text-muted">
          이 화면은 드래프트를 준비하고 운영하는 관리자 전용 공간이다.
        </p>
      </SurfaceCard>
    );
  }

  return (
    <div className="space-y-4">
      <SurfaceCard className="p-7 sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-accent">
          Admin Draft
        </p>
        <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-2xl">
            <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
              드래프트 운영
            </h1>
            <p className="mt-4 text-base leading-8 text-muted">
              진행 중인 드래프트 관리와 종료된 드래프트 이력을 같은 관리자 구역에서
              확인할 수 있다.
            </p>
          </div>

          <AdminDraftNav />
        </div>
      </SurfaceCard>

      {children}
    </div>
  );
}
