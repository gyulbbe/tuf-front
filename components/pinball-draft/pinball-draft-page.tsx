"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { DraftUserSearch } from "@/components/draft/draft-user-search";
import {
  PinballBoard,
  type PinballFinishEntry,
  type PinballPlayer,
} from "@/components/pinball-draft/pinball-board";
import { SurfaceCard } from "@/components/site/surface-card";
import { Button } from "@/components/ui/button";
import type { DraftUserSearchResult } from "@/lib/api/draft-users";
import { cn } from "@/lib/utils";

type PinballPhase = "setup" | "ready" | "running" | "finished";
type TrackingMode = "leader" | "manual" | "player";

type PinballTeam = {
  label: string;
  players: DraftUserSearchResult[];
};

function buildTeamLabel(index: number) {
  return `${String.fromCharCode(65 + index)}팀`;
}

function buildTeams(teamCount: number, currentTeams: PinballTeam[] = []) {
  return Array.from({ length: teamCount }, (_, index) => ({
    label: buildTeamLabel(index),
    players: currentTeams[index]?.players ?? [],
  }));
}

function formatMeta(user: DraftUserSearchResult) {
  return [user.race, user.tier].filter(Boolean).join(" · ") || "정보 없음";
}

function flattenTeamPlayers(teams: PinballTeam[]): PinballPlayer[] {
  return teams.flatMap((team, teamIndex) =>
    team.players.map((player) => ({
      ...player,
      teamIndex,
      teamLabel: team.label,
    })),
  );
}

export function PinballDraftPage() {
  const [phase, setPhase] = useState<PinballPhase>("setup");
  const [teams, setTeams] = useState<PinballTeam[]>(() => buildTeams(2));
  const [runId, setRunId] = useState(0);
  const [shuffleSeed, setShuffleSeed] = useState(0);
  const [finishOrder, setFinishOrder] = useState<PinballFinishEntry[]>([]);
  const [selectedCandidateId, setSelectedCandidateId] = useState<number | null>(
    null,
  );
  const [trackingMode, setTrackingMode] = useState<TrackingMode>("leader");

  const players = useMemo(() => flattenTeamPlayers(teams), [teams]);
  const disabledUserIds = players.map((player) => player.id);
  const selectedCandidate = players.find(
    (player) => player.id === selectedCandidateId,
  );
  const canStart = teams.every((team) => team.players.length > 0);
  const trackingLabel =
    trackingMode === "manual"
      ? "자유 시점"
      : trackingMode === "player" && selectedCandidate
        ? `${selectedCandidate.userId} 추적`
        : "선두 추적";

  function handleTeamCountChange(nextTeamCount: number) {
    setTeams((currentTeams) => buildTeams(nextTeamCount, currentTeams));
    setFinishOrder([]);
    setSelectedCandidateId(null);
    setTrackingMode("leader");
  }

  function handleAddTeamPlayer(teamIndex: number, user: DraftUserSearchResult) {
    setTeams((currentTeams) => {
      if (
        currentTeams.some((team) =>
          team.players.some((player) => player.id === user.id),
        )
      ) {
        return currentTeams;
      }

      return currentTeams.map((team, index) =>
        index === teamIndex
          ? { ...team, players: [...team.players, user] }
          : team,
      );
    });
  }

  function handleRemoveTeamPlayer(teamIndex: number, userId: number) {
    setTeams((currentTeams) =>
      currentTeams.map((team, index) =>
        index === teamIndex
          ? {
              ...team,
              players: team.players.filter((player) => player.id !== userId),
            }
          : team,
      ),
    );
    setFinishOrder([]);
    if (selectedCandidateId === userId) {
      setSelectedCandidateId(null);
      setTrackingMode("leader");
    }
  }

  function handleSelectPlayer(candidateId: number | null) {
    if (typeof candidateId !== "number") {
      setSelectedCandidateId(null);
      setTrackingMode("leader");
      return;
    }

    setSelectedCandidateId(candidateId);
    setTrackingMode("player");
  }

  function handleManualCamera() {
    setTrackingMode("manual");
  }

  function prepareRun() {
    if (!canStart) {
      return;
    }

    setFinishOrder([]);
    setSelectedCandidateId(null);
    setTrackingMode("leader");
    setRunId((current) => current + 1);
    setPhase("ready");
  }

  function startRun() {
    if (!canStart || phase === "running") {
      return;
    }

    setFinishOrder([]);
    setSelectedCandidateId(null);
    setTrackingMode("leader");
    setRunId((current) => current + 1);
    setPhase("running");
  }

  function shuffleStartPositions() {
    if (phase === "running") {
      return;
    }

    setFinishOrder([]);
    setSelectedCandidateId(null);
    setTrackingMode("leader");
    setShuffleSeed((current) => current + 1);
    setPhase("ready");
  }

  function resetAll() {
    setPhase("setup");
    setTeams(buildTeams(2));
    setFinishOrder([]);
    setSelectedCandidateId(null);
    setTrackingMode("leader");
    setShuffleSeed(0);
    setRunId((current) => current + 1);
  }

  function backToSetup() {
    setPhase("setup");
    setFinishOrder([]);
    setSelectedCandidateId(null);
    setTrackingMode("leader");
  }

  if (phase === "setup") {
    return (
      <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-accent">
              Front Only Pinball
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-foreground">
              핀볼 드래프트 설정
            </h1>
            <p className="mt-2 text-sm leading-7 text-muted">
              팀 수를 정하고 각 팀 카드에서 선수를 추가하면 바로 진행할 수 있습니다.
            </p>
          </div>
          <Link
            href="/draft"
            className="rounded-full border border-line-strong bg-white px-5 py-3 text-sm font-semibold text-muted transition-colors hover:border-accent hover:bg-accent-soft hover:text-accent-ink"
          >
            드래프트 목록으로
          </Link>
        </div>

        <SurfaceCard className="p-5 sm:p-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <label className="w-full max-w-xs space-y-2">
              <span className="text-sm font-semibold text-foreground">팀 수</span>
              <select
                className="w-full rounded-lg border border-line-strong bg-surface-strong px-4 py-3 text-sm text-foreground outline-none transition-colors focus:border-accent focus:bg-white"
                value={teams.length}
                onChange={(event) =>
                  handleTeamCountChange(Number(event.target.value))
                }
              >
                {Array.from({ length: 8 }, (_, index) => index + 1).map(
                  (count) => (
                    <option key={count} value={count}>
                      {count}팀
                    </option>
                  ),
                )}
              </select>
            </label>

            <div className="flex flex-wrap items-center gap-3">
              <p className="text-sm text-muted">
                총 {players.length}명 · 각 팀 1명 이상 필요
              </p>
              <Button variant="accent" disabled={!canStart} onClick={prepareRun}>
                배치하기
              </Button>
            </div>
          </div>
        </SurfaceCard>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          {teams.map((team, teamIndex) => (
            <SurfaceCard key={team.label} className="p-5 sm:p-6">
              <div className="flex items-center justify-between gap-3">
                <p className="text-lg font-semibold text-foreground">
                  {team.label}
                </p>
                <span className="rounded-full bg-surface-muted px-3 py-1 text-xs font-semibold text-muted">
                  {team.players.length}명
                </span>
              </div>

              <div className="mt-4">
                <DraftUserSearch
                  clearOnSelect
                  label={`${team.label} 선수 검색`}
                  onSelect={(user) => handleAddTeamPlayer(teamIndex, user)}
                  disabledUserIds={disabledUserIds}
                  disabledUserMessage="이미 다른 팀에 추가된 선수입니다."
                  placeholder="선수 ID 검색"
                />
              </div>

              <div className="mt-4 grid max-h-[420px] gap-3 overflow-y-auto pr-1">
                {team.players.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-line px-4 py-8 text-sm leading-7 text-muted">
                    이 팀에 선수를 1명 이상 추가해 주세요.
                  </div>
                ) : (
                  team.players.map((player, index) => (
                    <div
                      key={player.id}
                      className="rounded-lg border border-line bg-white px-4 py-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-foreground">
                            {index + 1}. {player.userId}
                          </p>
                          <p className="mt-1 text-xs text-muted">
                            {formatMeta(player)}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            handleRemoveTeamPlayer(teamIndex, player.id)
                          }
                        >
                          제거
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </SurfaceCard>
          ))}
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-[1900px] px-3 py-4 sm:px-5 lg:px-6">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-accent">
            {phase === "finished" ? "Result" : phase === "ready" ? "Ready" : "Running"}
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-foreground">
            핀볼 드래프트
          </h1>
          <p className="mt-2 text-sm text-muted">
            {phase === "finished"
              ? "모든 공이 도착했습니다."
              : phase === "ready"
                ? "좌우 위치를 섞은 뒤 시작을 누르면 공이 떨어집니다."
                : "각 팀 선수가 동시에 출발해 도착 순위를 기록합니다."}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={backToSetup}>
            다시 설정
          </Button>
          <Button variant="outline" onClick={resetAll}>
            리셋
          </Button>
          <Button
            variant="outline"
            disabled={phase === "running"}
            onClick={shuffleStartPositions}
          >
            좌우 섞기
          </Button>
          <Button
            variant="accent"
            disabled={phase === "running"}
            onClick={startRun}
          >
            {phase === "finished" ? "다시 시작" : phase === "ready" ? "시작" : "진행 중"}
          </Button>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px] 2xl:grid-cols-[minmax(0,1fr)_320px]">
        <PinballBoard
          candidates={players}
          followCandidateId={
            trackingMode === "player" ? selectedCandidateId : null
          }
          isRunning={phase === "running"}
          runId={runId}
          shuffleSeed={shuffleSeed}
          onManualCamera={handleManualCamera}
          onSelectCandidate={handleSelectPlayer}
          onProgressOrder={setFinishOrder}
          onFinishOrder={(order) => {
            setFinishOrder(order);
            setPhase("finished");
          }}
        />

        <div className="space-y-4 xl:sticky xl:top-4 xl:self-start">
          <SurfaceCard className="p-5">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-foreground">선수 목록</p>
              <span className="shrink-0 rounded-full bg-surface-muted px-3 py-1 text-xs font-semibold text-muted">
                {trackingLabel}
              </span>
            </div>
            <div className="mt-4 grid max-h-[calc(100vh-220px)] gap-2 overflow-y-auto pr-1">
              {players.map((player) => {
                const isSelected =
                  trackingMode === "player" && selectedCandidateId === player.id;
                const rank = finishOrder.find(
                  (entry) => entry.candidate.id === player.id,
                )?.rank;

                return (
                  <button
                    key={player.id}
                    type="button"
                    className={cn(
                      "rounded-lg border px-4 py-3 text-left transition-colors",
                      isSelected
                        ? "border-accent bg-accent-soft text-accent-ink"
                        : "border-line bg-white hover:border-accent-soft",
                    )}
                    onClick={() => handleSelectPlayer(player.id)}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="min-w-0 truncate text-sm font-semibold">
                        {player.userId}
                      </span>
                      <span className="shrink-0 text-xs text-muted">
                        {rank
                          ? `${rank}등`
                          : phase === "running"
                            ? "진행 중"
                            : "대기"}
                      </span>
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-3 text-xs text-muted">
                      <span>{player.teamLabel}</span>
                      <span>{formatMeta(player)}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </SurfaceCard>

          <SurfaceCard className="p-5">
            <p className="text-sm font-semibold text-foreground">현재 순위</p>
            <div className="mt-4 grid gap-2">
              {finishOrder.length === 0 ? (
                <p className="rounded-lg border border-dashed border-line px-4 py-6 text-sm text-muted">
                  아직 도착한 선수가 없습니다.
                </p>
              ) : (
                finishOrder.slice(0, 8).map((entry) => (
                  <div
                    key={entry.candidate.id}
                    className="rounded-lg bg-surface-muted px-4 py-3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="truncate text-sm font-semibold text-foreground">
                        {entry.rank}등 · {entry.candidate.userId}
                      </p>
                      <span className="text-xs text-muted">
                        {(entry.elapsedMs / 1000).toFixed(1)}초
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-muted">
                      {entry.candidate.teamLabel}
                    </p>
                  </div>
                ))
              )}
            </div>
          </SurfaceCard>
        </div>
      </div>

      {phase === "finished" ? (
        <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
          <SurfaceCard className="p-5 sm:p-6">
            <h2 className="text-xl font-semibold text-foreground">
              전체 도착 순위
            </h2>

            <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {finishOrder.map((entry) => (
                <div
                  key={entry.candidate.id}
                  className="rounded-[22px] border border-line bg-white px-4 py-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-muted">
                        {entry.rank}등
                      </p>
                      <p className="mt-1 truncate text-base font-semibold text-foreground">
                        {entry.candidate.userId}
                      </p>
                    </div>
                    <span className="rounded-full bg-surface-muted px-3 py-1 text-xs font-semibold text-muted">
                      {entry.candidate.teamLabel}
                    </span>
                  </div>
                  <p className="mt-3 text-xs text-muted">
                    {(entry.elapsedMs / 1000).toFixed(1)}초
                  </p>
                </div>
              ))}
            </div>
          </SurfaceCard>

          <SurfaceCard className="p-5 sm:p-6">
            <h2 className="text-xl font-semibold text-foreground">
              팀별 도착 순위
            </h2>

            <div className="mt-5 grid gap-4">
              {teams.map((team, teamIndex) => {
                const teamEntries = finishOrder.filter(
                  (entry) => entry.candidate.teamIndex === teamIndex,
                );

                return (
                  <div
                    key={team.label}
                    className="rounded-[22px] border border-line bg-white px-4 py-4"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-foreground">
                        {team.label}
                      </p>
                      <span className="text-xs text-muted">
                        {teamEntries.length}명
                      </span>
                    </div>

                    <div className="mt-3 grid gap-2">
                      {teamEntries.map((entry) => (
                        <div
                          key={entry.candidate.id}
                          className="rounded-lg bg-surface-muted px-3 py-2 text-sm"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <p className="truncate font-semibold text-foreground">
                              {entry.candidate.userId}
                            </p>
                            <span className="text-xs text-muted">
                              {entry.rank}등
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </SurfaceCard>
        </div>
      ) : null}
    </main>
  );
}
