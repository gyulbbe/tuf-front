import type { Metadata } from "next";
import { AdminUserManagementConsole } from "@/components/admin/admin-user-management-console";
import { SurfaceCard } from "@/components/site/surface-card";
import { requireServerAuth } from "@/lib/auth/server-auth";
import { isAdminRole } from "@/lib/auth/roles";

export const metadata: Metadata = {
  title: "관리자 사용자 관리",
};

export default async function AdminUsersPage() {
  const session = await requireServerAuth("/admin/users");

  if (!isAdminRole(session.user.role)) {
    return (
      <SurfaceCard className="p-7 sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-accent">
          Admin Users
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          접근 권한 없음
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-8 text-muted">
          이 화면은 관리자 권한 계정만 볼 수 있다.
        </p>
      </SurfaceCard>
    );
  }

  return <AdminUserManagementConsole />;
}
