import type {
  EnergyBarrier,
  HazardDefinition,
  HazardKind,
  RoadSurface,
  SceneryKind,
  SceneryObject,
  ShortcutDefinition,
  Species,
  Spectator,
  TrackDefinition,
  TrackSection,
  TrackSectionKind,
  Vec2,
  Zone,
} from "./types";

function zone(
  id: string,
  x: number,
  y: number,
  width: number,
  height: number,
  angle = 0,
): Zone {
  return { angle, height, id, width, x, y };
}

function barrier(
  id: string,
  x: number,
  y: number,
  width: number,
  height: number,
  angle: number,
  motion?: EnergyBarrier["motion"],
): EnergyBarrier {
  return { angle, height, id, motion, width, x, y };
}

function hazard(
  kind: HazardKind,
  id: string,
  x: number,
  y: number,
  options: Omit<HazardDefinition, "id" | "kind" | "x" | "y"> = {},
): HazardDefinition {
  return { id, kind, x, y, ...options };
}

function section(
  id: string,
  startCheckpointIndex: number,
  endCheckpointIndex: number,
  kind: TrackSectionKind,
  options: {
    accentColor: string;
    bank?: number;
    boundary?: TrackSection["boundary"];
    cameraPitch?: number;
    ceilingHeight?: number;
    elevation?: number;
    fogDensity?: number;
    grade?: number;
    rail?: TrackSection["rail"];
    surface: RoadSurface;
    visibility?: number;
    wallHeight?: number;
    width: number;
  },
): TrackSection {
  const rail = options.rail ?? "energy";
  const wallHeight = options.wallHeight ?? 0;

  return {
    accentColor: options.accentColor,
    bank: options.bank ?? 0,
    boundary:
      options.boundary ??
      getDefaultBoundary(kind, rail, wallHeight),
    cameraPitch: options.cameraPitch ?? 0,
    ceilingHeight: options.ceilingHeight ?? 0,
    elevation: options.elevation ?? 0,
    endCheckpointIndex,
    fogDensity: options.fogDensity ?? 0.12,
    grade: options.grade ?? 0,
    id,
    kind,
    rail,
    startCheckpointIndex,
    surface: options.surface,
    visibility: options.visibility ?? 3600,
    wallHeight,
    width: options.width,
  };
}

function getDefaultBoundary(
  kind: TrackSectionKind,
  rail: TrackSection["rail"],
  wallHeight: number,
): TrackSection["boundary"] {
  if (
    wallHeight > 0 ||
    kind === "canyon" ||
    kind === "creep" ||
    kind === "hangar" ||
    kind === "reactor" ||
    kind === "tunnel" ||
    kind === "warp"
  ) {
    return "wall";
  }

  return rail === "none" ? "soft" : "rail";
}

function scenery(
  kind: SceneryKind,
  id: string,
  x: number,
  y: number,
  scale: number,
  options: Omit<SceneryObject, "id" | "kind" | "scale" | "x" | "y"> = {},
): SceneryObject {
  return { id, kind, scale, x, y, ...options };
}

function shortcut(
  id: string,
  name: string,
  entryCheckpointIndex: number,
  exitCheckpointIndex: number,
  gate: Zone,
  path: Vec2[],
  options: {
    aiUseChance: number;
    boosters?: Zone[];
    hazards?: HazardDefinition[];
    slowZones?: Zone[];
    width: number;
  },
): ShortcutDefinition {
  return {
    aiUseChance: options.aiUseChance,
    boosters: options.boosters ?? [],
    entryCheckpointIndex,
    exitCheckpointIndex,
    gate,
    hazards: options.hazards ?? [],
    id,
    name,
    path,
    slowZones: options.slowZones ?? [],
    width: options.width,
  };
}

function fan(
  species: Species,
  action: Spectator["action"],
  x: number,
  y: number,
  phase: number,
): Spectator {
  return { action, phase, species, x, y };
}

function crowdArc(
  species: Species,
  action: Spectator["action"],
  centerX: number,
  centerY: number,
  radiusX: number,
  radiusY: number,
  start: number,
  end: number,
  count: number,
  phaseOffset: number,
): Spectator[] {
  return Array.from({ length: count }, (_, index) => {
    const progress = count === 1 ? 0 : index / (count - 1);
    const angle = start + (end - start) * progress;

    return fan(
      species,
      action,
      centerX + Math.cos(angle) * radiusX,
      centerY + Math.sin(angle) * radiusY,
      phaseOffset + index * 0.43,
    );
  });
}

function crowdLine(
  species: Species,
  action: Spectator["action"],
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  count: number,
  phaseOffset: number,
): Spectator[] {
  return Array.from({ length: count }, (_, index) => {
    const progress = count === 1 ? 0 : index / (count - 1);

    return fan(
      species,
      action,
      fromX + (toX - fromX) * progress,
      fromY + (toY - fromY) * progress,
      phaseOffset + index * 0.37,
    );
  });
}

function ellipsePoints(
  centerX: number,
  centerY: number,
  radiusX: number,
  radiusY: number,
  count: number,
  startAngle: number,
): Vec2[] {
  return Array.from({ length: count }, (_, index) => {
    const angle = startAngle + (Math.PI * 2 * index) / count;

    return {
      x: Math.round(centerX + Math.cos(angle) * radiusX),
      y: Math.round(centerY + Math.sin(angle) * radiusY),
    };
  });
}

function startAngle(points: Vec2[]): number {
  return Math.atan2(points[1].y - points[0].y, points[1].x - points[0].x);
}

const stadiumCheckpoints = ellipsePoints(7500, 4700, 6500, 3800, 22, Math.PI);
const nebulaCheckpoints: Vec2[] = [
  { x: 900, y: 7700 },
  { x: 1550, y: 5200 },
  { x: 3150, y: 2500 },
  { x: 5200, y: 1320 },
  { x: 7600, y: 2380 },
  { x: 9400, y: 4880 },
  { x: 12100, y: 2400 },
  { x: 14200, y: 3650 },
  { x: 13400, y: 7200 },
  { x: 10800, y: 8600 },
  { x: 7900, y: 7000 },
  { x: 6000, y: 5000 },
  { x: 3800, y: 7600 },
  { x: 1800, y: 8600 },
];
const canyonCheckpoints: Vec2[] = [
  { x: 1300, y: 8600 },
  { x: 1500, y: 6500 },
  { x: 3000, y: 4300 },
  { x: 5200, y: 2600 },
  { x: 7600, y: 2300 },
  { x: 9300, y: 3600 },
  { x: 11400, y: 2800 },
  { x: 13800, y: 3600 },
  { x: 15000, y: 5600 },
  { x: 14000, y: 7500 },
  { x: 11600, y: 8400 },
  { x: 9700, y: 7600 },
  { x: 8100, y: 6300 },
  { x: 6100, y: 8000 },
  { x: 3700, y: 8900 },
  { x: 1900, y: 8400 },
];

export const TRACKS: TrackDefinition[] = [
  {
    barriers: [
      barrier("stadium-sweeper-a", 4550, 1750, 42, 470, Math.PI / 2, {
        axis: "x",
        max: 5350,
        min: 3700,
        phase: 0.6,
        speed: 0.78,
      }),
      barrier("stadium-sweeper-b", 11850, 7220, 42, 480, Math.PI / 2, {
        axis: "x",
        max: 12750,
        min: 10900,
        phase: 1.8,
        speed: 0.82,
      }),
    ],
    boosters: [
      zone("stadium-outer-boost-north", 7450, 930, 460, 96, 0.02),
      zone("stadium-outer-boost-east", 13980, 4680, 460, 96, Math.PI / 2),
      zone("stadium-outer-boost-south", 7850, 8440, 500, 100, -0.08),
      zone("stadium-outer-boost-west", 1160, 5000, 460, 96, Math.PI / 2),
    ],
    checkpoints: stadiumCheckpoints,
    description:
      "한 바퀴 약 1분을 목표로 만든 거대한 궤도 스타디움. 좁은 부스터 터널 지름길이 핵심입니다.",
    hazards: [
      hazard("laserGate", "stadium-laser-a", 3700, 2280, {
        angle: 0.72,
        cycle: 3.2,
        height: 520,
        openRatio: 0.58,
        phase: 0.2,
        width: 52,
      }),
      hazard("crosswind", "stadium-crosswind-east", 13050, 3200, {
        angle: 1.35,
        height: 780,
        phase: 0.6,
        strength: 150,
        width: 1180,
      }),
      hazard("plasmaMine", "stadium-mine-south-a", 9900, 8150, {
        orbit: { phase: 0.3, radius: 180, speed: 0.62 },
        radius: 76,
      }),
      hazard("plasmaMine", "stadium-mine-south-b", 5200, 8100, {
        orbit: { phase: 2.2, radius: 150, speed: 0.58 },
        radius: 70,
      }),
    ],
    id: 1,
    name: "Track 1: 궤도 스타디움",
    scenery: [
      scenery("terranTower", "stadium-terran-tower-a", 2600, 1180, 1.25, { species: "terran" }),
      scenery("hangarWall", "stadium-hangar-wall-a", 4300, 1280, 1.8, { angle: 0.04, species: "terran" }),
      scenery("hangarWall", "stadium-hangar-wall-b", 6600, 1260, 1.55, { angle: 0.02, species: "terran" }),
      scenery("pylon", "stadium-pylon-a", 9850, 1880, 1.25, { species: "protoss" }),
      scenery("energyRing", "stadium-ring-bridge", 11150, 2680, 1.75, { angle: 0.4, species: "protoss" }),
      scenery("warpCrystal", "stadium-crystal-a", 13400, 4150, 1.35, { species: "protoss" }),
      scenery("creepColumn", "stadium-creep-column-a", 10300, 8350, 1.35, { species: "zerg" }),
      scenery("zergSpire", "stadium-spire-a", 6500, 8750, 1.45, { species: "zerg" }),
      scenery("neonSign", "stadium-shortcut-sign", 2950, 2440, 1.0, { phase: 0.3 }),
      scenery("terranTower", "stadium-finish-tower", 1200, 4550, 1.1, { species: "terran" }),
    ],
    sections: [
      section("stadium-open-start", 0, 2, "open", {
        accentColor: "#38bdf8",
        bank: -0.03,
        boundary: "soft",
        cameraPitch: -0.015,
        ceilingHeight: 0,
        elevation: 0,
        fogDensity: 0.18,
        grade: 0.01,
        rail: "energy",
        surface: "runway",
        visibility: 3100,
        wallHeight: 0,
        width: 420,
      }),
      section("stadium-terran-tunnel", 3, 6, "tunnel", {
        accentColor: "#60a5fa",
        bank: 0.04,
        cameraPitch: 0.045,
        ceilingHeight: 260,
        elevation: -34,
        fogDensity: 0.42,
        grade: 0.08,
        rail: "metal",
        surface: "metal",
        visibility: 1900,
        wallHeight: 230,
        width: 245,
      }),
      section("stadium-protoss-bridge", 7, 11, "warp", {
        accentColor: "#facc15",
        bank: -0.06,
        cameraPitch: -0.035,
        ceilingHeight: 0,
        elevation: 72,
        fogDensity: 0.24,
        grade: -0.04,
        rail: "energy",
        surface: "crystal",
        visibility: 2600,
        wallHeight: 110,
        width: 300,
      }),
      section("stadium-zerg-rim", 12, 16, "creep", {
        accentColor: "#a855f7",
        bank: 0.07,
        cameraPitch: 0.025,
        ceilingHeight: 220,
        elevation: -18,
        fogDensity: 0.5,
        grade: -0.03,
        rail: "organic",
        surface: "creep",
        visibility: 1700,
        wallHeight: 150,
        width: 230,
      }),
      section("stadium-open-return", 17, 21, "open", {
        accentColor: "#22d3ee",
        bank: 0.02,
        boundary: "soft",
        cameraPitch: -0.01,
        ceilingHeight: 0,
        elevation: 18,
        fogDensity: 0.22,
        grade: 0.02,
        rail: "energy",
        surface: "runway",
        visibility: 3000,
        wallHeight: 0,
        width: 390,
      }),
    ],
    shortcuts: [
      shortcut(
        "stadium-tunnel",
        "부스터 터널",
        2,
        9,
        zone("stadium-tunnel-gate", 2900, 2650, 380, 300, -0.32),
        [
          { x: 2900, y: 2650 },
          { x: 4950, y: 1880 },
          { x: 7350, y: 1640 },
          { x: 9850, y: 1960 },
          { x: 12600, y: 3300 },
        ],
        {
          aiUseChance: 0.25,
          boosters: [
            zone("stadium-tunnel-boost-a", 5600, 1780, 360, 80, -0.08),
            zone("stadium-tunnel-boost-b", 9200, 1850, 360, 80, 0.12),
          ],
          hazards: [
            hazard("laserGate", "stadium-tunnel-laser-a", 6500, 1680, {
              angle: Math.PI / 2,
              cycle: 2.8,
              height: 430,
              openRatio: 0.5,
              phase: 0.4,
              shortcutId: "stadium-tunnel",
              width: 48,
            }),
            hazard("laserGate", "stadium-tunnel-laser-b", 10350, 2220, {
              angle: 1.82,
              cycle: 3.1,
              height: 430,
              openRatio: 0.48,
              phase: 1.5,
              shortcutId: "stadium-tunnel",
              width: 48,
            }),
          ],
          width: 152,
        },
      ),
    ],
    slowZones: [
      zone("stadium-slow-west-turn", 1120, 5950, 560, 170, -0.68),
      zone("stadium-slow-east-turn", 13920, 3600, 580, 170, 0.72),
    ],
    spectators: [
      ...crowdArc("terran", "wave", 7500, 4700, 7200, 4400, -2.7, -1.1, 28, 0.2),
      ...crowdArc("zerg", "jump", 7500, 4700, 7200, 4400, -0.45, 0.8, 26, 1.1),
      ...crowdArc("protoss", "flag", 7500, 4700, 7200, 4400, 1.35, 2.68, 26, 2.1),
      ...crowdArc("terran", "flag", 7500, 4700, 5000, 3050, 2.82, 4.15, 18, 1.7),
    ],
    startAngle: startAngle(stadiumCheckpoints),
    startPositions: [
      { x: 860, y: 4810 },
      { x: 810, y: 4880 },
      { x: 760, y: 4950 },
      { x: 710, y: 5020 },
    ],
    theme: "station",
    trackWidth: 310,
    worldHeight: 9400,
    worldWidth: 15000,
  },
  {
    barriers: [
      barrier("nebula-moving-gate-a", 4750, 1720, 46, 520, -0.58, {
        axis: "y",
        max: 2100,
        min: 1300,
        phase: 0.2,
        speed: 0.92,
      }),
      barrier("nebula-moving-gate-b", 12500, 3050, 46, 560, 0.74, {
        axis: "x",
        max: 13200,
        min: 11900,
        phase: 1.6,
        speed: 0.86,
      }),
      barrier("nebula-moving-gate-c", 8150, 7250, 46, 500, 2.2, {
        axis: "y",
        max: 7900,
        min: 6600,
        phase: 2.7,
        speed: 0.88,
      }),
    ],
    boosters: [
      zone("nebula-boost-climb", 2350, 3600, 430, 90, -1.0),
      zone("nebula-boost-crest", 7600, 2380, 460, 92, 0.38),
      zone("nebula-boost-dive", 11600, 2850, 430, 90, -0.65),
      zone("nebula-boost-return", 3300, 8000, 440, 90, 2.72),
    ],
    checkpoints: nebulaCheckpoints,
    description:
      "길게 늘어진 S자 항로. 성운 관통 지름길은 빠르지만 중력장과 지뢰가 라인을 흔듭니다.",
    hazards: [
      hazard("gravityWell", "nebula-gravity-a", 6100, 3150, {
        radius: 780,
        strength: 260,
      }),
      hazard("gravityWell", "nebula-gravity-b", 10450, 6350, {
        radius: 720,
        strength: 240,
      }),
      hazard("crosswind", "nebula-crosswind-a", 13200, 5050, {
        angle: -0.52,
        height: 900,
        phase: 1.3,
        strength: 190,
        width: 1400,
      }),
      hazard("plasmaMine", "nebula-mine-a", 8900, 4750, {
        orbit: { phase: 0.8, radius: 240, speed: 0.72 },
        radius: 82,
      }),
      hazard("plasmaMine", "nebula-mine-b", 11300, 8150, {
        orbit: { phase: 2.4, radius: 260, speed: 0.66 },
        radius: 82,
      }),
    ],
    id: 2,
    name: "Track 2: 네뷸라 S-항로",
    scenery: [
      scenery("asteroid", "nebula-asteroid-a", 2100, 4600, 1.4),
      scenery("warpCrystal", "nebula-crystal-canyon-a", 3900, 1850, 1.45, { species: "protoss" }),
      scenery("pylon", "nebula-pylon-a", 6100, 1180, 1.1, { species: "protoss" }),
      scenery("energyRing", "nebula-ring-a", 8000, 2450, 1.5, { species: "protoss" }),
      scenery("creepColumn", "nebula-creep-tunnel-a", 9700, 5200, 1.35, { species: "zerg" }),
      scenery("zergSpire", "nebula-spire-a", 11100, 6500, 1.55, { species: "zerg" }),
      scenery("terranTower", "nebula-relay-a", 13600, 3500, 1.1, { species: "terran" }),
      scenery("hangarWall", "nebula-highway-wall-a", 3900, 8050, 1.45, { angle: 2.7, species: "terran" }),
      scenery("neonSign", "nebula-shortcut-sign-a", 5200, 1320, 1.0, { phase: 1.1 }),
      scenery("neonSign", "nebula-shortcut-sign-b", 10600, 8180, 1.0, { phase: 2.1 }),
    ],
    sections: [
      section("nebula-open-start", 0, 2, "open", {
        accentColor: "#38bdf8",
        bank: 0.02,
        boundary: "soft",
        cameraPitch: -0.012,
        ceilingHeight: 0,
        elevation: 12,
        fogDensity: 0.5,
        grade: 0.02,
        rail: "none",
        surface: "runway",
        visibility: 2300,
        wallHeight: 0,
        width: 360,
      }),
      section("nebula-crystal-canyon", 3, 5, "canyon", {
        accentColor: "#facc15",
        bank: -0.08,
        cameraPitch: 0.04,
        ceilingHeight: 340,
        elevation: 64,
        fogDensity: 0.42,
        grade: 0.07,
        rail: "energy",
        surface: "crystal",
        visibility: 1600,
        wallHeight: 260,
        width: 190,
      }),
      section("nebula-gravity-field", 6, 8, "bridge", {
        accentColor: "#c084fc",
        bank: 0.1,
        cameraPitch: -0.02,
        ceilingHeight: 180,
        elevation: 26,
        fogDensity: 0.56,
        grade: -0.02,
        rail: "energy",
        surface: "metal",
        visibility: 1800,
        wallHeight: 90,
        width: 250,
      }),
      section("nebula-zerg-tunnel", 9, 11, "creep", {
        accentColor: "#a855f7",
        bank: -0.05,
        cameraPitch: 0.055,
        ceilingHeight: 250,
        elevation: -42,
        fogDensity: 0.62,
        grade: -0.08,
        rail: "organic",
        surface: "creep",
        visibility: 1500,
        wallHeight: 260,
        width: 205,
      }),
      section("nebula-highway-return", 12, 13, "open", {
        accentColor: "#22c55e",
        bank: 0.01,
        cameraPitch: -0.035,
        ceilingHeight: 0,
        elevation: 0,
        fogDensity: 0.32,
        grade: 0.04,
        rail: "energy",
        surface: "runway",
        visibility: 2800,
        wallHeight: 0,
        width: 410,
      }),
    ],
    shortcuts: [
      shortcut(
        "nebula-core-cut",
        "중앙 성운 관통로",
        3,
        6,
        zone("nebula-core-gate", 5250, 1480, 760, 540, -0.2),
        [
          { x: 5250, y: 1480 },
          { x: 6550, y: 1750 },
          { x: 8050, y: 2050 },
          { x: 9800, y: 2350 },
          { x: 12100, y: 2400 },
        ],
        {
          aiUseChance: 0.12,
          boosters: [zone("nebula-core-boost", 8450, 2120, 380, 82, 0.16)],
          hazards: [
            hazard("gravityWell", "nebula-core-gravity", 7450, 1940, {
              radius: 520,
              shortcutId: "nebula-core-cut",
              strength: 280,
            }),
            hazard("plasmaMine", "nebula-core-mine", 9400, 2260, {
              orbit: { phase: 1.4, radius: 180, speed: 0.88 },
              radius: 74,
              shortcutId: "nebula-core-cut",
            }),
          ],
          slowZones: [zone("nebula-core-slow", 6450, 1780, 360, 86, 0.18)],
          width: 150,
        },
      ),
      shortcut(
        "nebula-return-cut",
        "하부 성운 절단로",
        9,
        12,
        zone("nebula-return-gate", 10650, 8420, 760, 540, -2.6),
        [
          { x: 10650, y: 8420 },
          { x: 9200, y: 7600 },
          { x: 7300, y: 6500 },
          { x: 5300, y: 6900 },
          { x: 3800, y: 7600 },
        ],
        {
          aiUseChance: 0.1,
          boosters: [zone("nebula-return-boost", 7600, 6700, 360, 80, -2.55)],
          hazards: [
            hazard("crosswind", "nebula-return-wind", 8100, 7000, {
              angle: -2.4,
              height: 620,
              phase: 1.9,
              shortcutId: "nebula-return-cut",
              strength: 230,
              width: 980,
            }),
            hazard("plasmaMine", "nebula-return-mine", 6050, 6900, {
              orbit: { phase: 0.2, radius: 170, speed: 0.96 },
              radius: 74,
              shortcutId: "nebula-return-cut",
            }),
          ],
          width: 142,
        },
      ),
    ],
    slowZones: [
      zone("nebula-slow-west", 1350, 6200, 520, 150, -1.22),
      zone("nebula-slow-east", 14020, 4950, 520, 150, 1.75),
      zone("nebula-slow-return", 6500, 5900, 540, 150, -2.45),
    ],
    spectators: [
      ...crowdLine("zerg", "wave", 320, 8350, 1800, 9180, 22, 0.4),
      ...crowdLine("protoss", "flag", 2500, 780, 7600, 420, 26, 1.3),
      ...crowdLine("terran", "jump", 9800, 9050, 14200, 7700, 28, 2.2),
      ...crowdLine("zerg", "flag", 230, 5600, 680, 2500, 18, 1.8),
      ...crowdLine("terran", "wave", 14480, 6500, 14850, 2700, 22, 0.8),
      ...crowdLine("protoss", "jump", 4200, 9280, 10400, 9100, 24, 2.7),
    ],
    startAngle: startAngle(nebulaCheckpoints),
    startPositions: [
      { x: 740, y: 7850 },
      { x: 690, y: 7920 },
      { x: 640, y: 7990 },
      { x: 590, y: 8060 },
    ],
    theme: "nebula",
    trackWidth: 270,
    worldHeight: 9400,
    worldWidth: 15000,
  },
  {
    barriers: [
      barrier("canyon-door-a", 2100, 3860, 48, 560, 1.35, {
        axis: "x",
        max: 2750,
        min: 1650,
        phase: 0.3,
        speed: 1.0,
      }),
      barrier("canyon-door-b", 8200, 2650, 48, 620, 0.44, {
        axis: "y",
        max: 3400,
        min: 2050,
        phase: 1.4,
        speed: 0.84,
      }),
      barrier("canyon-door-c", 15100, 5050, 48, 600, Math.PI / 2, {
        axis: "x",
        max: 15950,
        min: 14350,
        phase: 2.1,
        speed: 0.9,
      }),
      barrier("canyon-door-d", 6500, 9100, 48, 620, -0.44, {
        axis: "y",
        max: 9800,
        min: 8500,
        phase: 0.8,
        speed: 0.96,
      }),
    ],
    boosters: [
      zone("canyon-boost-climb", 1400, 6100, 420, 88, -1.25),
      zone("canyon-boost-top", 6060, 1180, 430, 88, -0.1),
      zone("canyon-boost-east", 15900, 5920, 430, 88, 1.65),
      zone("canyon-boost-return", 4700, 9920, 430, 88, 2.92),
    ],
    checkpoints: canyonCheckpoints,
    description:
      "협곡과 정거장 내부 통로가 섞인 장거리 고난도 트랙. 좁은 지름길은 빠르지만 타이밍이 필요합니다.",
    hazards: [
      hazard("rotorArm", "canyon-rotor-main-a", 5000, 1650, {
        height: 720,
        phase: 0.3,
        speed: 0.92,
        width: 54,
      }),
      hazard("laserGate", "canyon-laser-main-a", 9900, 2060, {
        angle: -0.6,
        cycle: 2.7,
        height: 620,
        openRatio: 0.46,
        phase: 0.7,
        width: 50,
      }),
      hazard("gravityWell", "canyon-reactor-pull", 12900, 8350, {
        radius: 760,
        strength: 270,
      }),
      hazard("plasmaMine", "canyon-mine-east-a", 15450, 6900, {
        orbit: { phase: 0.6, radius: 280, speed: 0.82 },
        radius: 86,
      }),
      hazard("crosswind", "canyon-service-wind", 7600, 8300, {
        angle: 2.45,
        height: 760,
        phase: 1.5,
        strength: 220,
        width: 1200,
      }),
    ],
    id: 3,
    name: "Track 3: 정거장 협곡",
    scenery: [
      scenery("hangarWall", "canyon-hangar-wall-a", 2300, 4050, 1.8, { angle: -0.8, species: "terran" }),
      scenery("terranTower", "canyon-tower-a", 5050, 2150, 1.25, { species: "terran" }),
      scenery("reactorCore", "canyon-reactor-a", 9300, 3400, 1.6, { phase: 0.7 }),
      scenery("asteroid", "canyon-asteroid-a", 12200, 1700, 1.45),
      scenery("asteroid", "canyon-asteroid-b", 14800, 3350, 1.2),
      scenery("energyRing", "canyon-final-ring", 15150, 5650, 1.6, { species: "protoss" }),
      scenery("creepColumn", "canyon-creep-column-a", 12800, 8300, 1.4, { species: "zerg" }),
      scenery("zergSpire", "canyon-spire-a", 9800, 8100, 1.3, { species: "zerg" }),
      scenery("pylon", "canyon-pylon-a", 7900, 6400, 1.15, { species: "protoss" }),
      scenery("neonSign", "canyon-service-sign", 8150, 6100, 1.0, { phase: 1.6 }),
    ],
    sections: [
      section("canyon-hangar-start", 0, 3, "hangar", {
        accentColor: "#60a5fa",
        bank: 0.03,
        cameraPitch: 0.05,
        ceilingHeight: 300,
        elevation: -26,
        fogDensity: 0.48,
        grade: 0.06,
        rail: "metal",
        surface: "metal",
        visibility: 1700,
        wallHeight: 300,
        width: 250,
      }),
      section("canyon-service-rotors", 4, 6, "reactor", {
        accentColor: "#fb923c",
        bank: -0.09,
        cameraPitch: -0.005,
        ceilingHeight: 220,
        elevation: 12,
        fogDensity: 0.52,
        grade: 0.01,
        rail: "metal",
        surface: "metal",
        visibility: 1550,
        wallHeight: 190,
        width: 185,
      }),
      section("canyon-asteroid-gap", 7, 9, "canyon", {
        accentColor: "#94a3b8",
        bank: 0.12,
        cameraPitch: -0.04,
        ceilingHeight: 0,
        elevation: 80,
        fogDensity: 0.5,
        grade: -0.05,
        rail: "none",
        surface: "runway",
        visibility: 1450,
        wallHeight: 340,
        width: 175,
      }),
      section("canyon-reactor-descent", 10, 12, "creep", {
        accentColor: "#a855f7",
        bank: -0.07,
        cameraPitch: 0.065,
        ceilingHeight: 260,
        elevation: -62,
        fogDensity: 0.66,
        grade: -0.09,
        rail: "organic",
        surface: "creep",
        visibility: 1350,
        wallHeight: 260,
        width: 165,
      }),
      section("canyon-final-gates", 13, 15, "warp", {
        accentColor: "#facc15",
        bank: 0.05,
        cameraPitch: 0.018,
        ceilingHeight: 210,
        elevation: 34,
        fogDensity: 0.44,
        grade: 0.03,
        rail: "energy",
        surface: "crystal",
        visibility: 1750,
        wallHeight: 130,
        width: 220,
      }),
    ],
    shortcuts: [
      shortcut(
        "canyon-hangar-cut",
        "격납고 관통로",
        2,
        5,
        zone("canyon-hangar-gate", 3100, 4100, 700, 520, -0.78),
        [
          { x: 3100, y: 4100 },
          { x: 4200, y: 3300 },
          { x: 5900, y: 2850 },
          { x: 7600, y: 3000 },
          { x: 9300, y: 3600 },
        ],
        {
          aiUseChance: 0.08,
          boosters: [zone("canyon-hangar-boost", 5750, 2100, 330, 76, 0.14)],
          hazards: [
            hazard("rotorArm", "canyon-hangar-rotor", 4450, 2220, {
              height: 560,
              shortcutId: "canyon-hangar-cut",
              speed: 1.35,
              width: 46,
            }),
            hazard("laserGate", "canyon-hangar-laser", 7050, 2380, {
              angle: 1.78,
              cycle: 2.55,
              height: 460,
              openRatio: 0.43,
              phase: 1.1,
              shortcutId: "canyon-hangar-cut",
              width: 44,
            }),
          ],
          width: 132,
        },
      ),
      shortcut(
        "canyon-reactor-cut",
        "반응로 하강로",
        8,
        11,
        zone("canyon-reactor-gate", 15000, 5600, 700, 520, 1.7),
        [
          { x: 15000, y: 5600 },
          { x: 13800, y: 6100 },
          { x: 12400, y: 6650 },
          { x: 11000, y: 7200 },
          { x: 9700, y: 8200 },
        ],
        {
          aiUseChance: 0.07,
          hazards: [
            hazard("gravityWell", "canyon-reactor-short-gravity", 13600, 6600, {
              radius: 560,
              shortcutId: "canyon-reactor-cut",
              strength: 320,
            }),
            hazard("plasmaMine", "canyon-reactor-short-mine", 12200, 7800, {
              orbit: { phase: 2.3, radius: 180, speed: 1.08 },
              radius: 78,
              shortcutId: "canyon-reactor-cut",
            }),
          ],
          slowZones: [zone("canyon-reactor-slow", 14500, 5880, 350, 86, 2.28)],
          width: 126,
        },
      ),
      shortcut(
        "canyon-service-cut",
        "정비 터널",
        12,
        15,
        zone("canyon-service-gate", 8100, 6300, 700, 520, 2.4),
        [
          { x: 8100, y: 6300 },
          { x: 6600, y: 7000 },
          { x: 5000, y: 7600 },
          { x: 3300, y: 8100 },
          { x: 1900, y: 8400 },
        ],
        {
          aiUseChance: 0.08,
          boosters: [zone("canyon-service-boost", 5050, 8580, 320, 74, 2.84)],
          hazards: [
            hazard("crosswind", "canyon-service-short-wind", 6400, 8120, {
              angle: 2.76,
              height: 560,
              phase: 0.4,
              shortcutId: "canyon-service-cut",
              strength: 260,
              width: 860,
            }),
            hazard("rotorArm", "canyon-service-rotor", 3920, 8840, {
              height: 520,
              phase: 1.6,
              shortcutId: "canyon-service-cut",
              speed: 1.28,
              width: 44,
            }),
          ],
          width: 122,
        },
      ),
    ],
    slowZones: [
      zone("canyon-slow-west", 1300, 5150, 470, 130, -1.2),
      zone("canyon-slow-east", 16050, 7300, 500, 140, 1.78),
      zone("canyon-slow-return", 11100, 9050, 520, 140, -2.74),
    ],
    spectators: [
      ...crowdLine("terran", "flag", 240, 10400, 460, 3600, 30, 0.3),
      ...crowdLine("protoss", "wave", 2800, 580, 7800, 220, 28, 1.5),
      ...crowdLine("zerg", "jump", 17000, 9300, 17280, 3500, 30, 2.1),
      ...crowdLine("terran", "jump", 2400, 10600, 9200, 10520, 34, 0.9),
      ...crowdLine("protoss", "flag", 10600, 520, 15500, 900, 24, 2.7),
      ...crowdLine("zerg", "wave", 5800, 2300, 8400, 2600, 18, 1.1),
    ],
    startAngle: startAngle(canyonCheckpoints),
    startPositions: [
      { x: 1120, y: 8720 },
      { x: 1065, y: 8790 },
      { x: 1010, y: 8860 },
      { x: 955, y: 8930 },
    ],
    theme: "asteroid",
    trackWidth: 230,
    worldHeight: 10800,
    worldWidth: 17500,
  },
];
