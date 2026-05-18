export type EnemyId =
  | "bomber"
  | "broodmother"
  | "burrower"
  | "charger"
  | "grub"
  | "host"
  | "impaler"
  | "leaper"
  | "overlord"
  | "runner"
  | "spawner"
  | "spitter"
  | "swarmling"
  | "tank";

export type AttackKind = "hybrid" | "melee" | "ranged" | "suicide";

export type EnemyConfig = {
  attack: AttackKind;
  attackCooldownMs: number;
  attackRange: number;
  damage: number;
  hp: number;
  id: EnemyId;
  meleeDamage?: number;
  meleeRange?: number;
  onDeathSpawn?: { count: number; type: EnemyId };
  scale: number;
  score: number;
  sightRange: number;
  speed: number;
  spriteImageKey: string;
  stationary?: boolean;
  yOffset: number;
};

export const ENEMIES: Record<EnemyId, EnemyConfig> = {
  bomber: {
    attack: "suicide",
    attackCooldownMs: 0,
    attackRange: 1.2,
    damage: 45,
    hp: 30,
    id: "bomber",
    scale: 1,
    score: 50,
    sightRange: 12,
    speed: 2.9,
    spriteImageKey: "enemy-bomber-0",
    yOffset: 0,
  },
  broodmother: {
    attack: "ranged",
    attackCooldownMs: 1700,
    attackRange: 14,
    damage: 40,
    hp: 1500,
    id: "broodmother",
    onDeathSpawn: { count: 6, type: "swarmling" },
    scale: 2.2,
    score: 1000,
    sightRange: 20,
    speed: 0.8,
    spriteImageKey: "enemy-broodmother-0",
    yOffset: -0.4,
  },
  burrower: {
    attack: "ranged",
    attackCooldownMs: 2000,
    attackRange: 8,
    damage: 18,
    hp: 80,
    id: "burrower",
    scale: 1.1,
    score: 70,
    sightRange: 12,
    speed: 0.5,
    spriteImageKey: "enemy-burrower-0",
    yOffset: 0.2,
  },
  charger: {
    attack: "melee",
    attackCooldownMs: 1200,
    attackRange: 1,
    damage: 28,
    hp: 180,
    id: "charger",
    scale: 1.5,
    score: 180,
    sightRange: 10,
    speed: 2.1,
    spriteImageKey: "enemy-charger-0",
    yOffset: -0.2,
  },
  grub: {
    attack: "melee",
    attackCooldownMs: 1000,
    attackRange: 0.6,
    damage: 4,
    hp: 10,
    id: "grub",
    scale: 0.5,
    score: 10,
    sightRange: 8,
    speed: 1.35,
    spriteImageKey: "enemy-grub-0",
    yOffset: 0.4,
  },
  host: {
    attack: "melee",
    attackCooldownMs: 1000,
    attackRange: 0.9,
    damage: 16,
    hp: 80,
    id: "host",
    onDeathSpawn: { count: 2, type: "grub" },
    scale: 1,
    score: 90,
    sightRange: 12,
    speed: 2,
    spriteImageKey: "enemy-burrower-0",
    yOffset: 0,
  },
  impaler: {
    attack: "ranged",
    attackCooldownMs: 2100,
    attackRange: 12,
    damage: 20,
    hp: 70,
    id: "impaler",
    scale: 1,
    score: 100,
    sightRange: 14,
    speed: 1.5,
    spriteImageKey: "enemy-impaler-0",
    yOffset: 0,
  },
  leaper: {
    attack: "melee",
    attackCooldownMs: 800,
    attackRange: 0.8,
    damage: 14,
    hp: 45,
    id: "leaper",
    scale: 1,
    score: 45,
    sightRange: 14,
    speed: 4.6,
    spriteImageKey: "enemy-leaper-0",
    yOffset: 0,
  },
  overlord: {
    attack: "hybrid",
    attackCooldownMs: 1250,
    attackRange: 16,
    damage: 48,
    hp: 3200,
    id: "overlord",
    meleeDamage: 72,
    meleeRange: 1.25,
    scale: 2.1,
    score: 1800,
    sightRange: 24,
    speed: 1.5,
    spriteImageKey: "enemy-host-0",
    yOffset: -0.35,
  },
  runner: {
    attack: "melee",
    attackCooldownMs: 600,
    attackRange: 0.7,
    damage: 8,
    hp: 25,
    id: "runner",
    scale: 0.9,
    score: 30,
    sightRange: 14,
    speed: 4.2,
    spriteImageKey: "enemy-runner-0",
    yOffset: 0.1,
  },
  spawner: {
    attack: "ranged",
    attackCooldownMs: 2600,
    attackRange: 9,
    damage: 6,
    hp: 120,
    id: "spawner",
    onDeathSpawn: { count: 3, type: "grub" },
    scale: 1.2,
    score: 120,
    sightRange: 14,
    speed: 1,
    spriteImageKey: "enemy-spawner-0",
    yOffset: 0,
  },
  spitter: {
    attack: "ranged",
    attackCooldownMs: 1700,
    attackRange: 10,
    damage: 12,
    hp: 60,
    id: "spitter",
    scale: 1,
    score: 60,
    sightRange: 14,
    speed: 1.8,
    spriteImageKey: "enemy-spitter-0",
    yOffset: 0,
  },
  swarmling: {
    attack: "melee",
    attackCooldownMs: 700,
    attackRange: 0.5,
    damage: 3,
    hp: 8,
    id: "swarmling",
    scale: 0.4,
    score: 15,
    sightRange: 10,
    speed: 4.4,
    spriteImageKey: "enemy-swarmling-0",
    yOffset: 0.4,
  },
  tank: {
    attack: "ranged",
    attackCooldownMs: 2000,
    attackRange: 14,
    damage: 25,
    hp: 250,
    id: "tank",
    scale: 1.4,
    score: 220,
    sightRange: 18,
    speed: 0,
    spriteImageKey: "enemy-tank-0",
    stationary: true,
    yOffset: -0.1,
  },
};

export const ENEMY_IMAGE_KEYS: string[] = Object.values(ENEMIES).map(
  (enemy) => enemy.spriteImageKey,
);
