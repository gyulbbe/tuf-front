import type { Metadata } from "next";
import { AdminMenuVisibilityConsole } from "@/components/admin/admin-menu-visibility-console";
import { SurfaceCard } from "@/components/site/surface-card";
import { requireServerAuth } from "@/lib/auth/server-auth";
import { isAdminRole } from "@/lib/auth/roles";

export const metadata: Metadata = {
  title: "메뉴 설정",
};

export default async function AdminMenuVisibilityPage() {
  const session = await requireServerAuth("/admin/menu-visibility");

  if (!isAdminRole(session.user.role)) {
    return (
      <SurfaceCard className="p-7 sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-accent">
          Admin Menu
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          접근 권한 없음
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-8 text-muted">
          메뉴 설정은 관리자 권한 계정만 볼 수 있습니다.
        </p>
      </SurfaceCard>
    );
  }

  return <AdminMenuVisibilityConsole />;
}
