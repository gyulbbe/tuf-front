import type { Metadata } from "next";
import { TournamentListPage } from "@/components/tournament/tournament-list-page";

export const metadata: Metadata = {
  title: "토너먼트",
};

export default function TournamentPage() {
  return <TournamentListPage />;
}
