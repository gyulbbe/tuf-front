"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { DuelTournamentBoard } from "@/components/tournament/duel-tournament-board";
import { TournamentScoreSubmissionPanel } from "@/components/tournament/tournament-score-submission-panel";
import { SurfaceCard } from "@/components/site/surface-card";
import { getTournament } from "@/lib/api/tournament";
import type { Tournament, TournamentMatch } from "@/lib/tournament/types";

type TournamentProgressPageProps = {
  tournamentId: string;
};

function getMatches(tournament: Tournament | null) {
  return tournament?.groups.flatMap((group) => group.matches) ?? [];
}

export function TournamentProgressPage({
  tournamentId,
}: TournamentProgressPageProps) {
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null);
  const selectedMatch =
    getMatches(tournament).find((match) => match.id === selectedMatchId) ?? null;

  useEffect(() => {
    let cancelled = false;

    async function loadTournament() {
      setLoading(true);
      setLoadError(null);

      try {
        const nextTournament = await getTournament(tournamentId);

        if (!cancelled) {
          setTournament(nextTournament);
          setSelectedMatchId(null);
        }
      } catch (error) {
        if (!cancelled) {
          setTournament(null);
          setLoadError(
            error instanceof Error
              ? error.message
              : "토너먼트 정보를 불러오지 못했습니다.",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadTournament();

    return () => {
      cancelled = true;
    };
  }, [tournamentId]);

  return (
    <div className="relative left-1/2 w-[calc(100vw-1.25rem)] max-w-[1680px] -translate-x-1/2 space-y-4 sm:w-[calc(100vw-2rem)]">
      <SurfaceCard className="p-5 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">
              Admin Tournament
            </p>
            <h1 className="mt-2 text-2xl font-semibold text-foreground sm:text-3xl">
              {tournament?.title ?? "토너먼트 진행 관리"}
            </h1>
          </div>
          <Link
            href={`/tournament/${tournamentId}`}
            className="inline-flex items-center justify-center rounded-full border border-line-strong bg-white px-5 py-3 text-sm font-semibold text-muted transition-colors hover:border-accent hover:bg-accent-soft hover:text-accent-ink"
          >
            시청자 화면
          </Link>
        </div>
      </SurfaceCard>

      {loading ? (
        <SurfaceCard className="px-6 py-12 text-center text-sm text-muted">
          토너먼트 정보를 불러오는 중입니다.
        </SurfaceCard>
      ) : null}

      {!loading && loadError ? (
        <SurfaceCard className="border-danger-ink/20 bg-danger-soft px-5 py-4">
          <p className="text-sm font-medium text-danger-ink">{loadError}</p>
        </SurfaceCard>
      ) : null}

      {!loading && !loadError && tournament ? (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px] xl:items-start">
          <DuelTournamentBoard
            onMatchSelect={(match: TournamentMatch) =>
              setSelectedMatchId(match.id)
            }
            selectedMatchId={selectedMatchId}
            tournament={tournament}
          />

          <TournamentScoreSubmissionPanel
            key={selectedMatch?.id ?? "no-match"}
            mode="admin"
            selectedMatch={selectedMatch}
            tournament={tournament}
            tournamentId={tournamentId}
            onTournamentChange={setTournament}
          />
        </div>
      ) : null}
    </div>
  );
}
