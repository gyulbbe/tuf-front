import type { Metadata } from "next";
import { SurfaceCard } from "@/components/site/surface-card";
import { TournamentProgressPage } from "@/components/tournament/tournament-progress-page";
import { isAdminRole } from "@/lib/auth/roles";
import { requireServerAuth } from "@/lib/auth/server-auth";

export const metadata: Metadata = {
  title: "토너먼트 진행 관리",
};

type AdminTournamentProgressPageProps = {
  params: Promise<{
    tournamentId: string;
  }>;
};

export default async function AdminTournamentProgressPage({
  params,
}: AdminTournamentProgressPageProps) {
  const { tournamentId } = await params;
  const session = await requireServerAuth(`/admin/tournament/${tournamentId}`);

  if (!isAdminRole(session.user.role)) {
    return (
      <SurfaceCard className="p-7 sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-accent">
          Admin Tournament
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          접근 권한 없음
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-8 text-muted">
          토너먼트 진행 관리는 관리자 권한이 있는 계정만 사용할 수 있습니다.
        </p>
      </SurfaceCard>
    );
  }

  return <TournamentProgressPage tournamentId={tournamentId} />;
}
