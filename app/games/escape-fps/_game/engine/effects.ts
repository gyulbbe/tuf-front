export type EffectType =
  | "blood-splat"
  | "explosion"
  | "enemy-shot"
  | "muzzle-flash"
  | "screen-shake"
  | "tracer"
  | "wall-spark";

export type Effect = {
  data: Record<string, unknown>;
  durationMs: number;
  id: string;
  startedAt: number;
  type: EffectType;
};

let nextEffectId = 0;
const effects: Effect[] = [];

export function addEffect(effect: Omit<Effect, "id" | "startedAt">): void {
  if (effect.durationMs <= 0) {
    return;
  }

  effects.push({
    ...effect,
    id: `effect-${nextEffectId}`,
    startedAt: performance.now(),
  });
  nextEffectId += 1;
}

export function clearEffects(): void {
  effects.length = 0;
  nextEffectId = 0;
}

export function tickEffects(now: number): void {
  for (let index = effects.length - 1; index >= 0; index -= 1) {
    const effect = effects[index];

    if (effect && now - effect.startedAt >= effect.durationMs) {
      effects.splice(index, 1);
    }
  }
}

export function getActiveEffects(): readonly Effect[] {
  return effects;
}

export function getEffectProgress(effect: Effect, now: number): number {
  return Math.max(0, Math.min(1, (now - effect.startedAt) / effect.durationMs));
}

export function getCameraShake(now: number): { x: number; y: number } {
  let x = 0;
  let y = 0;

  for (const effect of effects) {
    if (effect.type !== "screen-shake") {
      continue;
    }

    const progress = getEffectProgress(effect, now);
    const rawMagnitude = effect.data.magnitude;
    const magnitude =
      typeof rawMagnitude === "number" ? rawMagnitude * (1 - progress) : 0;
    const phase = now * 0.09 + Number(effect.id.replace("effect-", "")) * 17;

    x += Math.sin(phase) * magnitude;
    y += Math.cos(phase * 1.37) * magnitude;
  }

  return { x, y };
}
