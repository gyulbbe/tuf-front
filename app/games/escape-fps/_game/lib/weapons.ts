export type WeaponId = "flamethrower" | "machinegun" | "rifle";

export type WeaponConfig = {
  autoFire: boolean;
  clipSize: number | null;
  fireRateMs: number;
  hudColor: string;
  id: WeaponId;
  name: string;
  range: number;
  scopeMode: boolean;
  zoomFactor: number;
};

export const WEAPONS: Record<WeaponId, WeaponConfig> = {
  flamethrower: {
    autoFire: true,
    clipSize: null,
    fireRateMs: 50,
    hudColor: "#c0392b",
    id: "flamethrower",
    name: "화염방사기",
    range: 5,
    scopeMode: false,
    zoomFactor: 1,
  },
  machinegun: {
    autoFire: true,
    clipSize: 30,
    fireRateMs: 100,
    hudColor: "#888888",
    id: "machinegun",
    name: "따발총",
    range: 15,
    scopeMode: false,
    zoomFactor: 0.85,
  },
  rifle: {
    autoFire: false,
    clipSize: 5,
    fireRateMs: 600,
    hudColor: "#654321",
    id: "rifle",
    name: "소총",
    range: 30,
    scopeMode: true,
    zoomFactor: 0.4,
  },
};
