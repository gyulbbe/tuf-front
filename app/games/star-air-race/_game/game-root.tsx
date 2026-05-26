"use client";

import type { KeyboardEvent, ReactElement } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { getAiControls } from "./ai";
import {
  createRacer,
  rankRacers,
  TOTAL_LAPS,
  updateRacer,
  VIEWPORT_HEIGHT,
  VIEWPORT_WIDTH,
} from "./physics";
import { renderGame } from "./render";
import { TRACKS } from "./tracks";
import type { InputState, RacerState, RunState, TrackDefinition } from "./types";

type OverlaySnapshot = {
  lap: number;
  phase: RunState["phase"];
  playerRank: number;
  speed: number;
  trackDescription: string;
  trackIndex: number;
  trackName: string;
  winnerName: string;
};

const EMPTY_INPUT: InputState = {
  brake: false,
  drift: false,
  left: false,
  right: false,
  throttle: false,
};

function createRacers(track: TrackDefinition): RacerState[] {
  return [
    createRacer({
      color: "#38bdf8",
      id: "player",
      isPlayer: true,
      name: "플레이어",
      personality: {
        aggression: 1,
        lineOffset: 0,
        maxSpeed: 650,
        phase: 0,
        turnRate: 1,
      },
      position: track.startPositions[0],
      species: "terran",
      startAngle: track.startAngle,
    }),
    createRacer({
      color: "#a855f7",
      id: "zerg-ai",
      isPlayer: false,
      name: "저그 비행체",
      personality: {
        aggression: 0.88,
        lineOffset: 42,
        maxSpeed: 585,
        phase: 0.9,
        turnRate: 0.96,
      },
      position: track.startPositions[1],
      species: "zerg",
      startAngle: track.startAngle,
    }),
    createRacer({
      color: "#facc15",
      id: "protoss-ai",
      isPlayer: false,
      name: "프로토스 코어",
      personality: {
        aggression: 0.86,
        lineOffset: -48,
        maxSpeed: 600,
        phase: 1.8,
        turnRate: 1.04,
      },
      position: track.startPositions[2],
      species: "protoss",
      startAngle: track.startAngle,
    }),
    createRacer({
      color: "#60a5fa",
      id: "terran-ai",
      isPlayer: false,
      name: "테란 윙",
      personality: {
        aggression: 0.84,
        lineOffset: 28,
        maxSpeed: 575,
        phase: 2.7,
        turnRate: 0.92,
      },
      position: track.startPositions[3],
      species: "terran",
      startAngle: track.startAngle,
    }),
  ];
}

function createRunState(trackIndex = 0, phaseStartedAt = 0): RunState {
  return {
    elapsedSeconds: 0,
    finishOrder: [],
    phase: "countdown",
    phaseStartedAt,
    raceFinishedAt: null,
    racers: createRacers(TRACKS[trackIndex]),
    selectedTrackIndex: trackIndex,
    winnerId: null,
  };
}

function updateRanks(runState: RunState): void {
  const track = TRACKS[runState.selectedTrackIndex];
  const ranked = rankRacers(runState.racers, track);

  ranked.forEach((entry, index) => {
    entry.racer.rank = index + 1;
  });
}

function createSnapshot(runState: RunState): OverlaySnapshot {
  const track = TRACKS[runState.selectedTrackIndex];
  const player = runState.racers.find((racer) => racer.isPlayer);
  const winner = runState.racers.find((racer) => racer.id === runState.winnerId);

  return {
    lap: Math.min((player?.lap ?? 0) + 1, TOTAL_LAPS),
    phase: runState.phase,
    playerRank: player?.rank ?? 1,
    speed: Math.round(Math.abs(player?.speed ?? 0)),
    trackDescription: track.description,
    trackIndex: runState.selectedTrackIndex,
    trackName: track.name,
    winnerName: winner?.name ?? "",
  };
}

export default function StarAirRaceGame(): ReactElement {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<InputState>({ ...EMPTY_INPUT });
  const runRef = useRef<RunState>(createRunState());
  const frameRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number | null>(null);
  const lastSnapshotAtRef = useRef(0);
  const [snapshot, setSnapshot] = useState<OverlaySnapshot>(() =>
    createSnapshot(createRunState()),
  );

  const syncSnapshot = useCallback(() => {
    setSnapshot(createSnapshot(runRef.current));
  }, []);

  const resetRace = useCallback(
    (trackIndex = runRef.current.selectedTrackIndex) => {
      inputRef.current = { ...EMPTY_INPUT };
      runRef.current = createRunState(trackIndex);
      lastTimeRef.current = null;
      lastSnapshotAtRef.current = 0;
      syncSnapshot();
      stageRef.current?.focus();
    },
    [syncSnapshot],
  );

  useEffect(() => {
    stageRef.current?.focus();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;

    if (!canvas) {
      return;
    }

    const context = canvas.getContext("2d");

    if (!context) {
      return;
    }

    const renderingContext: CanvasRenderingContext2D = context;

    function tick(timestamp: number) {
      const nowSeconds = timestamp / 1000;
      const lastTime = lastTimeRef.current ?? timestamp;
      const deltaSeconds = Math.max(0, (timestamp - lastTime) / 1000);
      lastTimeRef.current = timestamp;

      const runState = runRef.current;

      if (runState.phaseStartedAt === 0) {
        runState.phaseStartedAt = nowSeconds;
      }

      runState.elapsedSeconds = nowSeconds;

      if (
        runState.phase === "countdown" &&
        nowSeconds - runState.phaseStartedAt >= 3
      ) {
        runState.phase = "racing";
        runState.phaseStartedAt = nowSeconds;
      }

      const track = TRACKS[runState.selectedTrackIndex];

      if (runState.phase === "racing") {
        for (const racer of runState.racers) {
          const controls = racer.isPlayer
            ? inputRef.current
            : getAiControls(racer, track, nowSeconds);

          updateRacer({
            controls,
            deltaSeconds,
            elapsedSeconds: nowSeconds,
            racer,
            track,
          });
        }

        updateRanks(runState);
        runState.finishOrder = runState.racers
          .filter((racer) => racer.finishedAt !== null)
          .sort((a, b) => (a.finishedAt ?? 0) - (b.finishedAt ?? 0))
          .map((racer) => racer.id);

        const winner = runState.racers
          .filter((racer) => racer.finishedAt !== null)
          .sort((a, b) => (a.finishedAt ?? 0) - (b.finishedAt ?? 0))[0];

        if (winner) {
          runState.winnerId = winner.id;
          runState.raceFinishedAt = winner.finishedAt;
          runState.phase = "finished";
          runState.phaseStartedAt = nowSeconds;
          syncSnapshot();
        }
      }

      renderGame({
        context: renderingContext,
        elapsedSeconds: nowSeconds,
        runState,
        track,
      });

      if (nowSeconds - lastSnapshotAtRef.current > 0.2) {
        lastSnapshotAtRef.current = nowSeconds;
        syncSnapshot();
      }

      frameRef.current = window.requestAnimationFrame(tick);
    }

    frameRef.current = window.requestAnimationFrame(tick);

    return () => {
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
      }
    };
  }, [syncSnapshot]);

  useEffect(() => {
    function clearInput() {
      inputRef.current = { ...EMPTY_INPUT };
    }

    window.addEventListener("blur", clearInput);
    document.addEventListener("visibilitychange", clearInput);

    return () => {
      window.removeEventListener("blur", clearInput);
      document.removeEventListener("visibilitychange", clearInput);
    };
  }, []);

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (setInput(event, true)) {
      event.preventDefault();
    }
  }

  function handleKeyUp(event: KeyboardEvent<HTMLDivElement>) {
    if (setInput(event, false)) {
      event.preventDefault();
    }
  }

  function setInput(
    event: KeyboardEvent<HTMLDivElement>,
    pressed: boolean,
  ): boolean {
    if (event.code === "ArrowUp" || event.code === "KeyW") {
      inputRef.current.throttle = pressed;
      return true;
    }

    if (event.code === "ArrowDown" || event.code === "KeyS") {
      inputRef.current.brake = pressed;
      return true;
    }

    if (event.code === "ArrowLeft" || event.code === "KeyA") {
      inputRef.current.left = pressed;
      return true;
    }

    if (event.code === "ArrowRight" || event.code === "KeyD") {
      inputRef.current.right = pressed;
      return true;
    }

    if (event.code === "ShiftLeft" || event.code === "ShiftRight") {
      inputRef.current.drift = pressed;
      return true;
    }

    return false;
  }

  return (
    <main className="min-h-screen bg-[#020617] px-3 py-3 text-white sm:px-5">
      <div className="mx-auto flex min-h-[calc(100vh-1.5rem)] w-full max-w-[1120px] flex-col gap-3">
        <header className="grid gap-3 border border-cyan-200/15 bg-[#08111f]/95 px-4 py-3 shadow-[0_18px_70px_rgba(0,0,0,0.42)] sm:grid-cols-[1fr_auto] sm:items-center">
          <div className="min-w-0">
            <p className="text-[11px] font-black uppercase text-cyan-200">
              Star Air Race
            </p>
            <h1 className="mt-1 text-2xl font-black tracking-normal text-white">
              스타 에어 레이스
            </h1>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center text-xs font-black uppercase tracking-normal text-slate-200 sm:w-[390px]">
            <div className="border border-white/10 bg-white/[0.06] px-3 py-2">
              <span className="block text-[10px] text-slate-400">Rank</span>
              <span className="text-lg text-yellow-200">{snapshot.playerRank}</span>
            </div>
            <div className="border border-white/10 bg-white/[0.06] px-3 py-2">
              <span className="block text-[10px] text-slate-400">Lap</span>
              <span className="text-lg text-fuchsia-200">
                {snapshot.lap}/{TOTAL_LAPS}
              </span>
            </div>
            <div className="border border-white/10 bg-white/[0.06] px-3 py-2">
              <span className="block text-[10px] text-slate-400">Speed</span>
              <span className="text-lg text-cyan-200">{snapshot.speed}</span>
            </div>
          </div>
        </header>

        <nav className="flex flex-wrap items-center gap-2 border border-white/10 bg-slate-950/72 p-2">
          {TRACKS.map((track, index) => (
            <button
              key={track.id}
              type="button"
              onClick={() => resetRace(index)}
              className={`border px-4 py-2 text-sm font-black transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-200 ${
                snapshot.trackIndex === index
                  ? "border-cyan-200 bg-cyan-200 text-slate-950 shadow-[0_0_28px_rgba(103,232,249,0.35)]"
                  : "border-white/10 bg-white/[0.06] text-slate-100 hover:border-cyan-100/50 hover:bg-white/[0.1]"
              }`}
            >
              Track {track.id}
            </button>
          ))}

          <p className="min-w-[220px] flex-1 truncate px-2 text-sm font-semibold text-slate-300">
            {snapshot.trackName} · {snapshot.trackDescription}
          </p>

          {snapshot.phase === "finished" ? (
            <span className="border border-emerald-200/30 bg-emerald-300/10 px-3 py-2 text-sm font-black text-emerald-100">
              우승 {snapshot.winnerName}
            </span>
          ) : null}

          <button
            type="button"
            onClick={() => resetRace()}
            className="border border-yellow-200/40 bg-yellow-200/10 px-4 py-2 text-sm font-black text-yellow-100 transition-colors hover:bg-yellow-200/18 focus:outline-none focus:ring-2 focus:ring-yellow-100"
          >
            다시 시작
          </button>
        </nav>

        <div
          ref={stageRef}
          tabIndex={0}
          aria-label="스타 에어 레이스 게임 화면"
          onKeyDown={handleKeyDown}
          onKeyUp={handleKeyUp}
          className="relative min-h-0 flex-1 outline-none focus-visible:ring-2 focus-visible:ring-cyan-200"
        >
          <canvas
            ref={canvasRef}
            width={VIEWPORT_WIDTH}
            height={VIEWPORT_HEIGHT}
            className="mx-auto block h-auto max-w-full border border-cyan-100/15 bg-slate-950 shadow-[0_24px_90px_rgba(0,0,0,0.55)]"
            style={{ width: "min(100%, calc(100vh - 32px), 1000px)" }}
          />
        </div>
      </div>
    </main>
  );
}
