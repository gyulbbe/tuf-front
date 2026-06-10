"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  PinballBoard,
  type PinballFinishEntry,
  type PinballLiveRankEntry,
  type PinballPlayer,
} from "@/components/pinball-draft/pinball-board";
import { SurfaceCard } from "@/components/site/surface-card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type PinballPhase = "ready" | "running" | "finished";
type TrackingMode = "leader" | "manual" | "player";

function parseCandidateNames(value: string) {
  return value
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean);
}

function findDuplicateCandidateName(names: readonly string[]) {
  const seenNames = new Set<string>();

  for (const name of names) {
    const key = name.toLocaleLowerCase("ko-KR");

    if (seenNames.has(key)) {
      return name;
    }

    seenNames.add(key);
  }

  return null;
}

function buildPlayers(names: readonly string[]): PinballPlayer[] {
  return names.map((name, index) => ({
    id: index + 1,
    userId: name,
    tier: null,
    race: null,
    teamIndex: 0,
    teamLabel: "1팀",
  }));
}

export function PinballDraftPage() {
  const [phase, setPhase] = useState<PinballPhase>("ready");
  const [candidateNamesText, setCandidateNamesText] = useState("");
  const [inputError, setInputError] = useState<string | null>(null);
  const [players, setPlayers] = useState<PinballPlayer[]>([]);
  const [runId, setRunId] = useState(0);
  const [shuffleSeed, setShuffleSeed] = useState(0);
  const [finishOrder, setFinishOrder] = useState<PinballFinishEntry[]>([]);
  const [liveRanking, setLiveRanking] = useState<PinballLiveRankEntry[]>([]);
  const [selectedCandidateId, setSelectedCandidateId] = useState<number | null>(
    null,
  );
  const [trackingMode, setTrackingMode] = useState<TrackingMode>("leader");
  const [rankingCopied, setRankingCopied] = useState(false);

  const previewNames = useMemo(
    () => parseCandidateNames(candidateNamesText),
    [candidateNamesText],
  );
  const selectedCandidate = players.find(
    (player) => player.id === selectedCandidateId,
  );
  const canStart = players.length > 0;
  const trackingLabel =
    trackingMode === "manual"
      ? "자유 시점"
      : trackingMode === "player" && selectedCandidate
        ? `${selectedCandidate.userId} 추적`
        : "선두 추적";
  const rankedPlayers = useMemo<PinballLiveRankEntry[]>(
    () =>
      liveRanking.length > 0
        ? liveRanking
        : players.map((player, index) => ({
            candidate: player,
            elapsedMs: null,
            isFinished: false,
            rank: index + 1,
          })),
    [liveRanking, players],
  );

  function resetRunState() {
    setFinishOrder([]);
    setLiveRanking([]);
    setSelectedCandidateId(null);
    setTrackingMode("leader");
    setRankingCopied(false);
  }

  function applyCandidateNames() {
    const names = parseCandidateNames(candidateNamesText);
    const duplicateName = findDuplicateCandidateName(names);

    if (names.length === 0) {
      setInputError("참가자 이름을 1명 이상 입력해 주세요.");
      return;
    }

    if (duplicateName) {
      setInputError(`참가자 이름이 중복됩니다: ${duplicateName}`);
      return;
    }

    setInputError(null);
    setPlayers(buildPlayers(names));
    resetRunState();
    setPhase("ready");
    setShuffleSeed(0);
    setRunId((current) => current + 1);
  }

  function handleSelectPlayer(candidateId: number | null) {
    if (typeof candidateId !== "number") {
      setSelectedCandidateId(null);
      setTrackingMode("leader");
      return;
    }

    if (trackingMode === "player" && selectedCandidateId === candidateId) {
      setSelectedCandidateId(null);
      setTrackingMode("leader");
      return;
    }

    setSelectedCandidateId(candidateId);
    setTrackingMode("player");
  }

  function handleFollowCandidateFinished(candidateId: number) {
    if (trackingMode !== "player" || selectedCandidateId !== candidateId) {
      return;
    }

    setSelectedCandidateId(null);
    setTrackingMode("leader");
  }

  function handleManualCamera() {
    setTrackingMode("manual");
  }

  async function copyCurrentRanking() {
    const rankingText = finishOrder
      .map((entry) => entry.candidate.userId)
      .join(",");

    if (!rankingText) {
      return;
    }

    try {
      await navigator.clipboard.writeText(rankingText);
      setRankingCopied(true);
      window.setTimeout(() => {
        setRankingCopied(false);
      }, 1400);
    } catch {
      setRankingCopied(false);
    }
  }

  function startRun() {
    if (!canStart || phase === "running") {
      return;
    }

    resetRunState();
    setRunId((current) => current + 1);
    setPhase("running");
  }

  function restartRun() {
    if (!canStart) {
      return;
    }

    resetRunState();
    setRunId((current) => current + 1);
    setPhase("ready");
  }

  function shuffleStartPositions() {
    if (phase === "running" || !canStart) {
      return;
    }

    resetRunState();
    setShuffleSeed((current) => current + 1);
    setPhase("ready");
  }

  function resetAll() {
    setCandidateNamesText("");
    setInputError(null);
    setPlayers([]);
    resetRunState();
    setPhase("ready");
    setShuffleSeed(0);
    setRunId((current) => current + 1);
  }

  return (
    <main className="mx-auto w-full max-w-[1900px] px-3 py-4 sm:px-5 lg:px-6">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-accent">
            Front Only Pinball
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-foreground">
            핀볼 드래프트
          </h1>
          <p className="mt-2 text-sm text-muted">
            쉼표로 구분한 이름을 1팀 참가자로 배치합니다.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            href="/draft"
            className="rounded-full border border-line-strong bg-white px-5 py-3 text-sm font-semibold text-muted transition-colors hover:border-accent hover:bg-accent-soft hover:text-accent-ink"
          >
            드래프트 목록
          </Link>
          <Button variant="outline" onClick={resetAll}>
            리셋
          </Button>
          <Button
            variant="outline"
            disabled={phase === "running" || !canStart}
            onClick={shuffleStartPositions}
          >
            위치 섞기
          </Button>
          {phase === "running" ? (
            <Button variant="outline" disabled={!canStart} onClick={restartRun}>
              다시 시작
            </Button>
          ) : null}
          <Button
            variant="accent"
            disabled={phase === "running" || !canStart}
            onClick={phase === "finished" ? restartRun : startRun}
          >
            {phase === "finished" ? "다시 시작" : phase === "ready" ? "시작" : "진행 중"}
          </Button>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px] 2xl:grid-cols-[minmax(0,1fr)_340px]">
        <PinballBoard
          className="xl:self-stretch"
          candidates={players}
          followCandidateId={
            trackingMode === "player" ? selectedCandidateId : null
          }
          isRunning={phase === "running"}
          runId={runId}
          shuffleSeed={shuffleSeed}
          onFollowCandidateFinished={handleFollowCandidateFinished}
          onLiveRankingChange={setLiveRanking}
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
              <p className="text-sm font-semibold text-foreground">참가자 입력</p>
              <span className="shrink-0 rounded-full bg-surface-muted px-3 py-1 text-xs font-semibold text-muted">
                {previewNames.length}명
              </span>
            </div>

            <textarea
              value={candidateNamesText}
              onChange={(event) => {
                setInputError(null);
                setCandidateNamesText(event.target.value);
              }}
              className="mt-4 min-h-36 w-full resize-y rounded-lg border border-line-strong bg-white px-4 py-3 text-sm leading-7 text-foreground outline-none transition-colors placeholder:text-muted focus:border-accent"
              placeholder="예: alpha, bravo, charlie"
              disabled={phase === "running"}
            />

            {inputError ? (
              <p className="mt-3 text-sm text-danger-ink">{inputError}</p>
            ) : null}

            <Button
              variant="accent"
              fullWidth
              className="mt-4"
              disabled={phase === "running"}
              onClick={applyCandidateNames}
            >
              명단 적용
            </Button>
          </SurfaceCard>

          <SurfaceCard className="p-5">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-foreground">참가자 목록</p>
              <div className="flex shrink-0 items-center gap-2">
                <span className="rounded-full bg-surface-muted px-3 py-1 text-xs font-semibold text-muted">
                  {trackingLabel}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={finishOrder.length === 0}
                  onClick={() => {
                    void copyCurrentRanking();
                  }}
                >
                  {rankingCopied ? "복사됨" : "복사"}
                </Button>
              </div>
            </div>
            <div className="mt-4 grid max-h-[calc(100vh-300px)] gap-2 overflow-y-auto pr-1">
              {players.length === 0 ? (
                <p className="rounded-lg border border-dashed border-line px-4 py-6 text-sm text-muted">
                  이름 목록을 적용하면 보드에 바로 배치됩니다.
                </p>
              ) : (
                rankedPlayers.map((entry) => {
                  const player = entry.candidate;
                  const isSelected =
                    trackingMode === "player" && selectedCandidateId === player.id;

                  return (
                    <button
                      key={player.id}
                      type="button"
                      className={cn(
                        "rounded-lg border px-4 py-3 text-left transition-colors",
                        isSelected
                          ? "border-accent bg-accent-soft text-accent-ink"
                          : entry.isFinished
                            ? "border-emerald-200 bg-emerald-50 text-emerald-950"
                            : "border-line bg-white hover:border-accent-soft",
                      )}
                      onClick={() => handleSelectPlayer(player.id)}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="min-w-0 truncate text-sm font-semibold">
                          {player.userId}
                        </span>
                        <span
                          className={cn(
                            "shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold",
                            entry.isFinished
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-surface-muted text-muted",
                          )}
                        >
                          {entry.rank}위
                        </span>
                      </div>
                      <p
                        className={cn(
                          "mt-2 text-xs",
                          entry.isFinished ? "text-emerald-700" : "text-muted",
                        )}
                      >
                        {entry.isFinished
                          ? "완주"
                          : phase === "running"
                            ? "진행 중"
                            : player.teamLabel}
                      </p>
                    </button>
                  );
                })
              )}
            </div>
          </SurfaceCard>
        </div>
      </div>
    </main>
  );
}
