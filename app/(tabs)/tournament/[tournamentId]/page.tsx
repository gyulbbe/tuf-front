import type { Metadata } from "next";
import { TournamentProgressPage } from "@/components/tournament/tournament-progress-page";

export const metadata: Metadata = {
  title: "토너먼트 대진표",
};

type TournamentDetailPageProps = {
  params: Promise<{
    tournamentId: string;
  }>;
};

export default async function TournamentDetailPage({
  params,
}: TournamentDetailPageProps) {
  const { tournamentId } = await params;

  return <TournamentProgressPage mode="public" tournamentId={tournamentId} />;
}
