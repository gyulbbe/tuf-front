import type { Metadata } from "next";
import { ProleagueHistoryConsole } from "@/components/proleague/proleague-history-console";
import { SurfaceCard } from "@/components/site/surface-card";
import { isAdminRole } from "@/lib/auth/roles";
import { requireServerAuth } from "@/lib/auth/server-auth";

export const metadata: Metadata = {
  title: "관리자 프로리그 이력",
};

export default async function AdminProleagueHistoryPage() {
  const session = await requireServerAuth("/admin/proleague/history");

  if (!isAdminRole(session.user.role)) {
    return (
      <SurfaceCard className="p-7 sm:p-8">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          접근 권한 없음
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-8 text-muted">
          이 화면은 관리자 권한 계정만 볼 수 있습니다.
        </p>
      </SurfaceCard>
    );
  }

  return <ProleagueHistoryConsole />;
}
