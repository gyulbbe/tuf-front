"use client";

import type { FormEvent, PointerEvent, ReactElement } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import {
  ARTIFACT_DESCRIPTIONS,
  ARTIFACT_LABELS,
  BOSS_LABELS,
  EVOLUTION_LABELS,
  VIEWPORT_HEIGHT,
  VIEWPORT_WIDTH,
  chooseRelic,
  createEmptyInput,
  createRunState,
  createSnapshot,
  renderGame,
  updateRun,
} from "./engine";
import type {
  ArtifactId,
  ArtifactRanks,
  InputState,
  RoomKind,
  RoomModifier,
  RoomSnapshot,
  RunSnapshot,
  RunState,
} from "./types";

const TRACKED_KEYS = new Set([
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "ArrowUp",
  "KeyA",
  "KeyD",
  "KeyS",
  "KeyW",
  "ShiftLeft",
  "ShiftRight",
  "Space",
]);

export default function PsionicWarriorGame(): ReactElement {
  const [initialRun] = useState(() => createRunState(createSeed(), "title"));
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<InputState>(createEmptyInput());
  const runRef = useRef<RunState>(initialRun);
  const frameRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number | null>(null);
  const lastSnapshotAtRef = useRef(0);
  const lastPhaseRef = useRef(initialRun.phase);
  const [seedInput, setSeedInput] = useState(initialRun.seed);
  const [snapshot, setSnapshot] = useState<RunSnapshot>(() =>
    createSnapshot(initialRun),
  );

  const syncSnapshot = useCallback(() => {
    setSnapshot(createSnapshot(runRef.current));
  }, []);

  const startRun = useCallback(
    (seed: string) => {
      const nextSeed = seed.trim() || createSeed();

      inputRef.current = createEmptyInput();
      runRef.current = createRunState(nextSeed, "playing");
      lastTimeRef.current = null;
      lastSnapshotAtRef.current = 0;
      lastPhaseRef.current = runRef.current.phase;
      setSeedInput(nextSeed);
      syncSnapshot();
      stageRef.current?.focus();
    },
    [syncSnapshot],
  );

  const queueDash = useCallback(() => {
    if (runRef.current.phase !== "playing") {
      return;
    }

    inputRef.current.dashQueued = true;
    stageRef.current?.focus();
  }, []);

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
      const now = timestamp / 1000;
      const lastTime = lastTimeRef.current ?? timestamp;
      const deltaSeconds = Math.max(0, (timestamp - lastTime) / 1000);

      lastTimeRef.current = timestamp;
      updateRun(runRef.current, inputRef.current, deltaSeconds, now);
      renderGame(renderingContext, runRef.current);

      if (
        now - lastSnapshotAtRef.current > 0.08 ||
        lastPhaseRef.current !== runRef.current.phase
      ) {
        lastSnapshotAtRef.current = now;
        lastPhaseRef.current = runRef.current.phase;
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
    function handleKeyDown(event: globalThis.KeyboardEvent) {
      if (isTextInput(event.target)) {
        return;
      }

      if (!TRACKED_KEYS.has(event.code)) {
        return;
      }

      event.preventDefault();

      if ((event.code === "Space" || event.code.startsWith("Shift")) && !event.repeat) {
        inputRef.current.dashQueued = true;
        return;
      }

      setKeyState(inputRef.current, event.code, true);
    }

    function handleKeyUp(event: globalThis.KeyboardEvent) {
      if (!TRACKED_KEYS.has(event.code)) {
        return;
      }

      event.preventDefault();
      setKeyState(inputRef.current, event.code, false);
    }

    function handleBlur() {
      inputRef.current = {
        ...createEmptyInput(),
        hasPointer: inputRef.current.hasPointer,
        pointerX: inputRef.current.pointerX,
        pointerY: inputRef.current.pointerY,
      };
    }

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", handleBlur);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", handleBlur);
    };
  }, []);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startRun(seedInput);
  }

  function handlePointerDown(event: PointerEvent<HTMLCanvasElement>) {
    const point = getCanvasPoint(event);

    inputRef.current.pointerDown = true;
    inputRef.current.hasPointer = true;
    inputRef.current.pointerX = point.x;
    inputRef.current.pointerY = point.y;
    event.currentTarget.setPointerCapture(event.pointerId);
    stageRef.current?.focus();
  }

  function handlePointerMove(event: PointerEvent<HTMLCanvasElement>) {
    const point = getCanvasPoint(event);

    inputRef.current.hasPointer = true;
    inputRef.current.pointerX = point.x;
    inputRef.current.pointerY = point.y;
  }

  function handlePointerUp(event: PointerEvent<HTMLCanvasElement>) {
    inputRef.current.pointerDown = false;

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  function handleRelicChoice(artifactId: ArtifactId) {
    chooseRelic(runRef.current, artifactId);
    syncSnapshot();
    stageRef.current?.focus();
  }

  return (
    <main className="min-h-screen bg-[#07080d] px-3 py-4 text-[#f5efd6] sm:px-5">
      <div
        ref={stageRef}
        tabIndex={0}
        className="mx-auto grid min-h-[calc(100vh-2rem)] w-full max-w-[1480px] gap-3 outline-none xl:grid-cols-[minmax(0,1fr)_330px]"
      >
        <section className="grid min-h-[720px] grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden rounded-lg border border-[#413c35] bg-[#101119] shadow-[0_24px_90px_rgba(0,0,0,0.55)]">
          <CommandBar
            seedInput={seedInput}
            snapshot={snapshot}
            onNewSeed={() => setSeedInput(createSeed())}
            onSeedChange={setSeedInput}
            onSubmit={handleSubmit}
          />

          <div className="relative grid place-items-center overflow-hidden bg-[#0b0c12] p-3">
            <div className="relative aspect-[16/10] w-full max-w-[1120px] overflow-hidden rounded-md border border-[#3c372e] bg-black shadow-[inset_0_0_0_1px_rgba(255,244,191,0.08),0_20px_70px_rgba(0,0,0,0.45)]">
              <canvas
                ref={canvasRef}
                width={VIEWPORT_WIDTH}
                height={VIEWPORT_HEIGHT}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
                className="h-full w-full cursor-crosshair touch-none"
                aria-label="사이오닉 전사 키우기 전투 화면"
              />
              <BossBar snapshot={snapshot} />
              <CombatOverlay snapshot={snapshot} onStart={() => startRun(seedInput)} />
            </div>

            {snapshot.phase === "choosingRelic" && snapshot.pendingRelicChoice ? (
              <RelicChoiceOverlay
                artifactRanks={snapshot.artifactRanks}
                options={snapshot.pendingRelicChoice.options}
                onChoose={handleRelicChoice}
              />
            ) : null}
          </div>

          <ActionStrip snapshot={snapshot} onDash={queueDash} />
        </section>

        <aside className="grid content-start gap-3">
          <StatusPanel snapshot={snapshot} />
          <MiniMap rooms={snapshot.rooms} />
          <RelicPanel artifactRanks={snapshot.artifactRanks} />
          <LogPanel logs={snapshot.logs} />
        </aside>
      </div>
    </main>
  );
}

type CommandBarProps = {
  onNewSeed: () => void;
  onSeedChange: (seed: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  seedInput: string;
  snapshot: RunSnapshot;
};

function CommandBar({
  onNewSeed,
  onSeedChange,
  onSubmit,
  seedInput,
  snapshot,
}: CommandBarProps) {
  return (
    <header className="grid gap-3 border-b border-[#312d27] bg-[#14151f] px-4 py-3 md:grid-cols-[1fr_auto] md:items-center">
      <div>
        <p className="font-mono text-[11px] font-black uppercase tracking-[0.22em] text-[#8fd3ff]">
          Psionic Action Roguelite
        </p>
        <h1 className="mt-1 text-2xl font-black text-[#fff4bf]">
          사이오닉 전사 키우기
        </h1>
      </div>

      <form onSubmit={onSubmit} className="flex flex-wrap items-center gap-2">
        <input
          value={seedInput}
          onChange={(event) => onSeedChange(event.target.value)}
          aria-label="Seed"
          className="h-10 w-44 rounded border border-[#5b5245] bg-[#080910] px-3 font-mono text-xs font-bold text-[#f5efd6] outline-none focus:border-[#8fd3ff] focus:ring-2 focus:ring-[#8fd3ff]/30"
        />
        <button
          type="button"
          onClick={onNewSeed}
          className="h-10 rounded border border-[#5b5245] bg-[#242331] px-3 text-xs font-black text-[#f5efd6] hover:border-[#8fd3ff] focus:outline-none focus:ring-2 focus:ring-[#8fd3ff]"
        >
          Seed
        </button>
        <button
          type="submit"
          className="h-10 rounded bg-[#d9a441] px-4 text-sm font-black text-[#17110a] hover:bg-[#f0c15c] focus:outline-none focus:ring-2 focus:ring-[#fff4bf]"
        >
          새 게임
        </button>
        <span className="rounded border border-[#3c372e] bg-[#0b0c12] px-3 py-2 text-xs font-black text-[#c9c1ad]">
          {getPhaseLabel(snapshot.phase)}
        </span>
      </form>
    </header>
  );
}

function CombatOverlay({
  onStart,
  snapshot,
}: {
  onStart: () => void;
  snapshot: RunSnapshot;
}) {
  if (snapshot.phase === "title") {
    return (
      <div className="absolute inset-0 grid place-items-center bg-black/62 px-4 backdrop-blur-[2px]">
        <div className="max-w-md rounded-md border border-[#5b5245] bg-[#14151f]/95 px-6 py-7 text-center shadow-[0_22px_80px_rgba(0,0,0,0.5)]">
          <p className="font-mono text-xs font-black uppercase tracking-[0.22em] text-[#8fd3ff]">
            Real-time Prototype
          </p>
          <h2 className="mt-3 text-3xl font-black text-[#fff4bf]">균열 진입</h2>
          <p className="mt-3 text-sm font-semibold leading-7 text-[#c9c1ad]">
            방을 클리어하고 유물을 골라 전투 방식을 키워나가세요.
          </p>
          <button
            type="button"
            onClick={onStart}
            className="mt-6 rounded bg-[#d9a441] px-5 py-3 text-sm font-black text-[#17110a] hover:bg-[#f0c15c] focus:outline-none focus:ring-2 focus:ring-[#fff4bf]"
          >
            시작
          </button>
        </div>
      </div>
    );
  }

  if (snapshot.phase === "gameover") {
    return (
      <div className="absolute inset-0 grid place-items-center bg-black/68 px-4 text-center backdrop-blur-[2px]">
        <div className="max-w-md rounded-md border border-[#7f1d1d] bg-[#14151f]/95 px-6 py-7 shadow-[0_22px_80px_rgba(0,0,0,0.5)]">
          <p className="font-mono text-xs font-black uppercase tracking-[0.22em] text-[#ffb4a6]">
            Game Over
          </p>
          <h2 className="mt-3 text-3xl font-black text-[#fff4bf]">전사가 쓰러졌습니다</h2>
          <p className="mt-3 text-sm font-bold text-[#c9c1ad]">
            {snapshot.floor}층 · {snapshot.killCount} 처치
          </p>
          <button
            type="button"
            onClick={onStart}
            className="mt-6 rounded bg-[#d9a441] px-5 py-3 text-sm font-black text-[#17110a] hover:bg-[#f0c15c] focus:outline-none focus:ring-2 focus:ring-[#fff4bf]"
          >
            다시 시작
          </button>
        </div>
      </div>
    );
  }

  return null;
}

function BossBar({ snapshot }: { snapshot: RunSnapshot }) {
  if (!snapshot.bossKind || snapshot.bossHp === null || snapshot.bossMaxHp === null) {
    return null;
  }

  const percent = Math.max(0, Math.min(100, (snapshot.bossHp / snapshot.bossMaxHp) * 100));

  return (
    <div className="pointer-events-none absolute left-1/2 top-4 w-[min(720px,calc(100%-2rem))] -translate-x-1/2 rounded border border-[#5b2633] bg-[#12070c]/86 px-4 py-3 shadow-[0_14px_40px_rgba(0,0,0,0.45)]">
      <div className="flex items-center justify-between gap-3 text-xs font-black text-[#ffd6de]">
        <span>{BOSS_LABELS[snapshot.bossKind]}</span>
        <span>
          Phase {snapshot.bossPhase ?? 1}
          {snapshot.bossPatternLabel ? ` · ${snapshot.bossPatternLabel}` : ""}
        </span>
      </div>
      <div className="mt-2 h-3 overflow-hidden rounded-sm border border-[#7f1d1d] bg-[#1f0b12]">
        <div className="h-full bg-[#f43f5e]" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

function ActionStrip({
  onDash,
  snapshot,
}: {
  onDash: () => void;
  snapshot: RunSnapshot;
}) {
  const dashReady = snapshot.dashCooldownRemaining <= 0;

  return (
    <footer className="grid gap-3 border-t border-[#312d27] bg-[#14151f] px-4 py-3 md:grid-cols-[1fr_auto] md:items-center">
      <div className="flex flex-wrap gap-2">
        <ActionChip active label="이동" value="활성" />
        <ActionChip active={snapshot.phase === "playing"} label="공격" value="수동" />
        <ActionChip
          active={dashReady && snapshot.phase === "playing"}
          label="돌진"
          value={dashReady ? "Ready" : `${snapshot.dashCooldownRemaining.toFixed(1)}s`}
        />
      </div>
      <button
        type="button"
        disabled={!dashReady || snapshot.phase !== "playing"}
        onClick={onDash}
        className="h-11 rounded border border-[#5b5245] bg-[#242331] px-5 text-sm font-black text-[#f5efd6] hover:border-[#8fd3ff] disabled:opacity-45"
      >
        돌진
      </button>
    </footer>
  );
}

function ActionChip({
  active,
  label,
  value,
}: {
  active: boolean;
  label: string;
  value: string;
}) {
  return (
    <span
      className={cn(
        "rounded border px-3 py-2 text-xs font-black",
        active
          ? "border-[#8fd3ff] bg-[#102331] text-[#d9f7ff]"
          : "border-[#3c372e] bg-[#0b0c12] text-[#766f62]",
      )}
    >
      {label} · {value}
    </span>
  );
}

function StatusPanel({ snapshot }: { snapshot: RunSnapshot }) {
  return (
    <section className="rounded-lg border border-[#312d27] bg-[#14151f] p-4 shadow-[0_18px_60px_rgba(0,0,0,0.28)]">
      <p className="font-mono text-xs font-black uppercase tracking-[0.2em] text-[#8fd3ff]">
        Status
      </p>
      <div className="mt-3 grid gap-3">
        <Meter label="HP" max={snapshot.maxHp} tone="hp" value={snapshot.hp} />
        <Meter label="Shield" max={snapshot.maxShield} tone="shield" value={snapshot.shield} />
        <div className="grid grid-cols-2 gap-2 text-sm font-bold">
          <Stat label="층" value={`${snapshot.floor}`} />
          <Stat label="처치" value={`${snapshot.killCount}`} />
          <Stat label="공격력" value={`${snapshot.attack}`} />
          <Stat label="방" value={getRoomKindLabel(snapshot.currentRoomKind)} />
          <Stat label="변주" value={getModifierLabel(snapshot.currentRoomModifier)} />
          <Stat label="돌진" value={`${snapshot.dashCooldownRemaining.toFixed(1)}s`} />
          <Stat label="형태" value={EVOLUTION_LABELS[snapshot.evolution]} />
        </div>
      </div>
    </section>
  );
}

function MiniMap({ rooms }: { rooms: RoomSnapshot[] }) {
  const discovered = rooms.filter((room) => room.discovered);
  const visibleRooms = discovered.length > 0 ? discovered : rooms.slice(0, 1);
  const minX = Math.min(...visibleRooms.map((room) => room.gridX));
  const maxX = Math.max(...visibleRooms.map((room) => room.gridX));
  const minY = Math.min(...visibleRooms.map((room) => room.gridY));
  const maxY = Math.max(...visibleRooms.map((room) => room.gridY));
  const width = maxX - minX + 1;
  const height = maxY - minY + 1;

  return (
    <section className="rounded-lg border border-[#312d27] bg-[#14151f] p-4 shadow-[0_18px_60px_rgba(0,0,0,0.28)]">
      <p className="font-mono text-xs font-black uppercase tracking-[0.2em] text-[#8fd3ff]">
        Mini Map
      </p>
      <div
        className="mt-3 grid gap-1"
        style={{
          gridTemplateColumns: `repeat(${width}, minmax(0, 1fr))`,
        }}
      >
        {Array.from({ length: width * height }).map((_, index) => {
          const x = minX + (index % width);
          const y = minY + Math.floor(index / width);
          const room = rooms.find((entry) => entry.gridX === x && entry.gridY === y);

          return (
            <span
              key={`${x},${y}`}
              className={cn(
                "aspect-square rounded-sm border",
                !room?.discovered && "border-transparent bg-transparent",
                room?.discovered && "border-[#3c372e] bg-[#272633]",
                room?.cleared && "bg-[#234039]",
                room?.kind === "boss" && room.discovered && "bg-[#7f1d1d]",
                room?.kind === "elite" && room.discovered && "bg-[#7c5b1d]",
                room?.kind === "event" && room.discovered && "bg-[#164e63]",
                room?.kind === "portal" && room.discovered && "bg-[#6b4b16]",
                room?.kind === "treasure" && room.discovered && "bg-[#443062]",
                room?.current && "border-[#8fd3ff] bg-[#8fd3ff]",
              )}
            />
          );
        })}
      </div>
    </section>
  );
}

function RelicPanel({ artifactRanks }: { artifactRanks: ArtifactRanks }) {
  const entries = Object.entries(artifactRanks).filter(([, rank]) => rank > 0);

  return (
    <section className="rounded-lg border border-[#312d27] bg-[#14151f] p-4 shadow-[0_18px_60px_rgba(0,0,0,0.28)]">
      <p className="font-mono text-xs font-black uppercase tracking-[0.2em] text-[#8fd3ff]">
        Relics
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {entries.length > 0 ? (
          entries.map(([artifactId, rank]) => (
            <span
              key={artifactId}
              className="rounded border border-[#5b5245] bg-[#23202b] px-2 py-1 text-xs font-bold text-[#fff4bf]"
            >
              {ARTIFACT_LABELS[artifactId as ArtifactId]} {rank}
            </span>
          ))
        ) : (
          <span className="text-sm font-semibold text-[#766f62]">보유 유물 없음</span>
        )}
      </div>
    </section>
  );
}

function LogPanel({ logs }: { logs: string[] }) {
  return (
    <section className="rounded-lg border border-[#312d27] bg-[#14151f] p-4 shadow-[0_18px_60px_rgba(0,0,0,0.28)]">
      <p className="font-mono text-xs font-black uppercase tracking-[0.2em] text-[#8fd3ff]">
        Log
      </p>
      <ol className="mt-3 grid gap-2">
        {logs.map((log, index) => (
          <li
            key={`${log}-${index}`}
            className="rounded border border-[#312d27] bg-[#0b0c12] px-3 py-2 text-sm font-semibold leading-6 text-[#d8d0bc]"
          >
            {log}
          </li>
        ))}
      </ol>
    </section>
  );
}

function RelicChoiceOverlay({
  artifactRanks,
  onChoose,
  options,
}: {
  artifactRanks: ArtifactRanks;
  onChoose: (artifactId: ArtifactId) => void;
  options: ArtifactId[];
}) {
  return (
    <div className="absolute inset-0 z-10 grid place-items-center bg-black/72 px-4 backdrop-blur-sm">
      <div className="w-full max-w-4xl rounded-lg border border-[#d9a441] bg-[#14151f] p-5 shadow-[0_22px_80px_rgba(0,0,0,0.55)]">
        <p className="font-mono text-xs font-black uppercase tracking-[0.2em] text-[#8fd3ff]">
          Relic Choice
        </p>
        <h2 className="mt-2 text-2xl font-black text-[#fff4bf]">유물 선택</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {options.map((artifactId) => (
            <button
              key={artifactId}
              type="button"
              onClick={() => onChoose(artifactId)}
              className="min-h-44 rounded-md border border-[#5b5245] bg-[#0b0c12] p-4 text-left hover:border-[#8fd3ff] focus:outline-none focus:ring-2 focus:ring-[#8fd3ff]"
            >
              <span className="font-mono text-xs font-black text-[#d9a441]">
                Rank {artifactRanks[artifactId] + 1}
              </span>
              <strong className="mt-2 block text-lg font-black text-[#fff4bf]">
                {ARTIFACT_LABELS[artifactId]}
              </strong>
              <span className="mt-2 block text-sm font-semibold leading-6 text-[#c9c1ad]">
                {ARTIFACT_DESCRIPTIONS[artifactId]}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function Meter({
  label,
  max,
  tone,
  value,
}: {
  label: string;
  max: number;
  tone: "hp" | "shield";
  value: number;
}) {
  const percent = Math.max(0, Math.min(100, (value / max) * 100));

  return (
    <div>
      <div className="mb-1 flex justify-between text-xs font-black text-[#c9c1ad]">
        <span>{label}</span>
        <span>
          {value}/{max}
        </span>
      </div>
      <div className="h-3 overflow-hidden rounded-sm border border-[#312d27] bg-[#07080d]">
        <div
          className={cn("h-full", tone === "hp" ? "bg-[#c2412d]" : "bg-[#2bb7c8]")}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 border-l border-[#5b5245] pl-3">
      <p className="text-xs font-black text-[#766f62]">{label}</p>
      <p className="mt-1 truncate text-[#fff4bf]">{value}</p>
    </div>
  );
}

function setKeyState(input: InputState, code: string, pressed: boolean) {
  if (code === "KeyW") {
    input.up = pressed;
  } else if (code === "KeyA") {
    input.left = pressed;
  } else if (code === "KeyS") {
    input.down = pressed;
  } else if (code === "KeyD") {
    input.right = pressed;
  } else if (code === "ArrowUp") {
    input.fireUp = pressed;
  } else if (code === "ArrowLeft") {
    input.fireLeft = pressed;
  } else if (code === "ArrowDown") {
    input.fireDown = pressed;
  } else if (code === "ArrowRight") {
    input.fireRight = pressed;
  }
}

function getCanvasPoint(event: PointerEvent<HTMLCanvasElement>) {
  const rect = event.currentTarget.getBoundingClientRect();

  return {
    x: ((event.clientX - rect.left) / rect.width) * VIEWPORT_WIDTH,
    y: ((event.clientY - rect.top) / rect.height) * VIEWPORT_HEIGHT,
  };
}

function isTextInput(target: EventTarget | null) {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement
  );
}

function getPhaseLabel(phase: RunSnapshot["phase"]) {
  if (phase === "choosingRelic") {
    return "유물 선택";
  }

  if (phase === "gameover") {
    return "종료";
  }

  if (phase === "playing") {
    return "전투";
  }

  return "대기";
}

function getRoomKindLabel(kind: RoomKind) {
  if (kind === "boss") {
    return "보스";
  }

  if (kind === "elite") {
    return "엘리트";
  }

  if (kind === "event") {
    return "이벤트";
  }

  if (kind === "portal") {
    return "층문";
  }

  if (kind === "treasure") {
    return "유물";
  }

  if (kind === "combat") {
    return "전투";
  }

  return "진입";
}

function getModifierLabel(modifier: RoomModifier) {
  if (modifier === "barrage") {
    return "탄막";
  }

  if (modifier === "eliteBoost") {
    return "강화";
  }

  if (modifier === "healingWell") {
    return "회복";
  }

  if (modifier === "narrow") {
    return "협소";
  }

  if (modifier === "relicCache") {
    return "유물";
  }

  if (modifier === "slowField") {
    return "감속";
  }

  return "기본";
}

function createSeed() {
  return `rift-${Date.now().toString(36).slice(-6)}`;
}
