"use client";

import type { KeyboardEvent, ReactElement } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  createInputState,
  createRunSnapshot,
  createRunState,
  stepRun,
  VIEWPORT_HEIGHT,
  VIEWPORT_WIDTH,
} from "./engine";
import { renderGame } from "./render";
import type { InputState, RunSnapshot, RunState } from "./types";

export default function BerserkerBrothersGame(): ReactElement {
  const initialRun = useMemo(() => createRunState(), []);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<InputState>(createInputState());
  const runRef = useRef<RunState>(initialRun);
  const frameRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number | null>(null);
  const snapshotTimerRef = useRef(0);
  const snapshotPhaseRef = useRef<RunState["phase"]>("title");
  const [snapshot, setSnapshot] = useState<RunSnapshot>(() =>
    createRunSnapshot(initialRun),
  );

  const syncSnapshot = useCallback(() => {
    snapshotPhaseRef.current = runRef.current.phase;
    setSnapshot(createRunSnapshot(runRef.current));
  }, []);

  const restartGame = useCallback((phase: RunState["phase"] = "playing") => {
    inputRef.current = createInputState();
    runRef.current = createRunState(phase);
    lastTimeRef.current = null;
    snapshotTimerRef.current = 0;
    snapshotPhaseRef.current = runRef.current.phase;
    setSnapshot(createRunSnapshot(runRef.current));
    stageRef.current?.focus();
  }, []);

  const startGame = useCallback(() => {
    if (runRef.current.phase === "title") {
      runRef.current.phase = "playing";
      runRef.current.message = "괴수를 모두 정리하세요";
      syncSnapshot();
    } else if (
      runRef.current.phase === "gameover" ||
      runRef.current.phase === "victory"
    ) {
      restartGame("playing");
    }

    stageRef.current?.focus();
  }, [restartGame, syncSnapshot]);

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
      const previousTimestamp = lastTimeRef.current ?? timestamp;
      const deltaSeconds = Math.max(0, (timestamp - previousTimestamp) / 1000);
      lastTimeRef.current = timestamp;

      stepRun(runRef.current, inputRef.current, deltaSeconds);
      renderGame(renderingContext, runRef.current);

      snapshotTimerRef.current += deltaSeconds;

      if (
        snapshotTimerRef.current >= 0.1 ||
        runRef.current.phase !== snapshotPhaseRef.current
      ) {
        snapshotTimerRef.current = 0;
        syncSnapshot();
      }

      frameRef.current = window.requestAnimationFrame(tick);
    }

    renderGame(renderingContext, runRef.current);
    frameRef.current = window.requestAnimationFrame(tick);

    return () => {
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
      }
    };
  }, [syncSnapshot]);

  useEffect(() => {
    function clearHeldInput() {
      const current = inputRef.current;
      inputRef.current = {
        ...createInputState(),
        startQueued: current.startQueued,
      };
    }

    window.addEventListener("blur", clearHeldInput);
    document.addEventListener("visibilitychange", clearHeldInput);

    return () => {
      window.removeEventListener("blur", clearHeldInput);
      document.removeEventListener("visibilitychange", clearHeldInput);
    };
  }, []);

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.code === "KeyR") {
      event.preventDefault();
      restartGame("playing");
      return;
    }

    if (setKeyState(inputRef.current, event.code, true, event.repeat)) {
      event.preventDefault();
    }
  }

  function handleKeyUp(event: KeyboardEvent<HTMLDivElement>) {
    if (setKeyState(inputRef.current, event.code, false, false)) {
      event.preventDefault();
    }
  }

  return (
    <main className="min-h-screen overflow-hidden bg-[#05030d] text-white">
      <div className="relative min-h-screen px-2 py-3 sm:px-4 sm:py-5">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(250,204,21,0.18),transparent_27%),radial-gradient(circle_at_82%_28%,rgba(34,211,238,0.15),transparent_24%),linear-gradient(180deg,rgba(5,3,13,0)_0%,rgba(5,3,13,0.96)_100%)]" />
        <section
          ref={stageRef}
          tabIndex={0}
          aria-label="광전사 브라더스 게임 화면"
          onKeyDown={handleKeyDown}
          onKeyUp={handleKeyUp}
          className="relative mx-auto flex min-h-[calc(100vh-1.5rem)] w-full max-w-[1180px] items-center outline-none focus-visible:ring-2 focus-visible:ring-yellow-200 sm:min-h-[calc(100vh-2.5rem)]"
        >
          <div className="relative w-full overflow-hidden rounded-lg border border-yellow-100/20 bg-[#09051a] shadow-[0_28px_120px_rgba(0,0,0,0.72),inset_0_0_72px_rgba(34,211,238,0.08)]">
            <canvas
              ref={canvasRef}
              width={VIEWPORT_WIDTH}
              height={VIEWPORT_HEIGHT}
              onPointerDown={() => stageRef.current?.focus()}
              className="block aspect-[10/7] w-full bg-[#05030d] [image-rendering:pixelated]"
            />
            <div className="pointer-events-none absolute inset-0 border border-white/5 shadow-[inset_0_0_90px_rgba(250,204,21,0.08)]" />
            <HudOverlay snapshot={snapshot} />
            <ControlDock />
            {snapshot.phase === "title" ? <TitleOverlay onStart={startGame} /> : null}
            {snapshot.phase === "stageClear" ? <StageClearOverlay /> : null}
            {snapshot.phase === "gameover" || snapshot.phase === "victory" ? (
              <ResultOverlay snapshot={snapshot} onRestart={() => restartGame("playing")} />
            ) : null}
          </div>
        </section>
      </div>
    </main>
  );
}

function HudOverlay({ snapshot }: { snapshot: RunSnapshot }): ReactElement {
  return (
    <div className="pointer-events-none absolute inset-x-2 top-2 flex flex-wrap items-start justify-between gap-2 sm:inset-x-4 sm:top-4">
      <div className="grid grid-cols-[44px_minmax(0,1fr)] gap-2 border border-yellow-100/25 bg-[linear-gradient(135deg,rgba(15,23,42,0.88),rgba(49,46,129,0.54))] p-2 shadow-[0_0_28px_rgba(34,211,238,0.12)] backdrop-blur">
        <UnitPortrait />
        <div className="min-w-0">
          <p className="text-[9px] font-black uppercase tracking-[0.22em] text-cyan-100/70">
            Aiur Vanguard
          </p>
          <h1 className="mt-1 truncate text-base font-black text-yellow-100 sm:text-lg">
            광전사 브라더스
          </h1>
          <p className="mt-1 truncate text-xs font-semibold text-cyan-100/85">
            {snapshot.stageId}. {snapshot.stageName}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap justify-end gap-1.5 text-xs font-bold">
        <HudChip label="점수" value={snapshot.score.toLocaleString("ko-KR")} />
        <HudChip label="목숨" value={`x ${snapshot.lives}`} />
        <HudChip label="열쇠" value={snapshot.keyStatus} />
        <HudChip label="폭탄" value={snapshot.bombReady ? "준비" : "충전"} />
      </div>

      {snapshot.bossHealthRatio > 0 ? (
        <div className="basis-full border border-fuchsia-200/25 bg-black/54 px-3 py-2 shadow-[0_0_22px_rgba(217,70,239,0.16)] backdrop-blur">
          <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-[0.18em] text-fuchsia-100/80">
            <span>
              Boss {snapshot.bossWave} · {snapshot.bossName}
              {snapshot.bossTier === 3 ? " · FINAL" : ""}
            </span>
            <span>{Math.ceil(snapshot.bossHealthRatio * 100)}%</span>
          </div>
          <div className="mt-1 h-2 border border-fuchsia-100/25 bg-fuchsia-950/70">
            <div
              className="h-full bg-[linear-gradient(90deg,#fb7185,#e879f9,#67e8f9)]"
              style={{ width: `${snapshot.bossHealthRatio * 100}%` }}
            />
          </div>
        </div>
      ) : null}

      {snapshot.message ? (
        <div className="basis-full border border-cyan-100/15 bg-black/34 px-3 py-1 text-center text-xs font-bold text-cyan-50/90 backdrop-blur">
          {snapshot.message}
        </div>
      ) : null}
    </div>
  );
}

function HudChip({ label, value }: { label: string; value: string }): ReactElement {
  return (
    <div className="min-w-[72px] border border-cyan-100/18 bg-[linear-gradient(180deg,rgba(8,47,73,0.72),rgba(2,6,23,0.78))] px-3 py-2 text-right shadow-[inset_0_0_16px_rgba(34,211,238,0.08)] backdrop-blur">
      <p className="text-[10px] font-black text-cyan-100/52">{label}</p>
      <p className="mt-0.5 text-yellow-100">{value}</p>
    </div>
  );
}

function UnitPortrait(): ReactElement {
  return (
    <div className="relative h-11 w-11 overflow-hidden border border-yellow-100/30 bg-[#0f172a] shadow-[inset_0_0_18px_rgba(34,211,238,0.18)]">
      <div className="absolute inset-1 bg-[radial-gradient(circle_at_50%_32%,#fde68a_0_12%,#d97706_13%_28%,#111827_29%_100%)]" />
      <div className="absolute left-2 top-5 h-3 w-2 bg-cyan-200 shadow-[0_0_10px_rgba(103,232,249,0.8)]" />
      <div className="absolute right-2 top-5 h-3 w-2 bg-cyan-200 shadow-[0_0_10px_rgba(103,232,249,0.8)]" />
      <div className="absolute inset-x-0 bottom-0 h-2 bg-yellow-500/70" />
    </div>
  );
}

function ControlDock(): ReactElement {
  const commands = [
    { keyName: "A/D", label: "이동" },
    { keyName: "Space", label: "도약" },
    { keyName: "J", label: "폭탄" },
    { keyName: "K", label: "수정" },
    { keyName: "R", label: "재시작" },
  ];

  return (
    <div className="pointer-events-none absolute inset-x-2 bottom-2 flex justify-center sm:bottom-4">
      <div className="grid grid-cols-5 gap-1 border border-cyan-100/18 bg-black/46 p-1.5 shadow-[0_0_28px_rgba(34,211,238,0.12)] backdrop-blur">
        {commands.map((command) => (
          <div
            key={command.keyName}
            className="grid h-10 min-w-12 place-items-center border border-yellow-100/20 bg-[linear-gradient(180deg,rgba(30,41,59,0.9),rgba(8,47,73,0.72))] px-1 text-center"
          >
            <span className="text-[9px] font-black text-yellow-100">{command.keyName}</span>
            <span className="text-[10px] font-bold text-cyan-100/74">{command.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function TitleOverlay({ onStart }: { onStart: () => void }): ReactElement {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black/38 px-4 backdrop-blur-[1px]">
      <div className="max-w-sm rounded-lg border border-yellow-100/25 bg-[#09051a]/88 p-5 text-center shadow-2xl">
        <p className="text-xs font-black uppercase tracking-[0.24em] text-cyan-100/80">
          Psionic Arcade
        </p>
        <h2 className="mt-2 text-2xl font-black text-yellow-100 sm:text-3xl">
          광전사 브라더스
        </h2>
        <p className="mt-3 text-sm font-semibold leading-6 text-white/78">
          폭탄으로 괴수를 정리하고 수정 열쇠를 차원문까지 운반하세요.
        </p>
        <button
          type="button"
          onClick={onStart}
          className="mt-5 rounded-md bg-yellow-200 px-5 py-2 text-sm font-black text-slate-950 shadow-[0_10px_30px_rgba(250,204,21,0.25)] transition hover:bg-yellow-100"
        >
          시작
        </button>
      </div>
    </div>
  );
}

function StageClearOverlay(): ReactElement {
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-cyan-950/18">
      <div className="rounded-md border border-cyan-100/30 bg-black/62 px-6 py-4 text-center shadow-xl backdrop-blur">
        <p className="text-xs font-black uppercase tracking-[0.28em] text-cyan-100/80">
          Gate Stabilized
        </p>
        <p className="mt-2 text-2xl font-black text-white">Stage Clear</p>
      </div>
    </div>
  );
}

function ResultOverlay({
  onRestart,
  snapshot,
}: {
  onRestart: () => void;
  snapshot: RunSnapshot;
}): ReactElement {
  const isVictory = snapshot.phase === "victory";

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black/55 px-4 backdrop-blur-[2px]">
      <div className="max-w-sm rounded-lg border border-white/20 bg-[#09051a]/92 p-5 text-center shadow-2xl">
        <p className="text-xs font-black uppercase tracking-[0.24em] text-cyan-100/75">
          {isVictory ? "All Gates Purged" : "Mission Failed"}
        </p>
        <h2 className="mt-2 text-2xl font-black text-yellow-100 sm:text-3xl">
          {isVictory ? "완전 정화" : "Game Over"}
        </h2>
        <p className="mt-3 text-sm font-semibold text-white/76">
          최종 점수 {snapshot.score.toLocaleString("ko-KR")}
        </p>
        <button
          type="button"
          onClick={onRestart}
          className="mt-5 rounded-md bg-cyan-200 px-5 py-2 text-sm font-black text-slate-950 transition hover:bg-cyan-100"
        >
          다시 시작
        </button>
      </div>
    </div>
  );
}

function setKeyState(
  input: InputState,
  code: string,
  pressed: boolean,
  repeat: boolean,
): boolean {
  if (code === "ArrowLeft" || code === "KeyA") {
    input.left = pressed;
    return true;
  }

  if (code === "ArrowRight" || code === "KeyD") {
    input.right = pressed;
    return true;
  }

  if (code === "ArrowUp" || code === "KeyW" || code === "Space") {
    input.up = pressed;
    input.jump = pressed;
    if (pressed && !repeat) {
      input.jumpQueued = true;
      input.startQueued = true;
    }
    return true;
  }

  if (code === "KeyJ" || code === "KeyZ") {
    input.bomb = pressed;
    if (pressed && !repeat) {
      input.bombQueued = true;
      input.startQueued = true;
    }
    return true;
  }

  if (code === "KeyK" || code === "KeyX") {
    input.use = pressed;
    if (pressed && !repeat) {
      input.useQueued = true;
    }
    return true;
  }

  if (code === "Enter") {
    if (pressed && !repeat) {
      input.startQueued = true;
    }
    return true;
  }

  return false;
}
