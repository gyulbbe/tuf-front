"use client";

import type { ChangeEvent, FormEvent, KeyboardEvent, ReactElement } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { LEVEL_COUNT, LEVELS } from "./levels";
import {
  createExplosion,
  createPlayer,
  stepPhysics,
  updateParticles,
  VIEWPORT_HEIGHT,
  VIEWPORT_WIDTH,
} from "./physics";
import { renderGame } from "./render";
import type { InputState, RunState } from "./types";

type OverlaySnapshot = {
  deaths: number;
  levelId: number;
  levelName: string;
  message: string;
  phase: RunState["phase"];
};

function createRunState(levelIndex = 0, deaths = 0, stageClears = 0): RunState {
  return {
    deaths,
    levelIndex,
    message: "",
    particles: [],
    phase: "playing",
    phaseStartedAt: 0,
    player: createPlayer(LEVELS[levelIndex].start),
    removedBlockIds: [],
    stageClears,
  };
}

function createSnapshot(runState: RunState): OverlaySnapshot {
  const level = LEVELS[runState.levelIndex];

  return {
    deaths: runState.deaths,
    levelId: level.id,
    levelName: level.name,
    message: runState.message,
    phase: runState.phase,
  };
}

export default function ScarabBounceGame(): ReactElement {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<InputState>({ left: false, right: false });
  const runRef = useRef<RunState>(createRunState());
  const frameRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number | null>(null);
  const [snapshot, setSnapshot] = useState<OverlaySnapshot>(() =>
    createSnapshot(createRunState()),
  );
  const [stageInput, setStageInput] = useState("1");

  const syncSnapshot = useCallback(() => {
    setSnapshot(createSnapshot(runRef.current));
  }, []);

  const restartGame = useCallback(() => {
    inputRef.current = { left: false, right: false };
    runRef.current = createRunState();
    lastTimeRef.current = null;
    setStageInput("1");
    syncSnapshot();
    stageRef.current?.focus();
  }, [syncSnapshot]);

  const jumpToLevel = useCallback(
    (levelId: number) => {
      const nextLevelId = Math.min(Math.max(1, levelId), LEVEL_COUNT);

      inputRef.current = { left: false, right: false };
      runRef.current = createRunState(nextLevelId - 1);
      lastTimeRef.current = null;
      setStageInput(String(nextLevelId));
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

    function moveToNextLevel(nowSeconds: number) {
      const currentRun = runRef.current;
      const nextIndex = currentRun.levelIndex + 1;

      if (nextIndex >= LEVELS.length) {
        currentRun.phase = "finished";
        currentRun.message = "All Clear!";
        currentRun.phaseStartedAt = nowSeconds;
        syncSnapshot();
        return;
      }

      runRef.current = {
        ...createRunState(nextIndex, currentRun.deaths, currentRun.stageClears),
        phaseStartedAt: nowSeconds,
      };
      setStageInput(String(nextIndex + 1));
      syncSnapshot();
    }

    function resetCurrentLevel(nowSeconds: number) {
      const currentRun = runRef.current;
      runRef.current = {
        ...createRunState(
          currentRun.levelIndex,
          currentRun.deaths,
          currentRun.stageClears,
        ),
        phaseStartedAt: nowSeconds,
      };
      syncSnapshot();
    }

    function tick(timestamp: number) {
      const nowSeconds = timestamp / 1000;
      const lastTime = lastTimeRef.current ?? timestamp;
      const deltaSeconds = Math.max(0, (timestamp - lastTime) / 1000);
      lastTimeRef.current = timestamp;

      const runState = runRef.current;
      const level = LEVELS[runState.levelIndex];

      runState.particles = updateParticles(runState.particles, deltaSeconds);

      if (runState.phase === "playing") {
        const physics = stepPhysics({
          elapsedSeconds: nowSeconds,
          input: inputRef.current,
          level,
          player: runState.player,
          rawDeltaSeconds: deltaSeconds,
          removedBlockIds: runState.removedBlockIds,
        });

        if (physics.removedBlockIds.length > 0) {
          runState.removedBlockIds = [
            ...runState.removedBlockIds,
            ...physics.removedBlockIds,
          ];
        }

        if (physics.particles.length > 0) {
          runState.particles = [...runState.particles, ...physics.particles];
        }

        if (physics.event === "lost") {
          runState.deaths += 1;
          runState.message = "펑!";
          runState.particles = [
            ...runState.particles,
            ...createExplosion(runState.player.x, runState.player.y, [
              "#ef4444",
              "#fb923c",
              "#facc15",
              "#ffffff",
            ]),
          ];
          runState.phase = "burst";
          runState.phaseStartedAt = nowSeconds;
          syncSnapshot();
        } else if (physics.event === "clear") {
          runState.stageClears += 1;
          runState.message = "Stage Clear!";
          runState.particles = [
            ...runState.particles,
            ...createExplosion(level.target.x, level.target.y, [
              "#fef08a",
              "#facc15",
              "#38bdf8",
              "#ffffff",
            ]),
          ];
          runState.phase = "clear";
          runState.phaseStartedAt = nowSeconds;
          syncSnapshot();
        }
      } else if (
        runState.phase === "burst" &&
        nowSeconds - runState.phaseStartedAt > 0.85
      ) {
        resetCurrentLevel(nowSeconds);
      } else if (
        runState.phase === "clear" &&
        nowSeconds - runState.phaseStartedAt > 1.1
      ) {
        moveToNextLevel(nowSeconds);
      }

      renderGame({
        context: renderingContext,
        elapsedSeconds: nowSeconds,
        level: LEVELS[runRef.current.levelIndex],
        runState: runRef.current,
      });

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
      inputRef.current = { left: false, right: false };
    }

    window.addEventListener("blur", clearInput);
    document.addEventListener("visibilitychange", clearInput);

    return () => {
      window.removeEventListener("blur", clearInput);
      document.removeEventListener("visibilitychange", clearInput);
    };
  }, []);

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (setDirection(event, true)) {
      event.preventDefault();
    }
  }

  function handleKeyUp(event: KeyboardEvent<HTMLDivElement>) {
    if (setDirection(event, false)) {
      event.preventDefault();
    }
  }

  function handleStageInputChange(event: ChangeEvent<HTMLInputElement>) {
    setStageInput(event.target.value);
  }

  function handleStageSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const parsedLevelId = Number.parseInt(stageInput, 10);

    if (Number.isNaN(parsedLevelId)) {
      setStageInput(String(snapshot.levelId));
      stageRef.current?.focus();
      return;
    }

    jumpToLevel(parsedLevelId);
  }

  function setDirection(
    event: KeyboardEvent<HTMLDivElement>,
    pressed: boolean,
  ): boolean {
    if (event.code === "ArrowLeft" || event.code === "KeyA") {
      inputRef.current.left = pressed;
      return true;
    }

    if (event.code === "ArrowRight" || event.code === "KeyD") {
      inputRef.current.right = pressed;
      return true;
    }

    return false;
  }

  const isFinished = snapshot.phase === "finished";

  return (
    <main className="min-h-screen bg-[#0e1726] px-3 py-4 text-white sm:px-5 sm:py-6">
      <div className="mx-auto flex min-h-[calc(100vh-2rem)] w-full max-w-[1180px] flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/[0.06] px-4 py-3 shadow-[0_18px_56px_rgba(0,0,0,0.28)] backdrop-blur">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200">
              Scarab Bounce
            </p>
            <h1 className="mt-1 text-xl font-bold text-white sm:text-2xl">
              스캐럽 튀기기
            </h1>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2 text-sm font-semibold text-slate-200">
            <span className="rounded-full bg-cyan-400/15 px-3 py-1 text-cyan-100">
              Stage {snapshot.levelId}/{LEVEL_COUNT}
            </span>
            <span className="rounded-full bg-orange-400/15 px-3 py-1 text-orange-100">
              Deaths {snapshot.deaths}
            </span>
            <form
              onSubmit={handleStageSubmit}
              className="flex items-center gap-2"
            >
              <input
                type="number"
                min={1}
                max={LEVEL_COUNT}
                value={stageInput}
                onChange={handleStageInputChange}
                aria-label="이동할 스테이지"
                className="h-8 w-20 rounded-lg border border-white/20 bg-slate-950/70 px-3 text-sm font-bold text-white outline-none transition-colors placeholder:text-slate-500 focus:border-cyan-200 focus:ring-2 focus:ring-cyan-200/40"
              />
              <button
                type="submit"
                className="rounded-lg border border-cyan-200/40 bg-cyan-300/14 px-3 py-1.5 text-sm font-bold text-cyan-50 transition-colors hover:bg-cyan-300/22 focus:outline-none focus:ring-2 focus:ring-cyan-200"
              >
                이동
              </button>
            </form>
            <button
              type="button"
              onClick={restartGame}
              className="rounded-lg border border-white/20 bg-white/10 px-3 py-1.5 text-sm font-bold text-white transition-colors hover:bg-white/18 focus:outline-none focus:ring-2 focus:ring-cyan-200"
            >
              처음부터
            </button>
          </div>
        </div>

        <div
          ref={stageRef}
          tabIndex={0}
          aria-label="스캐럽 튀기기 게임 화면"
          onKeyDown={handleKeyDown}
          onKeyUp={handleKeyUp}
          className="relative outline-none focus-visible:ring-2 focus-visible:ring-cyan-200"
        >
          <canvas
            ref={canvasRef}
            width={VIEWPORT_WIDTH}
            height={VIEWPORT_HEIGHT}
            className="block aspect-video w-full rounded-lg border border-white/12 bg-slate-950 shadow-[0_24px_80px_rgba(0,0,0,0.4)]"
          />

          <div className="pointer-events-none absolute left-3 top-3 rounded-lg border border-white/10 bg-slate-950/54 px-3 py-2 text-sm font-semibold text-slate-100 sm:left-4 sm:top-4">
            {snapshot.levelName}
          </div>

          {isFinished ? (
            <div className="absolute inset-0 grid place-items-center rounded-lg bg-slate-950/72 px-4 text-center">
              <div className="max-w-md rounded-lg border border-yellow-200/30 bg-slate-900/92 px-6 py-7 shadow-[0_20px_70px_rgba(0,0,0,0.42)]">
                <p className="text-sm font-bold uppercase tracking-[0.2em] text-yellow-200">
                  Mission Complete
                </p>
                <h2 className="mt-3 text-3xl font-black text-white">
                  All Clear!
                </h2>
                <p className="mt-3 text-sm font-medium leading-6 text-slate-300">
                  스캐럽이 모든 스테이지를 통과했습니다.
                </p>
                <button
                  type="button"
                  onClick={restartGame}
                  className="mt-5 rounded-lg bg-yellow-300 px-4 py-2 text-sm font-black text-slate-950 transition-colors hover:bg-yellow-200 focus:outline-none focus:ring-2 focus:ring-white"
                >
                  다시 도전
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </main>
  );
}
