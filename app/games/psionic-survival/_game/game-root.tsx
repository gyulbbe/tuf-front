"use client";

import type { KeyboardEvent, PointerEvent, ReactElement, ReactNode } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  BOSS_DEFINITIONS,
  EVOLUTION_DEFINITIONS,
  FINAL_SURGE_SECONDS,
  UPGRADE_DEFINITIONS,
  VICTORY_SECONDS,
  VIEWPORT_HEIGHT,
  VIEWPORT_WIDTH,
  chooseUpgrade,
  createInputState,
  createRunSnapshot,
  createRunState,
  getBladeRadius,
  getSlowAuraRadius,
  stepRun,
} from "./engine";
import type {
  AbilityReadout,
  Boss,
  BossHazard,
  BossKind,
  Enemy,
  InputState,
  Particle,
  PlayerState,
  RunSnapshot,
  RunState,
  SanctuaryZone,
  UpgradeChoice,
  UpgradeId,
  Vector2,
  XpOrb,
} from "./types";

const ABILITY_ORDER: UpgradeId[] = [
  "psionicBlade",
  "phaseBeam",
  "purgeNova",
  "shieldOvercharge",
  "timeWarp",
  "dimensionalRift",
];

export default function PsionicSurvivalGame(): ReactElement {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<InputState>(createInputState());
  const runRef = useRef<RunState>(createRunState());
  const frameRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number | null>(null);
  const snapshotPhaseRef = useRef(runRef.current.phase);
  const snapshotTimerRef = useRef(0);
  const [snapshot, setSnapshot] = useState<RunSnapshot>(() =>
    createRunSnapshot(runRef.current),
  );

  const syncSnapshot = useCallback(() => {
    snapshotPhaseRef.current = runRef.current.phase;
    setSnapshot(createRunSnapshot(runRef.current));
  }, []);

  const restartGame = useCallback(() => {
    inputRef.current = createInputState();
    runRef.current = createRunState();
    lastTimeRef.current = null;
    snapshotTimerRef.current = 0;
    snapshotPhaseRef.current = runRef.current.phase;
    setSnapshot(createRunSnapshot(runRef.current));
    stageRef.current?.focus();
  }, []);

  const selectUpgrade = useCallback(
    (choice: UpgradeChoice) => {
      chooseUpgrade(runRef.current, choice);
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

    const canvasContext = context;

    function tick(timestamp: number) {
      const previousTimestamp = lastTimeRef.current ?? timestamp;
      const deltaSeconds = Math.max(0, (timestamp - previousTimestamp) / 1000);
      lastTimeRef.current = timestamp;

      stepRun(runRef.current, inputRef.current, deltaSeconds);
      renderGame(canvasContext, runRef.current, timestamp / 1000);

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

    renderGame(canvasContext, runRef.current, 0);
    frameRef.current = window.requestAnimationFrame(tick);

    return () => {
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
      }
    };
  }, [syncSnapshot]);

  useEffect(() => {
    function clearInput() {
      inputRef.current = createInputState();
    }

    window.addEventListener("blur", clearInput);
    document.addEventListener("visibilitychange", clearInput);

    return () => {
      window.removeEventListener("blur", clearInput);
      document.removeEventListener("visibilitychange", clearInput);
    };
  }, []);

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (
      (snapshot.phase === "gameover" || snapshot.phase === "victory") &&
      (event.code === "Enter" || event.code === "Space")
    ) {
      event.preventDefault();
      restartGame();
      return;
    }

    if (setKeyState(inputRef.current, event.code, true)) {
      event.preventDefault();
    }
  }

  function handleKeyUp(event: KeyboardEvent<HTMLDivElement>) {
    if (setKeyState(inputRef.current, event.code, false)) {
      event.preventDefault();
    }
  }

  function handlePointerDown(event: PointerEvent<HTMLCanvasElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    updatePointerTarget(event);
    stageRef.current?.focus();
  }

  function handlePointerMove(event: PointerEvent<HTMLCanvasElement>) {
    if (inputRef.current.pointerActive) {
      updatePointerTarget(event);
    }
  }

  function handlePointerUp(event: PointerEvent<HTMLCanvasElement>) {
    inputRef.current.pointerActive = false;
    inputRef.current.pointerTarget = null;

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  function updatePointerTarget(event: PointerEvent<HTMLCanvasElement>) {
    inputRef.current.pointerActive = true;
    inputRef.current.pointerTarget = getCanvasPoint(event);
  }

  return (
    <main className="min-h-screen overflow-hidden bg-[#02030a] text-white">
      <div className="relative min-h-screen px-2 py-2 sm:px-4 sm:py-4">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(34,211,238,0.16),transparent_34%),linear-gradient(180deg,rgba(2,6,23,0)_0%,rgba(2,6,23,0.88)_100%)]" />
        <section
          ref={stageRef}
          tabIndex={0}
          aria-label="사이오닉 서바이벌 아레나"
          onKeyDown={handleKeyDown}
          onKeyUp={handleKeyUp}
          className="relative mx-auto flex min-h-[calc(100vh-1rem)] w-full max-w-[1600px] items-center outline-none focus-visible:ring-2 focus-visible:ring-cyan-200 sm:min-h-[calc(100vh-2rem)]"
        >
          <div className="relative w-full overflow-hidden rounded-lg border border-cyan-100/20 bg-[#050814] shadow-[0_28px_120px_rgba(0,0,0,0.72),inset_0_0_70px_rgba(8,145,178,0.08)]">
            <canvas
              ref={canvasRef}
              width={VIEWPORT_WIDTH}
              height={VIEWPORT_HEIGHT}
              onPointerCancel={handlePointerUp}
              onPointerDown={handlePointerDown}
              onPointerLeave={handlePointerUp}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              className="block aspect-video w-full touch-none bg-[#050814]"
            />
            <div className="pointer-events-none absolute inset-0 border border-white/5 shadow-[inset_0_0_130px_rgba(103,232,249,0.08)]" />
            <div className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-black/72 to-transparent" />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/78 to-transparent" />
            <HudOverlay snapshot={snapshot} />
            <AbilityDock snapshot={snapshot} />
            {snapshot.phase === "levelUp" ? (
              <UpgradeOverlay
                options={snapshot.levelUpOptions}
                ranks={snapshot.upgradeRanks}
                evolvedUpgrades={snapshot.evolvedUpgrades}
                onChoose={selectUpgrade}
              />
            ) : null}
            {snapshot.phase === "gameover" || snapshot.phase === "victory" ? (
              <ResultOverlay snapshot={snapshot} onRestart={restartGame} />
            ) : null}
          </div>
        </section>
      </div>
    </main>
  );
}

function HudOverlay({ snapshot }: { snapshot: RunSnapshot }) {
  const progressToVictory = clampPercent((snapshot.elapsedSeconds / VICTORY_SECONDS) * 100);

  return (
    <div className="pointer-events-none absolute inset-x-2 top-2 grid gap-2 sm:inset-x-4 sm:top-4">
      <div className="grid gap-2 xl:grid-cols-[minmax(240px,0.9fr)_minmax(410px,1.4fr)_minmax(310px,1fr)]">
        <HudPanel className="min-w-0 overflow-hidden">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase text-cyan-200/75">
                Vanguard Protocol
              </p>
              <h1 className="mt-1 truncate text-lg font-black text-white sm:text-xl">
                사이오닉 서바이벌
              </h1>
            </div>
            <StatusChip tone={snapshot.finalSurge ? "danger" : "cyan"}>
              {snapshot.finalSurge ? "최종 공세" : "전장 안정"}
            </StatusChip>
          </div>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-950/80">
            <div
              className="h-full rounded-full bg-gradient-to-r from-cyan-300 via-yellow-200 to-red-300 shadow-[0_0_18px_rgba(103,232,249,0.4)]"
              style={{ width: `${progressToVictory}%` }}
            />
          </div>
        </HudPanel>

        <HudPanel className="grid grid-cols-4 divide-x divide-white/10 p-0">
          <TopStat label="Time" value={formatTime(snapshot.elapsedSeconds)} />
          <TopStat label="Level" value={`${snapshot.level}`} />
          <TopStat label="Kills" value={`${snapshot.kills}`} />
          <TopStat label="Elite" value={`${snapshot.eliteKills}`} />
        </HudPanel>

        <HudPanel className="grid gap-2">
          <div className="grid grid-cols-[1fr_auto] items-center gap-3">
            <div>
              <div className="flex items-center justify-between text-[10px] font-black uppercase text-slate-200">
                <span>Threat</span>
                <span className={getThreatTextClass(snapshot.threatLevel)}>
                  {snapshot.threatLevel.toString().padStart(2, "0")}%
                </span>
              </div>
              <Bar value={snapshot.threatLevel} tone="threat" />
            </div>
            <div className="min-w-[74px] text-right">
              <p className="text-[10px] font-black uppercase text-cyan-200/70">Heat</p>
              <p className="font-mono text-xl font-black text-yellow-100">
                {snapshot.heat}
              </p>
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <CompactMeter label="HP" max={snapshot.maxHp} tone="hp" value={snapshot.hp} />
            <CompactMeter
              label="Shield"
              max={snapshot.maxShield}
              tone="shield"
              value={snapshot.shield}
            />
          </div>
        </HudPanel>
      </div>
      <BossStatusStrip snapshot={snapshot} />
    </div>
  );
}

function BossStatusStrip({ snapshot }: { snapshot: RunSnapshot }) {
  if (snapshot.bossReadouts.length === 0 && !snapshot.bossWarning) {
    return null;
  }

  return (
    <HudPanel className="px-3 py-2">
      {snapshot.bossReadouts.length > 0 ? (
        <div className="grid gap-2">
          {snapshot.bossReadouts.map((boss) => {
            const hpPercent = boss.maxHp > 0 ? (boss.hp / boss.maxHp) * 100 : 0;
            const segmentCount = 8;

            return (
              <div key={boss.id} className="grid gap-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 rounded-full shadow-[0_0_14px_currentColor]"
                      style={{ color: getBossTone(boss.kind), backgroundColor: getBossTone(boss.kind) }}
                    />
                    <p className="text-sm font-black text-white">{boss.name}</p>
                    <StatusChip tone={boss.enraged ? "danger" : "gold"}>
                      {boss.enraged ? "광폭화" : boss.phaseText}
                    </StatusChip>
                  </div>
                  <p className="font-mono text-xs font-black text-cyan-100">
                    {boss.hp}/{boss.maxHp}
                  </p>
                </div>
                <div className="relative h-4 overflow-hidden rounded-full border border-white/10 bg-slate-950/88">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-red-500 via-orange-300 to-yellow-200 shadow-[0_0_22px_rgba(251,146,60,0.45)]"
                    style={{ width: `${clampPercent(hpPercent)}%` }}
                  />
                  <div className="absolute inset-0 grid" style={{ gridTemplateColumns: `repeat(${segmentCount}, 1fr)` }}>
                    {Array.from({ length: segmentCount - 1 }).map((_, index) => (
                      <span key={index} className="border-r border-black/35" />
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="flex items-center justify-between gap-3">
          <p className="text-[10px] font-black uppercase text-cyan-200/70">
            Boss Signal
          </p>
          <p className="text-xs font-black text-slate-100">{snapshot.bossWarning}</p>
        </div>
      )}
    </HudPanel>
  );
}

function HudPanel({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-lg border border-cyan-100/15 bg-[#06111f]/80 px-3 py-2 shadow-[0_18px_48px_rgba(0,0,0,0.38)] backdrop-blur-md ${className}`}
    >
      {children}
    </div>
  );
}

function TopStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid min-w-0 place-items-center px-2 py-2 text-center sm:py-3">
      <p className="text-[9px] font-black uppercase text-cyan-200/64">{label}</p>
      <p className="mt-1 font-mono text-lg font-black text-white sm:text-2xl">
        {value}
      </p>
    </div>
  );
}

function StatusChip({
  children,
  tone,
}: {
  children: ReactNode;
  tone: "cyan" | "danger" | "gold";
}) {
  const toneClass =
    tone === "danger"
      ? "border-red-200/30 bg-red-500/14 text-red-100"
      : tone === "gold"
        ? "border-yellow-200/30 bg-yellow-300/14 text-yellow-100"
        : "border-cyan-200/30 bg-cyan-300/12 text-cyan-100";

  return (
    <span
      className={`shrink-0 rounded border px-2 py-1 text-[10px] font-black uppercase ${toneClass}`}
    >
      {children}
    </span>
  );
}

function CompactMeter({
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
  const percent = max > 0 ? clampPercent((value / max) * 100) : 0;

  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-2 text-[10px] font-black uppercase text-slate-300">
        <span>{label}</span>
        <span className="font-mono text-slate-100">
          {value}/{max}
        </span>
      </div>
      <Bar value={percent} tone={tone} />
    </div>
  );
}

function Bar({ tone, value }: { tone: "heat" | "hp" | "shield" | "threat" | "xp"; value: number }) {
  return (
    <div className="h-2 overflow-hidden rounded-full bg-slate-950/85 shadow-[inset_0_0_10px_rgba(0,0,0,0.5)]">
      <div className={getBarClass(tone)} style={{ width: `${clampPercent(value)}%` }} />
    </div>
  );
}

function AbilityDock({ snapshot }: { snapshot: RunSnapshot }) {
  const readouts = ABILITY_ORDER.map((upgradeId) =>
    snapshot.abilityReadouts.find((readout) => readout.upgradeId === upgradeId),
  ).filter((readout): readout is AbilityReadout => Boolean(readout));
  const xpPercent = clampPercent((snapshot.xp / snapshot.xpToNext) * 100);

  return (
    <div className="pointer-events-none absolute inset-x-2 bottom-2 grid gap-2 sm:inset-x-4 sm:bottom-4">
      <HudPanel className="px-3 py-2">
        <div className="mb-2 flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-black uppercase text-cyan-200/75">
              Experience Core
            </p>
            <p className="hidden text-xs font-semibold text-slate-300 sm:block">
              {snapshot.xp}/{snapshot.xpToNext} 에너지 결정 동기화
            </p>
          </div>
          <div className="flex items-center gap-2">
            {snapshot.comboKills >= 4 ? (
              <StatusChip tone="gold">x{snapshot.comboKills} 연속 처치</StatusChip>
            ) : null}
            <StatusChip tone={snapshot.finalSurge ? "danger" : "cyan"}>
              {Math.max(0, Math.ceil(VICTORY_SECONDS - snapshot.elapsedSeconds))}s
            </StatusChip>
          </div>
        </div>
        <div className="relative h-4 overflow-hidden rounded-full border border-cyan-100/15 bg-slate-950/90">
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-cyan-400 via-sky-200 to-yellow-200 shadow-[0_0_26px_rgba(103,232,249,0.58)]"
            style={{ width: `${xpPercent}%` }}
          />
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(255,255,255,0.18)_1px,transparent_1px)] bg-[length:32px_100%] opacity-20" />
        </div>
      </HudPanel>

      <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        {readouts.map((readout) => (
          <AbilitySlot key={readout.upgradeId} readout={readout} />
        ))}
      </div>
    </div>
  );
}

function AbilitySlot({ readout }: { readout: AbilityReadout }) {
  const definition = UPGRADE_DEFINITIONS[readout.upgradeId];
  const tone = getAbilityTone(readout.upgradeId);
  const ringColor = readout.evolved ? "#fef08a" : tone;
  const ringStyle = {
    background: `conic-gradient(${ringColor} ${readout.cooldownRatio * 360}deg, rgba(15,23,42,0.86) 0deg)`,
  };

  return (
    <div
      className={`relative min-h-[72px] overflow-hidden rounded-lg border px-2 py-2 shadow-[0_14px_38px_rgba(0,0,0,0.42)] backdrop-blur-md ${
        readout.evolved
          ? "border-yellow-200/45 bg-yellow-200/10"
          : readout.isActive
            ? "border-cyan-200/25 bg-[#06111f]/86"
            : "border-white/10 bg-[#06111f]/52"
      }`}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.10),transparent_55%)]" />
      <div className="relative flex items-center gap-2">
        <div
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full p-[2px]"
          style={ringStyle}
        >
          <div className="grid h-full w-full place-items-center rounded-full bg-[#06111f] font-mono text-[11px] font-black text-white">
            {getAbilityGlyph(readout.upgradeId)}
          </div>
        </div>
        <div className="min-w-0">
          <p className="truncate text-xs font-black text-cyan-50">
            {readout.evolved ? readout.evolutionName : definition.shortName}
          </p>
          <div className="mt-1 flex gap-0.5">
            {Array.from({ length: readout.maxRank }).map((_, index) => (
              <span
                key={index}
                className={`h-1.5 w-3 rounded-full ${
                  index < readout.rank ? "bg-cyan-200" : "bg-white/12"
                } ${readout.evolved && index === readout.maxRank - 1 ? "bg-yellow-200" : ""}`}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

type UpgradeOverlayProps = {
  evolvedUpgrades: RunSnapshot["evolvedUpgrades"];
  onChoose: (choice: UpgradeChoice) => void;
  options: UpgradeChoice[];
  ranks: RunSnapshot["upgradeRanks"];
};

function UpgradeOverlay({
  evolvedUpgrades,
  onChoose,
  options,
  ranks,
}: UpgradeOverlayProps) {
  return (
    <div className="absolute inset-0 grid place-items-center bg-slate-950/80 px-3 backdrop-blur-md">
      <div className="w-full max-w-6xl rounded-lg border border-cyan-100/24 bg-[#06111f]/94 p-4 shadow-[0_32px_130px_rgba(0,0,0,0.68)] sm:p-5">
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-white/10 pb-4">
          <div>
            <p className="text-[10px] font-black uppercase text-cyan-200/80">
              Combat Evolution
            </p>
            <h2 className="mt-1 text-2xl font-black text-white sm:text-3xl">
              전투 진화 선택
            </h2>
          </div>
          <p className="max-w-md text-sm font-semibold leading-6 text-slate-300">
            일반 회로를 증폭하거나, 조건이 맞으면 완성형 진화 회로로 전투 양상을 바꿉니다.
          </p>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {options.map((choice) => {
            const detail = getChoiceDetail(choice, ranks, evolvedUpgrades);

            return (
              <button
                key={choice.id}
                type="button"
                onClick={() => onChoose(choice)}
                className={`group relative min-h-[244px] overflow-hidden rounded-lg border p-4 text-left shadow-[0_20px_58px_rgba(0,0,0,0.36)] transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-200 ${
                  choice.kind === "evolution"
                    ? "border-yellow-200/32 bg-yellow-200/10 hover:border-yellow-100/70"
                    : "border-cyan-100/16 bg-slate-950/68 hover:border-cyan-200/60 hover:bg-[#10233a]"
                }`}
              >
                <div
                  className="absolute -right-10 -top-10 h-32 w-32 rounded-full opacity-20 blur-2xl"
                  style={{ backgroundColor: detail.color }}
                />
                <div className="relative flex items-start justify-between gap-3">
                  <ChoiceIcon choice={choice} color={detail.color} />
                  <div className="grid gap-1 text-right">
                    <StatusChip tone={choice.kind === "evolution" ? "gold" : "cyan"}>
                      {detail.kindLabel}
                    </StatusChip>
                    <span className="font-mono text-xs font-black text-slate-200">
                      {detail.rankLabel}
                    </span>
                  </div>
                </div>
                <strong className="relative mt-5 block text-xl font-black text-white">
                  {detail.name}
                </strong>
                <span className="relative mt-3 block text-sm font-semibold leading-7 text-slate-300">
                  {detail.description}
                </span>
                <span className="relative mt-5 block rounded border border-white/10 bg-black/18 px-3 py-2 text-xs font-bold leading-5 text-cyan-100/86">
                  {detail.hint}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function ChoiceIcon({ choice, color }: { choice: UpgradeChoice; color: string }) {
  return (
    <span
      className="relative grid h-14 w-14 shrink-0 place-items-center rounded-lg border border-white/15 bg-black/24 shadow-[inset_0_0_20px_rgba(255,255,255,0.08)]"
      style={{ boxShadow: `0 0 26px ${color}55, inset 0 0 20px rgba(255,255,255,0.08)` }}
    >
      <span
        className="absolute h-9 w-9 rounded-full border"
        style={{ borderColor: color }}
      />
      <span
        className="absolute h-1 w-10 rotate-45 rounded-full"
        style={{ backgroundColor: color }}
      />
      <span className="relative font-mono text-xs font-black text-white">
        {choice.kind === "evolution"
          ? "EV"
          : getAbilityGlyph(choice.upgradeId)}
      </span>
    </span>
  );
}

function ResultOverlay({
  onRestart,
  snapshot,
}: {
  onRestart: () => void;
  snapshot: RunSnapshot;
}) {
  const victory = snapshot.phase === "victory";
  const evolved = snapshot.abilityReadouts.filter((readout) => readout.evolved);
  const bestBuild = evolved.length > 0
    ? evolved.map((readout) => readout.evolutionName).join(" / ")
    : snapshot.abilityReadouts
        .filter((readout) => readout.rank > 0)
        .sort((left, right) => right.rank - left.rank)
        .slice(0, 3)
        .map((readout) => UPGRADE_DEFINITIONS[readout.upgradeId].shortName)
        .join(" / ") || "미완성 회로";
  const defeatedBossNames = snapshot.defeatedBosses
    .map((bossKind) => BOSS_DEFINITIONS[bossKind].name)
    .join(" / ") || "없음";

  return (
    <div className="absolute inset-0 grid place-items-center bg-slate-950/82 px-4 text-center backdrop-blur-md">
      <div
        className={`w-full max-w-3xl rounded-lg border p-6 shadow-[0_32px_130px_rgba(0,0,0,0.7)] ${
          victory
            ? "border-yellow-200/34 bg-[#07111f]/95"
            : "border-red-200/24 bg-[#07111f]/95"
        }`}
      >
        <p
          className={`text-[10px] font-black uppercase ${
            victory ? "text-yellow-100/80" : "text-red-200/80"
          }`}
        >
          {victory ? "Mission Complete" : "System Failure"}
        </p>
        <h2 className="mt-2 text-3xl font-black text-white sm:text-4xl">
          {victory ? "차원 회로 안정화" : "보호막 붕괴"}
        </h2>
        <p className="mx-auto mt-3 max-w-md text-sm font-semibold leading-6 text-slate-300">
          {snapshot.gameOverReason}
        </p>

        <div className="mt-6 grid grid-cols-3 divide-x divide-white/10 rounded-lg border border-white/10 bg-slate-950/52">
          <TopStat label="Survived" value={formatTime(snapshot.elapsedSeconds)} />
          <TopStat label="Kills" value={`${snapshot.kills}`} />
          <TopStat label="Boss" value={`${snapshot.defeatedBossCount}`} />
        </div>

        <div className="mt-4 grid gap-3 text-left sm:grid-cols-3">
          <HudPanel>
            <p className="text-[10px] font-black uppercase text-cyan-200/70">
              최고 빌드
            </p>
            <p className="mt-2 text-sm font-black text-white">{bestBuild}</p>
          </HudPanel>
          <HudPanel>
            <p className="text-[10px] font-black uppercase text-cyan-200/70">
              격파 보스
            </p>
            <p className="mt-2 text-sm font-black text-white">{defeatedBossNames}</p>
          </HudPanel>
          <HudPanel>
            <p className="text-[10px] font-black uppercase text-cyan-200/70">
              전투 열기
            </p>
            <p className="mt-2 font-mono text-2xl font-black text-yellow-100">
              {snapshot.heat}
            </p>
          </HudPanel>
        </div>

        <button
          type="button"
          onClick={onRestart}
          className={`mt-6 rounded-lg border px-6 py-3 text-sm font-black transition-colors focus:outline-none focus:ring-2 focus:ring-white ${
            victory
              ? "border-yellow-100/30 bg-yellow-200 text-[#2c2108] hover:bg-yellow-100"
              : "border-red-100/30 bg-red-200 text-[#301014] hover:bg-red-100"
          }`}
        >
          다시 출격
        </button>
      </div>
    </div>
  );
}

function setKeyState(input: InputState, code: string, pressed: boolean): boolean {
  if (code === "ArrowUp" || code === "KeyW") {
    input.up = pressed;
    return true;
  }

  if (code === "ArrowRight" || code === "KeyD") {
    input.right = pressed;
    return true;
  }

  if (code === "ArrowDown" || code === "KeyS") {
    input.down = pressed;
    return true;
  }

  if (code === "ArrowLeft" || code === "KeyA") {
    input.left = pressed;
    return true;
  }

  return false;
}

function getCanvasPoint(event: PointerEvent<HTMLCanvasElement>): Vector2 {
  const rect = event.currentTarget.getBoundingClientRect();

  return {
    x: ((event.clientX - rect.left) / rect.width) * VIEWPORT_WIDTH,
    y: ((event.clientY - rect.top) / rect.height) * VIEWPORT_HEIGHT,
  };
}

function renderGame(
  context: CanvasRenderingContext2D,
  state: RunState,
  elapsedSeconds: number,
) {
  context.clearRect(0, 0, VIEWPORT_WIDTH, VIEWPORT_HEIGHT);
  drawBackground(context, state, elapsedSeconds);
  drawSanctuaryZones(context, state.sanctuaryZones, elapsedSeconds);
  drawSlowAura(context, state.player, state.evolvedUpgrades.stasisBlade);
  drawBossHazards(context, state.bossHazards, elapsedSeconds);
  drawExperience(context, state.xpOrbs, state.player, elapsedSeconds);
  state.particles
    .filter((particle) => particle.kind !== "beam")
    .forEach((particle) => drawParticle(context, particle));
  state.enemies.forEach((enemy) => drawEnemy(context, enemy, elapsedSeconds));
  state.bosses.forEach((boss) => drawBoss(context, boss, elapsedSeconds));
  state.projectiles.forEach((projectile) => drawProjectile(context, projectile));
  state.particles
    .filter((particle) => particle.kind === "beam")
    .forEach((particle) => drawParticle(context, particle));
  drawPlayer(context, state, elapsedSeconds);
  drawArenaEdges(context, state, elapsedSeconds);
  drawVignette(context, state);
}

function drawBackground(
  context: CanvasRenderingContext2D,
  state: RunState,
  elapsedSeconds: number,
) {
  const gradient = context.createLinearGradient(0, 0, 0, VIEWPORT_HEIGHT);
  gradient.addColorStop(0, "#020617");
  gradient.addColorStop(0.44, "#07111f");
  gradient.addColorStop(1, state.elapsedSeconds >= FINAL_SURGE_SECONDS ? "#241018" : "#151322");
  context.fillStyle = gradient;
  context.fillRect(0, 0, VIEWPORT_WIDTH, VIEWPORT_HEIGHT);

  drawHexField(context, elapsedSeconds);
  drawEnergyLanes(context, state, elapsedSeconds);
  drawCracks(context, state, elapsedSeconds);
  drawStarDust(context, elapsedSeconds);
}

function drawHexField(context: CanvasRenderingContext2D, elapsedSeconds: number) {
  const size = 44;
  const height = Math.sin(Math.PI / 3) * size;

  context.save();
  context.strokeStyle = "rgba(103,232,249,0.12)";
  context.lineWidth = 1;

  for (let row = -1; row < VIEWPORT_HEIGHT / height + 2; row += 1) {
    for (let col = -1; col < VIEWPORT_WIDTH / (size * 1.5) + 2; col += 1) {
      const x = col * size * 1.5 + (row % 2) * size * 0.75;
      const y = row * height + Math.sin(elapsedSeconds * 0.12 + col) * 1.4;
      context.globalAlpha = 0.035 + ((row + col) % 5 === 0 ? 0.05 : 0);
      drawHex(context, x, y, size);
    }
  }

  context.restore();
}

function drawHex(context: CanvasRenderingContext2D, x: number, y: number, size: number) {
  context.beginPath();

  for (let index = 0; index < 6; index += 1) {
    const angle = (Math.PI / 3) * index;
    const px = x + Math.cos(angle) * size;
    const py = y + Math.sin(angle) * size;

    if (index === 0) {
      context.moveTo(px, py);
    } else {
      context.lineTo(px, py);
    }
  }

  context.closePath();
  context.stroke();
}

function drawEnergyLanes(
  context: CanvasRenderingContext2D,
  state: RunState,
  elapsedSeconds: number,
) {
  context.save();
  context.globalAlpha = 0.22 + state.heat / 600;
  context.lineWidth = 1.5;

  for (let index = 0; index < 7; index += 1) {
    const y = 90 + index * 92 + Math.sin(elapsedSeconds * 0.35 + index) * 12;
    const gradient = context.createLinearGradient(0, y, VIEWPORT_WIDTH, y);
    gradient.addColorStop(0, "rgba(34,211,238,0)");
    gradient.addColorStop(0.5, index % 2 === 0 ? "rgba(34,211,238,0.44)" : "rgba(250,204,21,0.32)");
    gradient.addColorStop(1, "rgba(34,211,238,0)");
    context.strokeStyle = gradient;
    context.beginPath();
    context.moveTo(0, y);
    context.bezierCurveTo(320, y - 38, 820, y + 38, VIEWPORT_WIDTH, y);
    context.stroke();
  }

  context.restore();
}

function drawCracks(
  context: CanvasRenderingContext2D,
  state: RunState,
  elapsedSeconds: number,
) {
  context.save();
  context.lineCap = "round";

  for (let index = 0; index < 10; index += 1) {
    const startX = (index * 173 + 91) % VIEWPORT_WIDTH;
    const startY = (index * 97 + 161) % VIEWPORT_HEIGHT;
    const segments = 5 + (index % 3);
    const hot = index % 3 === 0 || state.elapsedSeconds >= FINAL_SURGE_SECONDS;

    context.beginPath();
    context.moveTo(startX, startY);

    for (let step = 1; step <= segments; step += 1) {
      context.lineTo(
        startX + step * 32 + Math.sin(index + step) * 18,
        startY + Math.sin(step * 1.8 + index) * 36,
      );
    }

    context.strokeStyle = hot ? "rgba(250,204,21,0.18)" : "rgba(103,232,249,0.08)";
    context.lineWidth = hot ? 2 : 1;
    context.shadowColor = hot ? "#facc15" : "#67e8f9";
    context.shadowBlur = 8 + Math.sin(elapsedSeconds + index) * 3;
    context.stroke();
  }

  context.restore();
}

function drawStarDust(context: CanvasRenderingContext2D, elapsedSeconds: number) {
  context.save();

  for (let index = 0; index < 132; index += 1) {
    const x = (index * 137 + 41 + elapsedSeconds * (index % 3)) % VIEWPORT_WIDTH;
    const y = (index * 73 + 29 + elapsedSeconds * (index % 2)) % VIEWPORT_HEIGHT;
    const pulse = 0.45 + Math.sin(elapsedSeconds * 1.5 + index) * 0.25;

    context.globalAlpha = 0.1 + pulse * 0.2;
    context.fillStyle = index % 7 === 0 ? "#fef3c7" : "#93c5fd";
    context.fillRect(x, y, index % 7 === 0 ? 2 : 1.4, index % 7 === 0 ? 2 : 1.4);
  }

  context.restore();
}

function drawSanctuaryZones(
  context: CanvasRenderingContext2D,
  zones: SanctuaryZone[],
  elapsedSeconds: number,
) {
  zones.forEach((zone) => {
    const progress = Math.min(1, zone.life / (zone.life + zone.ttl));
    const pulse = 1 + Math.sin(elapsedSeconds * 5 + zone.radius) * 0.035;

    context.save();
    context.globalAlpha = Math.max(0.12, 0.44 * (1 - progress));
    context.fillStyle = "rgba(167,243,208,0.14)";
    context.strokeStyle = "rgba(254,240,138,0.62)";
    context.shadowColor = "#a7f3d0";
    context.shadowBlur = 26;
    context.lineWidth = 3;
    context.beginPath();
    context.arc(zone.pos.x, zone.pos.y, zone.radius * pulse, 0, Math.PI * 2);
    context.fill();
    context.stroke();
    context.setLineDash([12, 14]);
    context.strokeStyle = "rgba(103,232,249,0.42)";
    context.beginPath();
    context.arc(zone.pos.x, zone.pos.y, zone.radius * 0.72 * pulse, 0, Math.PI * 2);
    context.stroke();
    context.restore();
  });
}

function drawExperience(
  context: CanvasRenderingContext2D,
  orbs: XpOrb[],
  player: PlayerState,
  elapsedSeconds: number,
) {
  orbs.forEach((orb, index) => {
    const pulse = 1 + Math.sin(elapsedSeconds * 5 + index) * 0.12;
    const attracted = distance(orb.pos, player.pos) < player.magnetRadius + 74;

    if (attracted) {
      context.save();
      const gradient = context.createLinearGradient(orb.pos.x, orb.pos.y, player.pos.x, player.pos.y);
      gradient.addColorStop(0, "rgba(103,232,249,0.38)");
      gradient.addColorStop(1, "rgba(103,232,249,0)");
      context.strokeStyle = gradient;
      context.lineWidth = 1;
      context.beginPath();
      context.moveTo(orb.pos.x, orb.pos.y);
      context.lineTo(player.pos.x, player.pos.y);
      context.stroke();
      context.restore();
    }

    context.save();
    context.translate(orb.pos.x, orb.pos.y);
    context.rotate(elapsedSeconds * 1.8 + index);
    context.shadowColor = "#67e8f9";
    context.shadowBlur = attracted ? 24 : 16;
    context.fillStyle = attracted ? "#a5f3fc" : "#22d3ee";
    context.strokeStyle = "#cffafe";
    context.lineWidth = 1.5;
    context.beginPath();
    context.moveTo(0, -orb.radius * 1.55 * pulse);
    context.lineTo(orb.radius * 1.16, -orb.radius * 0.18);
    context.lineTo(orb.radius * 0.35, orb.radius * 1.45 * pulse);
    context.lineTo(-orb.radius * 1.1, orb.radius * 0.18);
    context.lineTo(-orb.radius * 0.32, -orb.radius * 0.98);
    context.closePath();
    context.fill();
    context.stroke();
    context.restore();
  });
}

function drawSlowAura(
  context: CanvasRenderingContext2D,
  player: PlayerState,
  evolved: boolean,
) {
  const auraRadius = getSlowAuraRadius(player);

  if (auraRadius <= 0) {
    return;
  }

  context.save();
  context.strokeStyle = evolved ? "rgba(167,243,208,0.42)" : "rgba(103,232,249,0.3)";
  context.fillStyle = evolved ? "rgba(167,243,208,0.055)" : "rgba(34,211,238,0.045)";
  context.lineWidth = evolved ? 3 : 2;
  context.setLineDash(evolved ? [6, 12] : [10, 10]);
  context.beginPath();
  context.arc(player.pos.x, player.pos.y, auraRadius, 0, Math.PI * 2);
  context.fill();
  context.stroke();
  context.restore();
}

function drawBossHazards(
  context: CanvasRenderingContext2D,
  hazards: BossHazard[],
  elapsedSeconds: number,
) {
  hazards.forEach((hazard) => {
    const active = hazard.life >= hazard.telegraphSeconds;
    const progress = active
      ? clamp01((hazard.life - hazard.telegraphSeconds) / Math.max(0.01, hazard.activeSeconds))
      : clamp01(hazard.life / Math.max(0.01, hazard.telegraphSeconds));
    const alpha = active ? 0.34 : 0.14 + Math.sin(elapsedSeconds * 12) * 0.04;

    context.save();
    context.globalAlpha = alpha;
    context.fillStyle = hazard.color;
    context.strokeStyle = hazard.color;
    context.shadowColor = hazard.color;
    context.shadowBlur = active ? 18 : 10;
    context.lineWidth = active ? 4 : 2;
    context.setLineDash(active ? [] : [12, 10]);

    if (hazard.kind === "chargeLane") {
      drawHazardLane(context, hazard, active);
    } else if (hazard.kind === "spineFan") {
      drawHazardFan(context, hazard);
    } else if (hazard.kind === "rotatingBeam") {
      drawHazardRotatingBeam(context, hazard, progress);
    } else if (hazard.kind === "collapseRing") {
      drawHazardCollapseRing(context, hazard, progress);
    } else {
      const radius = hazard.kind === "shockwave" && active
        ? hazard.radius * Math.max(0.28, progress)
        : hazard.radius;
      context.beginPath();
      context.arc(hazard.pos.x, hazard.pos.y, radius, 0, Math.PI * 2);
      context.fill();
      context.globalAlpha = Math.min(0.74, alpha + 0.22);
      context.stroke();
    }

    context.restore();
  });
}

function drawHazardLane(
  context: CanvasRenderingContext2D,
  hazard: BossHazard,
  active: boolean,
) {
  const lengthValue = hazard.length ?? 480;
  const widthValue = hazard.width ?? 64;

  context.save();
  context.translate(hazard.pos.x, hazard.pos.y);
  context.rotate(hazard.angle);
  context.beginPath();
  context.rect(0, -widthValue / 2, lengthValue, widthValue);
  context.fill();
  context.globalAlpha = active ? 0.68 : 0.38;
  context.strokeRect(0, -widthValue / 2, lengthValue, widthValue);
  context.restore();
}

function drawHazardFan(context: CanvasRenderingContext2D, hazard: BossHazard) {
  const arc = hazard.arc ?? 0.9;

  context.beginPath();
  context.moveTo(hazard.pos.x, hazard.pos.y);
  context.arc(
    hazard.pos.x,
    hazard.pos.y,
    hazard.radius,
    hazard.angle - arc / 2,
    hazard.angle + arc / 2,
  );
  context.closePath();
  context.fill();
  context.stroke();
}

function drawHazardRotatingBeam(
  context: CanvasRenderingContext2D,
  hazard: BossHazard,
  progress: number,
) {
  const angle = hazard.angle + progress * Math.PI * 1.38;
  const lengthValue = hazard.length ?? 700;
  const widthValue = hazard.width ?? 42;

  context.save();
  context.translate(hazard.pos.x, hazard.pos.y);
  context.rotate(angle);
  context.fillRect(0, -widthValue / 2, lengthValue, widthValue);
  context.fillRect(-lengthValue, -widthValue / 2, lengthValue, widthValue);
  context.globalAlpha = 0.72;
  context.strokeRect(0, -widthValue / 2, lengthValue, widthValue);
  context.strokeRect(-lengthValue, -widthValue / 2, lengthValue, widthValue);
  context.restore();
}

function drawHazardCollapseRing(
  context: CanvasRenderingContext2D,
  hazard: BossHazard,
  progress: number,
) {
  const innerRadius = hazard.innerRadius ?? 70;
  const radius = innerRadius + (hazard.radius - innerRadius) * progress;

  context.lineWidth = hazard.width ?? 26;
  context.beginPath();
  context.arc(hazard.pos.x, hazard.pos.y, radius, 0, Math.PI * 2);
  context.stroke();
}

function drawEnemy(context: CanvasRenderingContext2D, enemy: Enemy, elapsedSeconds: number) {
  if (enemy.elite) {
    drawEliteHalo(context, enemy, elapsedSeconds);
  }

  if (enemy.kind === "brute") {
    drawBrute(context, enemy, elapsedSeconds);
  } else if (enemy.kind === "skitter") {
    drawSkitter(context, enemy, elapsedSeconds);
  } else {
    drawCrawler(context, enemy, elapsedSeconds);
  }

  if (enemy.stunTimer > 0) {
    drawStasisBands(context, enemy, elapsedSeconds);
  }

  if (enemy.hp < enemy.maxHp || enemy.elite) {
    drawHealthBar(context, enemy);
  }
}

function drawEliteHalo(context: CanvasRenderingContext2D, enemy: Enemy, elapsedSeconds: number) {
  const color = getEnemyVariantColor(enemy);
  const pulse = 1 + Math.sin(elapsedSeconds * 5 + enemy.wobble) * 0.08;

  context.save();
  context.translate(enemy.pos.x, enemy.pos.y);
  context.strokeStyle = color;
  context.globalAlpha = 0.42;
  context.lineWidth = 2;
  context.setLineDash([8, 7]);
  context.rotate(elapsedSeconds * 0.9);
  context.beginPath();
  context.arc(0, 0, (enemy.radius + 13) * pulse, 0, Math.PI * 2);
  context.stroke();
  context.restore();
}

function drawCrawler(context: CanvasRenderingContext2D, enemy: Enemy, elapsedSeconds: number) {
  const angle = Math.atan2(enemy.velocity.y, enemy.velocity.x);
  const pulse = Math.sin(elapsedSeconds * 7 + enemy.wobble) * 0.08;

  context.save();
  context.translate(enemy.pos.x, enemy.pos.y);
  context.rotate(angle);
  context.scale(1 + pulse, 1 - pulse);
  context.shadowColor = getEnemyVariantColor(enemy);
  context.shadowBlur = enemy.elite ? 20 : 13;
  context.fillStyle = enemy.elite ? "#7f1d1d" : "#9f1239";
  context.beginPath();
  context.ellipse(0, 0, enemy.radius * 1.28, enemy.radius * 0.78, 0, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = getEnemyVariantColor(enemy);
  context.beginPath();
  context.arc(enemy.radius * 0.4, -enemy.radius * 0.16, enemy.radius * 0.36, 0, Math.PI * 2);
  context.fill();
  drawEnemyLegs(context, enemy.radius, enemy.elite ? "#fed7aa" : "#fecdd3");
  context.restore();
}

function drawSkitter(context: CanvasRenderingContext2D, enemy: Enemy, elapsedSeconds: number) {
  const angle = Math.atan2(enemy.velocity.y, enemy.velocity.x);
  const jitter = Math.sin(elapsedSeconds * 13 + enemy.wobble) * 3;

  context.save();
  context.translate(enemy.pos.x, enemy.pos.y);
  context.rotate(angle);
  context.shadowColor = getEnemyVariantColor(enemy);
  context.shadowBlur = enemy.elite ? 22 : 16;
  context.fillStyle = enemy.variant === "charger" ? "#dc2626" : "#be123c";
  context.beginPath();
  context.moveTo(enemy.radius + 8, 0);
  context.lineTo(-enemy.radius * 0.42, enemy.radius * 0.98 + jitter);
  context.lineTo(-enemy.radius * 1.22, 0);
  context.lineTo(-enemy.radius * 0.42, -enemy.radius * 0.98 - jitter);
  context.closePath();
  context.fill();
  context.strokeStyle = "rgba(254,205,211,0.72)";
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(-enemy.radius * 0.2, 0);
  context.lineTo(-enemy.radius * 1.7, -enemy.radius * 0.4);
  context.moveTo(-enemy.radius * 0.2, 0);
  context.lineTo(-enemy.radius * 1.7, enemy.radius * 0.4);
  context.stroke();
  context.restore();
}

function drawBrute(context: CanvasRenderingContext2D, enemy: Enemy, elapsedSeconds: number) {
  const angle = Math.atan2(enemy.velocity.y, enemy.velocity.x);
  const pulse = Math.sin(elapsedSeconds * 4 + enemy.wobble) * 0.06;

  context.save();
  context.translate(enemy.pos.x, enemy.pos.y);
  context.rotate(angle);
  context.scale(1 + pulse, 1 - pulse);
  context.shadowColor = getEnemyVariantColor(enemy);
  context.shadowBlur = enemy.elite ? 30 : 20;
  context.fillStyle = enemy.variant === "splitter" ? "#4c1d95" : "#581c87";
  context.beginPath();
  context.ellipse(0, 0, enemy.radius * 1.24, enemy.radius, 0, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = enemy.elite ? getEnemyVariantColor(enemy) : "#a855f7";
  context.beginPath();
  context.ellipse(enemy.radius * 0.26, -enemy.radius * 0.12, enemy.radius * 0.62, enemy.radius * 0.42, 0, 0, Math.PI * 2);
  context.fill();
  context.strokeStyle = "#f0abfc";
  context.lineWidth = 3;
  context.beginPath();
  context.moveTo(enemy.radius * 0.8, -enemy.radius * 0.35);
  context.lineTo(enemy.radius * 1.42, -enemy.radius * 0.78);
  context.moveTo(enemy.radius * 0.8, enemy.radius * 0.35);
  context.lineTo(enemy.radius * 1.42, enemy.radius * 0.78);
  context.stroke();
  drawEnemyLegs(context, enemy.radius, "#e9d5ff");
  context.restore();
}

function drawEnemyLegs(context: CanvasRenderingContext2D, radius: number, color: string) {
  context.strokeStyle = color;
  context.lineWidth = 2;

  for (let index = -2; index <= 2; index += 1) {
    if (index === 0) {
      continue;
    }

    context.beginPath();
    context.moveTo(-radius * 0.1, index * radius * 0.18);
    context.lineTo(-radius * 1.22, index * radius * 0.32);
    context.stroke();
  }
}

function drawStasisBands(context: CanvasRenderingContext2D, enemy: Enemy, elapsedSeconds: number) {
  context.save();
  context.translate(enemy.pos.x, enemy.pos.y);
  context.rotate(elapsedSeconds * 2.8);
  context.strokeStyle = "rgba(167,243,208,0.72)";
  context.shadowColor = "#a7f3d0";
  context.shadowBlur = 18;
  context.lineWidth = 2;
  context.beginPath();
  context.arc(0, 0, enemy.radius + 8, 0, Math.PI * 1.3);
  context.stroke();
  context.rotate(Math.PI);
  context.beginPath();
  context.arc(0, 0, enemy.radius + 13, 0, Math.PI * 1.15);
  context.stroke();
  context.restore();
}

function drawHealthBar(context: CanvasRenderingContext2D, enemy: Enemy) {
  const width = enemy.radius * (enemy.elite ? 3 : 2.4);
  const percent = Math.max(0, enemy.hp / enemy.maxHp);

  context.save();
  context.fillStyle = "rgba(15,23,42,0.82)";
  context.fillRect(enemy.pos.x - width / 2, enemy.pos.y - enemy.radius - 15, width, 4);
  context.fillStyle = getEnemyVariantColor(enemy);
  context.fillRect(enemy.pos.x - width / 2, enemy.pos.y - enemy.radius - 15, width * percent, 4);
  context.restore();
}

function drawBoss(context: CanvasRenderingContext2D, boss: Boss, elapsedSeconds: number) {
  const angle = Math.atan2(boss.velocity.y, boss.velocity.x);
  const pulse = 1 + Math.sin(elapsedSeconds * (boss.enraged ? 7 : 4) + boss.wobble) * 0.045;

  context.save();
  context.translate(boss.pos.x, boss.pos.y);
  context.rotate(angle);
  context.scale(pulse, 1 / pulse);
  context.shadowColor = getBossTone(boss.kind);
  context.shadowBlur = boss.enraged ? 42 : 30;

  if (boss.kind === "mawBreaker") {
    drawMawBreakerBoss(context, boss);
  } else if (boss.kind === "spineWeaver") {
    drawSpineWeaverBoss(context, boss, elapsedSeconds);
  } else {
    drawAbyssMatronBoss(context, boss, elapsedSeconds);
  }

  context.restore();
  drawBossLocalHealth(context, boss);
}

function drawMawBreakerBoss(context: CanvasRenderingContext2D, boss: Boss) {
  const tone = getBossTone(boss.kind);

  context.fillStyle = boss.enraged ? "#7f1d1d" : "#7c2d12";
  context.strokeStyle = tone;
  context.lineWidth = 3;
  context.beginPath();
  context.moveTo(boss.radius * 1.4, 0);
  context.lineTo(boss.radius * 0.45, -boss.radius * 0.86);
  context.lineTo(-boss.radius * 0.9, -boss.radius * 0.62);
  context.lineTo(-boss.radius * 1.15, 0);
  context.lineTo(-boss.radius * 0.9, boss.radius * 0.62);
  context.lineTo(boss.radius * 0.45, boss.radius * 0.86);
  context.closePath();
  context.fill();
  context.stroke();
  context.fillStyle = "#fef3c7";
  context.beginPath();
  context.moveTo(boss.radius * 0.85, -boss.radius * 0.42);
  context.lineTo(boss.radius * 1.25, 0);
  context.lineTo(boss.radius * 0.85, boss.radius * 0.42);
  context.lineTo(boss.radius * 0.52, 0);
  context.closePath();
  context.fill();
}

function drawSpineWeaverBoss(
  context: CanvasRenderingContext2D,
  boss: Boss,
  elapsedSeconds: number,
) {
  const tone = getBossTone(boss.kind);

  context.fillStyle = boss.enraged ? "#831843" : "#701a75";
  context.strokeStyle = tone;
  context.lineWidth = 3;
  context.beginPath();
  context.ellipse(0, 0, boss.radius * 1.12, boss.radius * 0.82, 0, 0, Math.PI * 2);
  context.fill();
  context.stroke();

  for (let index = -3; index <= 3; index += 1) {
    const offset = index * boss.radius * 0.28;
    const spike = boss.radius * (0.82 + Math.sin(elapsedSeconds * 4 + index) * 0.08);
    context.beginPath();
    context.moveTo(-boss.radius * 0.12, offset);
    context.lineTo(-spike, offset * 1.15);
    context.lineTo(-boss.radius * 0.28, offset + 8);
    context.closePath();
    context.fillStyle = tone;
    context.fill();
  }

  context.fillStyle = "#fdf2f8";
  context.beginPath();
  context.arc(boss.radius * 0.36, 0, boss.radius * 0.26, 0, Math.PI * 2);
  context.fill();
}

function drawAbyssMatronBoss(
  context: CanvasRenderingContext2D,
  boss: Boss,
  elapsedSeconds: number,
) {
  const tone = getBossTone(boss.kind);

  context.fillStyle = boss.enraged ? "#3b0764" : "#312e81";
  context.strokeStyle = tone;
  context.lineWidth = 3;
  context.beginPath();
  context.arc(0, 0, boss.radius, 0, Math.PI * 2);
  context.fill();
  context.stroke();

  for (let index = 0; index < 6; index += 1) {
    const angle = elapsedSeconds * 0.9 + (Math.PI * 2 * index) / 6;
    context.save();
    context.rotate(angle);
    context.strokeStyle = index % 2 === 0 ? "#c084fc" : "#67e8f9";
    context.lineWidth = 3;
    context.beginPath();
    context.moveTo(boss.radius * 0.48, 0);
    context.lineTo(boss.radius * 1.42, 0);
    context.stroke();
    context.restore();
  }

  context.fillStyle = "#fef9c3";
  context.beginPath();
  context.arc(0, 0, boss.radius * 0.32, 0, Math.PI * 2);
  context.fill();
}

function drawBossLocalHealth(context: CanvasRenderingContext2D, boss: Boss) {
  const width = boss.radius * 2.8;
  const percent = Math.max(0, boss.hp / boss.maxHp);

  context.save();
  context.fillStyle = "rgba(15,23,42,0.84)";
  context.fillRect(boss.pos.x - width / 2, boss.pos.y - boss.radius - 22, width, 6);
  context.fillStyle = getBossTone(boss.kind);
  context.fillRect(boss.pos.x - width / 2, boss.pos.y - boss.radius - 22, width * percent, 6);
  context.restore();
}

function drawProjectile(
  context: CanvasRenderingContext2D,
  projectile: RunState["projectiles"][number],
) {
  const angle = Math.atan2(projectile.velocity.y, projectile.velocity.x);
  const tail = normalize(projectile.velocity);
  const tailEnd = {
    x: projectile.pos.x - tail.x * 38,
    y: projectile.pos.y - tail.y * 38,
  };

  context.save();
  const gradient = context.createLinearGradient(tailEnd.x, tailEnd.y, projectile.pos.x, projectile.pos.y);
  gradient.addColorStop(0, "rgba(255,255,255,0)");
  gradient.addColorStop(1, projectile.trailColor);
  context.strokeStyle = gradient;
  context.lineWidth = 5;
  context.beginPath();
  context.moveTo(tailEnd.x, tailEnd.y);
  context.lineTo(projectile.pos.x, projectile.pos.y);
  context.stroke();
  context.translate(projectile.pos.x, projectile.pos.y);
  context.rotate(angle);
  context.shadowColor = projectile.color;
  context.shadowBlur = 24;
  context.fillStyle = projectile.color;
  context.beginPath();
  context.moveTo(16, 0);
  context.lineTo(-12, 6.5);
  context.lineTo(-6, 0);
  context.lineTo(-12, -6.5);
  context.closePath();
  context.fill();
  context.fillStyle = "rgba(255,255,255,0.88)";
  context.fillRect(-2, -1, 11, 2);
  context.restore();
}

function drawParticle(context: CanvasRenderingContext2D, particle: Particle) {
  if (particle.kind === "beam" && particle.end) {
    const alpha = Math.min(1, particle.ttl / 0.18);

    context.save();
    context.globalAlpha = alpha;
    context.strokeStyle = particle.color;
    context.lineWidth = particle.width ?? 4;
    context.shadowColor = particle.color;
    context.shadowBlur = 28;
    context.beginPath();
    context.moveTo(particle.pos.x, particle.pos.y);
    context.lineTo(particle.end.x, particle.end.y);
    context.stroke();
    context.strokeStyle = "rgba(255,255,255,0.75)";
    context.lineWidth = 1.4;
    context.stroke();
    context.restore();
    return;
  }

  if (particle.kind === "nova" || particle.kind === "shockwave") {
    const duration = particle.kind === "nova" ? 0.7 : 0.48;
    const progress = Math.min(1, particle.life / duration);

    context.save();
    context.globalAlpha = Math.max(0, 1 - progress);
    context.strokeStyle = particle.color;
    context.lineWidth = particle.width ?? 6;
    context.shadowColor = particle.color;
    context.shadowBlur = particle.kind === "nova" ? 34 : 24;
    context.beginPath();
    context.arc(particle.pos.x, particle.pos.y, particle.radius * progress, 0, Math.PI * 2);
    context.stroke();
    context.strokeStyle = "rgba(255,255,255,0.26)";
    context.lineWidth = 2;
    context.beginPath();
    context.arc(particle.pos.x, particle.pos.y, particle.radius * progress * 0.7, 0, Math.PI * 2);
    context.stroke();
    context.restore();
    return;
  }

  context.save();
  context.globalAlpha = Math.min(1, particle.ttl * (particle.kind === "xpTrail" ? 5 : 2.8));
  context.fillStyle = particle.color;
  context.shadowColor = particle.color;
  context.shadowBlur = particle.kind === "xpTrail" ? 8 : 12;
  context.beginPath();
  context.arc(particle.pos.x, particle.pos.y, particle.radius, 0, Math.PI * 2);
  context.fill();
  context.restore();
}

function drawPlayer(
  context: CanvasRenderingContext2D,
  state: RunState,
  elapsedSeconds: number,
) {
  const player = state.player;
  drawBladeRing(context, player, state.evolvedUpgrades.stasisBlade);

  const moving = Math.hypot(player.velocity.x, player.velocity.y) > 2;
  const velocityAngle = moving
    ? Math.atan2(player.velocity.y, player.velocity.x)
    : elapsedSeconds * 0.7;
  const hpRatio = player.maxHp > 0 ? player.hp / player.maxHp : 1;

  context.save();
  context.translate(player.pos.x, player.pos.y);
  drawShield(context, player, elapsedSeconds);

  if (moving) {
    context.save();
    context.rotate(velocityAngle);
    const thrust = context.createLinearGradient(-62, 0, -18, 0);
    thrust.addColorStop(0, "rgba(103,232,249,0)");
    thrust.addColorStop(1, "rgba(103,232,249,0.52)");
    context.fillStyle = thrust;
    context.beginPath();
    context.moveTo(-64, 0);
    context.lineTo(-22, -10);
    context.lineTo(-24, 10);
    context.closePath();
    context.fill();
    context.restore();
  }

  context.rotate(velocityAngle + Math.PI / 2);
  context.shadowColor = player.hurtTimer > 0 ? "#fca5a5" : "#67e8f9";
  context.shadowBlur = player.hurtTimer > 0 ? 36 : 28;

  context.fillStyle = hpRatio < 0.35 && Math.sin(elapsedSeconds * 18) > 0 ? "#f97316" : "#facc15";
  context.strokeStyle = "#fde68a";
  context.lineWidth = 2.5;
  context.beginPath();
  context.moveTo(0, -32);
  context.lineTo(15, -7);
  context.lineTo(25, 16);
  context.lineTo(0, 30);
  context.lineTo(-25, 16);
  context.lineTo(-15, -7);
  context.closePath();
  context.fill();
  context.stroke();

  context.fillStyle = "#0891b2";
  context.strokeStyle = "#cffafe";
  context.lineWidth = 1.5;
  context.beginPath();
  context.moveTo(0, -15);
  context.lineTo(10, 8);
  context.lineTo(0, 18);
  context.lineTo(-10, 8);
  context.closePath();
  context.fill();
  context.stroke();

  context.strokeStyle = "#fef3c7";
  context.lineWidth = 3;
  context.beginPath();
  context.moveTo(-24, 11);
  context.lineTo(-40, 24);
  context.moveTo(24, 11);
  context.lineTo(40, 24);
  context.stroke();
  context.restore();
}

function drawShield(
  context: CanvasRenderingContext2D,
  player: PlayerState,
  elapsedSeconds: number,
) {
  const shieldRatio = player.maxShield > 0 ? player.shield / player.maxShield : 0;
  const radius = player.radius + 18 + Math.sin(elapsedSeconds * 3) * 1.5;

  context.save();
  context.rotate(-elapsedSeconds * 0.7);
  context.strokeStyle = player.hurtTimer > 0 ? "#fca5a5" : "rgba(103,232,249,0.74)";
  context.lineWidth = 3;
  context.setLineDash([Math.max(4, 20 * shieldRatio), 7]);
  context.beginPath();
  context.arc(0, 0, radius, 0, Math.PI * 2);
  context.stroke();
  context.setLineDash([]);
  context.globalAlpha = 0.15 + shieldRatio * 0.17;
  context.fillStyle = "#22d3ee";
  context.beginPath();
  context.arc(0, 0, radius, 0, Math.PI * 2);
  context.fill();
  context.restore();
}

function drawBladeRing(
  context: CanvasRenderingContext2D,
  player: PlayerState,
  evolved: boolean,
) {
  const radius = getBladeRadius(player);

  if (radius <= 0) {
    return;
  }

  context.save();
  context.translate(player.pos.x, player.pos.y);
  context.strokeStyle = evolved ? "rgba(167,243,208,0.32)" : "rgba(250,204,21,0.28)";
  context.lineWidth = evolved ? 3 : 2;
  context.setLineDash(evolved ? [8, 8] : [4, 10]);
  context.beginPath();
  context.arc(0, 0, radius, 0, Math.PI * 2);
  context.stroke();
  context.setLineDash([]);

  for (let index = 0; index < (evolved ? 3 : 2); index += 1) {
    const angle = player.bladeAngle + (index * Math.PI * 2) / (evolved ? 3 : 2);
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;

    context.save();
    context.translate(x, y);
    context.rotate(angle + Math.PI / 2);
    context.shadowColor = evolved ? "#a7f3d0" : "#facc15";
    context.shadowBlur = 24;
    context.fillStyle = evolved ? "#a7f3d0" : index === 0 ? "#fef08a" : "#67e8f9";
    context.beginPath();
    context.moveTo(0, -20);
    context.lineTo(8, 8);
    context.lineTo(0, 20);
    context.lineTo(-8, 8);
    context.closePath();
    context.fill();
    context.restore();
  }

  context.restore();
}

function drawArenaEdges(
  context: CanvasRenderingContext2D,
  state: RunState,
  elapsedSeconds: number,
) {
  const finalSurge = state.elapsedSeconds >= FINAL_SURGE_SECONDS;
  const alpha = finalSurge ? 0.32 + Math.sin(elapsedSeconds * 6) * 0.08 : 0.12;

  context.save();
  context.strokeStyle = finalSurge ? `rgba(248,113,113,${alpha})` : `rgba(103,232,249,${alpha})`;
  context.lineWidth = finalSurge ? 8 : 4;
  context.strokeRect(10, 10, VIEWPORT_WIDTH - 20, VIEWPORT_HEIGHT - 20);
  context.restore();
}

function drawVignette(context: CanvasRenderingContext2D, state: RunState) {
  const threat = Math.min(1, getVisualThreat(state) / 100);
  const gradient = context.createRadialGradient(
    VIEWPORT_WIDTH / 2,
    VIEWPORT_HEIGHT / 2,
    VIEWPORT_HEIGHT * 0.25,
    VIEWPORT_WIDTH / 2,
    VIEWPORT_HEIGHT / 2,
    VIEWPORT_WIDTH * 0.68,
  );
  gradient.addColorStop(0, "rgba(0,0,0,0)");
  gradient.addColorStop(0.72, `rgba(0,0,0,${0.18 + threat * 0.06})`);
  gradient.addColorStop(
    1,
    state.elapsedSeconds >= FINAL_SURGE_SECONDS
      ? `rgba(127,29,29,${0.38 + threat * 0.28})`
      : `rgba(0,0,0,${0.42 + threat * 0.14})`,
  );
  context.fillStyle = gradient;
  context.fillRect(0, 0, VIEWPORT_WIDTH, VIEWPORT_HEIGHT);
}

function getChoiceDetail(
  choice: UpgradeChoice,
  ranks: RunSnapshot["upgradeRanks"],
  evolvedUpgrades: RunSnapshot["evolvedUpgrades"],
) {
  if (choice.kind === "evolution") {
    const evolution = EVOLUTION_DEFINITIONS[choice.evolutionId];
    const primary = UPGRADE_DEFINITIONS[evolution.primary];
    const secondary = UPGRADE_DEFINITIONS[evolution.secondary];

    return {
      color: "#facc15",
      description: evolution.description,
      hint: `${primary.shortName} 5랭크 + ${secondary.shortName} 2랭크로 개방된 완성형 회로입니다.`,
      kindLabel: evolvedUpgrades[choice.evolutionId] ? "진화 완료" : "진화",
      name: evolution.name,
      rankLabel: "EVOLVE",
    };
  }

  const definition = UPGRADE_DEFINITIONS[choice.upgradeId];
  const nextRank = Math.min(definition.maxRank, ranks[choice.upgradeId] + 1);

  return {
    color: getAbilityTone(choice.upgradeId),
    description: definition.description,
    hint: getUpgradeHint(choice.upgradeId, ranks),
    kindLabel: ranks[choice.upgradeId] === 0 ? "신규 회로" : "랭크 증폭",
    name: definition.name,
    rankLabel: `${ranks[choice.upgradeId]} -> ${nextRank}`,
  };
}

function getUpgradeHint(upgradeId: UpgradeId, ranks: RunSnapshot["upgradeRanks"]) {
  if (upgradeId === "psionicBlade") {
    return ranks.timeWarp >= 2
      ? "5랭크 달성 시 시간 왜곡장과 정지 칼날 진화가 열립니다."
      : "시간 왜곡장 2랭크와 조합하면 정지 칼날로 진화합니다.";
  }

  if (upgradeId === "phaseBeam") {
    return ranks.dimensionalRift >= 2
      ? "5랭크 달성 시 차원 분열과 분광 광선 진화가 열립니다."
      : "차원 분열 2랭크와 조합하면 분광 광선으로 진화합니다.";
  }

  if (upgradeId === "purgeNova") {
    return ranks.shieldOvercharge >= 2
      ? "5랭크 달성 시 보호막 과충전과 성역 폭발 진화가 열립니다."
      : "보호막 과충전 2랭크와 조합하면 성역 폭발로 진화합니다.";
  }

  return "주 능력의 진화 조건을 열거나 생존력을 안정적으로 끌어올립니다.";
}

function getAbilityGlyph(upgradeId: UpgradeId) {
  if (upgradeId === "psionicBlade") return "BLD";
  if (upgradeId === "phaseBeam") return "BEA";
  if (upgradeId === "purgeNova") return "NOV";
  if (upgradeId === "shieldOvercharge") return "SHD";
  if (upgradeId === "timeWarp") return "WRP";
  return "RFT";
}

function getAbilityTone(upgradeId: UpgradeId) {
  if (upgradeId === "psionicBlade") return "#facc15";
  if (upgradeId === "phaseBeam") return "#67e8f9";
  if (upgradeId === "purgeNova") return "#fde68a";
  if (upgradeId === "shieldOvercharge") return "#22d3ee";
  if (upgradeId === "timeWarp") return "#a7f3d0";
  return "#c4b5fd";
}

function getBarClass(tone: "heat" | "hp" | "shield" | "threat" | "xp") {
  if (tone === "hp") {
    return "h-full rounded-full bg-gradient-to-r from-red-500 via-rose-300 to-red-200 shadow-[0_0_16px_rgba(248,113,113,0.42)]";
  }

  if (tone === "shield") {
    return "h-full rounded-full bg-gradient-to-r from-cyan-500 via-cyan-200 to-white shadow-[0_0_16px_rgba(103,232,249,0.48)]";
  }

  if (tone === "threat") {
    return "h-full rounded-full bg-gradient-to-r from-cyan-300 via-yellow-300 to-red-400 shadow-[0_0_16px_rgba(250,204,21,0.34)]";
  }

  if (tone === "heat") {
    return "h-full rounded-full bg-gradient-to-r from-yellow-500 via-orange-300 to-red-300 shadow-[0_0_16px_rgba(251,146,60,0.38)]";
  }

  return "h-full rounded-full bg-gradient-to-r from-cyan-300 via-sky-200 to-yellow-200 shadow-[0_0_18px_rgba(103,232,249,0.45)]";
}

function getThreatTextClass(threatLevel: number) {
  if (threatLevel >= 72) return "font-mono text-red-200";
  if (threatLevel >= 42) return "font-mono text-yellow-200";
  return "font-mono text-cyan-100";
}

function getBossTone(kind: BossKind) {
  return BOSS_DEFINITIONS[kind].color;
}

function getEnemyVariantColor(enemy: Enemy) {
  if (enemy.variant === "shieldBreaker") return "#fb923c";
  if (enemy.variant === "charger") return "#fb7185";
  if (enemy.variant === "splitter") return "#c084fc";
  return enemy.kind === "brute" ? "#c084fc" : "#fb7185";
}

function getVisualThreat(state: RunState) {
  return Math.min(
    100,
    state.elapsedSeconds * 0.35 +
      state.enemies.length * 0.42 +
      state.bosses.length * 12 +
      state.bossHazards.length * 1.8 +
      state.level * 1.8,
  );
}

function formatTime(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60);
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function clampPercent(value: number) {
  return Math.max(0, Math.min(100, value));
}

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

function normalize(vector: Vector2): Vector2 {
  const vectorLength = Math.hypot(vector.x, vector.y);
  return vectorLength === 0
    ? { x: 0, y: 0 }
    : { x: vector.x / vectorLength, y: vector.y / vectorLength };
}

function distance(a: Vector2, b: Vector2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}
