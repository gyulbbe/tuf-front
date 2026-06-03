"use client";

import { useEffect, useState } from "react";
import { DuelTournamentBoard } from "@/components/tournament/duel-tournament-board";
import { RaceSurvivalProgressBoard } from "@/components/tournament/tournament-progress-page";
import { SurfaceCard } from "@/components/site/surface-card";
import { getTournament } from "@/lib/api/tournament";
import type {
  Tournament,
  TournamentMatch,
  TournamentStatus,
} from "@/lib/tournament/types";
import { cn } from "@/lib/utils";

const statusLabels: Record<TournamentStatus, string> = {
  LIVE: "진행중",
  FINISHED: "종료",
};

function getStatusClassName(status: TournamentStatus) {
  return status === "FINISHED"
    ? "bg-surface-muted text-muted"
    : "bg-success-soft text-success-ink";
}

function TournamentHeader({ tournament }: { tournament: Tournament }) {
  return (
    <SurfaceCard className="mb-4 p-5 sm:p-6">
      <span
        className={cn(
          "mb-3 inline-flex rounded-full px-3 py-1 text-xs font-semibold",
          getStatusClassName(tournament.status),
        )}
      >
        {statusLabels[tournament.status]}
      </span>
      <h1 className="text-2xl font-semibold leading-tight text-foreground sm:text-3xl">
        {tournament.title}
      </h1>
    </SurfaceCard>
  );
}

export function TournamentBracketPage({
  tournamentId,
}: {
  tournamentId: string;
}) {
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadTournament() {
      setLoading(true);
      setError(null);

      try {
        const nextTournament = await getTournament(tournamentId);

        if (!cancelled) {
          setTournament(nextTournament);
          setSelectedMatchId(null);
        }
      } catch (loadError) {
        if (!cancelled) {
          setTournament(null);
          setError(
            loadError instanceof Error
              ? loadError.message
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
    <div className="relative left-1/2 w-[calc(100vw-1.25rem)] max-w-[1600px] -translate-x-1/2 sm:w-[calc(100vw-2rem)]">
      {loading ? (
        <SurfaceCard className="p-6 sm:p-8">
          <h1 className="text-2xl font-semibold text-foreground sm:text-3xl">
            듀얼 토너먼트 조별 대진표
          </h1>
          <div className="mt-6 rounded-lg border border-dashed border-line px-6 py-10 text-sm text-muted">
            토너먼트 정보를 불러오는 중입니다.
          </div>
        </SurfaceCard>
      ) : null}

      {!loading && error ? (
        <SurfaceCard className="p-6 sm:p-8">
          <h1 className="text-2xl font-semibold text-foreground sm:text-3xl">
            듀얼 토너먼트 조별 대진표
          </h1>
          <div className="mt-6 rounded-lg border border-danger-ink/20 bg-danger-soft px-5 py-4">
            <p className="text-sm font-medium text-danger-ink">{error}</p>
            <p className="mt-2 text-xs leading-6 text-danger-ink/80">
              백엔드의 공개 상세 API `GET /tournaments/{tournamentId}` 응답을 확인해 주세요.
            </p>
          </div>
        </SurfaceCard>
      ) : null}

      {!loading && !error && tournament ? (
        <>
          <TournamentHeader tournament={tournament} />
          {tournament.bracketType === "RACE_SURVIVAL" ? (
            <RaceSurvivalProgressBoard
              onMatchSelect={(match: TournamentMatch) =>
                setSelectedMatchId(match.id)
              }
              readOnly
              selectedMatchId={selectedMatchId}
              tournament={tournament}
            />
          ) : (
            <DuelTournamentBoard
              onMatchSelect={(match: TournamentMatch) =>
                setSelectedMatchId(match.id)
              }
              selectedMatchId={selectedMatchId}
              tournament={tournament}
            />
          )}
        </>
      ) : null}
    </div>
  );
}
