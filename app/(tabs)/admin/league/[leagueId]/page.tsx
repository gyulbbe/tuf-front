import type { Metadata } from "next";
import { LeagueAdminRegistrationPage } from "@/components/league/league-admin-registration-page";
import { SurfaceCard } from "@/components/site/surface-card";
import { isAdminRole } from "@/lib/auth/roles";
import { requireServerAuth } from "@/lib/auth/server-auth";

export const metadata: Metadata = {
  title: "관리자 리그 수정",
};

type AdminLeagueEditPageProps = {
  params: Promise<{
    leagueId: string;
  }>;
};

export default async function AdminLeagueEditPage({
  params,
}: AdminLeagueEditPageProps) {
  const { leagueId } = await params;
  const session = await requireServerAuth(`/admin/league/${leagueId}`);
  const parsedLeagueId = Number(leagueId);

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

  if (!Number.isInteger(parsedLeagueId) || parsedLeagueId <= 0) {
    return (
      <SurfaceCard className="p-7 sm:p-8">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          잘못된 리그 ID
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-8 text-muted">
          수정할 리그를 다시 선택해주세요.
        </p>
      </SurfaceCard>
    );
  }

  return <LeagueAdminRegistrationPage leagueId={parsedLeagueId} />;
}
