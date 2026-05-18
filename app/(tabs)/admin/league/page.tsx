import type { Metadata } from "next";
import { LeagueAdminManagementPage } from "@/components/league/league-admin-management-page";
import { LeagueAdminRegistrationPage } from "@/components/league/league-admin-registration-page";
import { SurfaceCard } from "@/components/site/surface-card";
import { isAdminRole } from "@/lib/auth/roles";
import { requireServerAuth } from "@/lib/auth/server-auth";
import type { AdminLeagueType } from "@/lib/api/league";

export const metadata: Metadata = {
  title: "관리자 리그 등록",
};

type AdminLeaguePageProps = {
  searchParams?: Promise<{
    mode?: string;
    type?: string;
  }>;
};

const leagueTypes = new Set<AdminLeagueType>([
  "PROLEAGUE",
  "PERSONAL",
  "ULTIMATE_BATTLE",
  "RACE_SURVIVAL",
]);

function parseLeagueType(value: string | undefined): AdminLeagueType | null {
  const normalized = value?.trim().toUpperCase() as AdminLeagueType | undefined;
  return normalized && leagueTypes.has(normalized) ? normalized : null;
}

export default async function AdminLeaguePage({
  searchParams,
}: AdminLeaguePageProps) {
  const session = await requireServerAuth("/admin/league");
  const resolvedSearchParams = searchParams ? await searchParams : {};

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

  const initialType = parseLeagueType(resolvedSearchParams.type);
  if (resolvedSearchParams.mode === "create") {
    return <LeagueAdminRegistrationPage initialType={initialType} />;
  }

  return <LeagueAdminManagementPage initialType={initialType ?? "PROLEAGUE"} />;
}
