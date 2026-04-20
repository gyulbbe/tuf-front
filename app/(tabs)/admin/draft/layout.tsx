import Link from "next/link";
import type { ReactNode } from "react";
import { AdminDraftTabs } from "@/components/proleague/admin-draft-tabs";
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
          이 화면은 드래프트를 준비하고 정리하는 관리자 전용 공간이다.
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
              Admin Draft
            </p>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              드래프트
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-muted">
              관리자 메뉴 아래에서 드래프트 관련 화면을 탭 단위로 나눴다. 여기서는 준비와
              라이브, 이력을 나눠서 본다. 준비는 관리 탭에서, 실시간 제어와 픽 진행은
              라이브 탭에서, 기록 정리는 이력 탭에서 이어서 처리하면 된다.
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

        <div className="mt-5 rounded-[24px] bg-surface-muted px-4 py-4 text-sm leading-7 text-muted">
          <p>
            접속 계정: {session.user.username} · {session.user.role}
          </p>
        </div>
      </SurfaceCard>

      <SurfaceCard className="p-4">
        <AdminDraftTabs />
      </SurfaceCard>

      {children}
    </div>
  );
}
