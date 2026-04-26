import { HpBar } from "./hp-bar";
import type { ReactElement } from "react";

export type HudWeaponState = {
  ammoLabel: string;
  color: string;
  isReloading: boolean;
  name: string;
};

type HudProps = {
  floor: number;
  killCount: number;
  maxFloor: number;
  pickupNotice: string | null;
  playerHp: number;
  playerMaxHp: number;
  score: number;
  weapon: HudWeaponState;
};

export function Hud({
  floor,
  killCount,
  maxFloor,
  pickupNotice,
  playerHp,
  playerMaxHp,
  score,
  weapon,
}: HudProps): ReactElement {
  return (
    <>
      <div className="pointer-events-none absolute bottom-4 left-4 grid gap-2">
        <HpBar hp={playerHp} maxHp={playerMaxHp} />
        <div className="rounded-lg border border-white/15 bg-black/75 px-4 py-3 text-white shadow-lg backdrop-blur">
          <div className="flex items-center gap-3">
            <span
              className="h-8 w-8 rounded border border-white/20"
              style={{ backgroundColor: weapon.color }}
            />
            <div>
              <p className="text-base font-semibold">{weapon.name}</p>
              <p className="font-mono text-sm text-white/75">{weapon.ammoLabel}</p>
            </div>
          </div>
          {weapon.isReloading && (
            <p className="mt-2 text-sm font-medium text-white/55">Reloading...</p>
          )}
        </div>
      </div>

      <div className="pointer-events-none absolute right-4 top-4 rounded-lg border border-white/15 bg-black/70 px-3 py-2 font-mono text-sm text-white shadow-lg backdrop-blur">
        <p>Floor: {floor} / {maxFloor}</p>
        <p>Score: {score}</p>
        <p>Kills: {killCount}</p>
      </div>

      {pickupNotice && (
        <div className="pointer-events-none absolute right-4 top-16 rounded-lg border border-white/15 bg-black/75 px-4 py-3 text-sm font-semibold text-white shadow-lg backdrop-blur">
          {pickupNotice}
        </div>
      )}
    </>
  );
}
