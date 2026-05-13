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
        <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          접근 권한 없음
        </h1>
      </SurfaceCard>
    );
  }

  return <AdminMenuVisibilityConsole />;
}
