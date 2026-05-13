import type { Metadata } from "next";
import { TournamentBracketPage } from "@/components/tournament/tournament-bracket-page";

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

  return <TournamentBracketPage tournamentId={tournamentId} />;
}
