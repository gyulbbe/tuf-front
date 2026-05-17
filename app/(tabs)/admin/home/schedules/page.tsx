import type { Metadata } from "next";
import { AdminHomeScheduleConsole } from "@/components/admin/admin-home-schedule-console";
import { SurfaceCard } from "@/components/site/surface-card";
import { isAdminRole } from "@/lib/auth/roles";
import { requireServerAuth } from "@/lib/auth/server-auth";

export const metadata: Metadata = {
  title: "관리자 일정 관리",
};

export default async function AdminHomeSchedulesPage() {
  const session = await requireServerAuth("/admin/home/schedules");

  if (!isAdminRole(session.user.role)) {
    return (
      <SurfaceCard className="p-7 sm:p-8">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          접근 권한 없음
        </h1>
      </SurfaceCard>
    );
  }

  return <AdminHomeScheduleConsole />;
}
