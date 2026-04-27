import type { ReactElement } from "react";

type HpBarProps = {
  hp: number;
  maxHp: number;
};

export function HpBar({ hp, maxHp }: HpBarProps): ReactElement {
  const ratio = maxHp > 0 ? Math.max(0, Math.min(1, hp / maxHp)) : 0;
  const barColor =
    ratio < 0.3 ? "bg-red-500" : ratio < 0.6 ? "bg-yellow-400" : "bg-emerald-500";

  return (
    <div className="pointer-events-none w-56 rounded-lg border border-white/15 bg-black/75 px-3 py-2 text-white shadow-lg backdrop-blur">
      <div className="mb-1 flex items-center justify-between text-xs font-semibold uppercase tracking-normal text-white/65">
        <span>HP</span>
        <span className="font-mono">
          {Math.ceil(hp)} / {maxHp}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded bg-white/15">
        <div className={`h-full ${barColor}`} style={{ width: `${ratio * 100}%` }} />
      </div>
    </div>
  );
}
