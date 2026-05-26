import type { Block, BlockType, LevelDefinition, Spike, SpikeMotion } from "./types";

export const LEVEL_COUNT = 100;

const BLOCK_HEIGHT = 28;
const GROUND_Y = 820;
const SPIKE_HEIGHT = 32;
const SHAFT_WIDTH = 156;

type BlockOptions = {
  breakSpeed?: number;
  height?: number;
  motion?: SpikeMotion;
};

type LevelPattern = (id: number, tuning: LevelTuning) => LevelDefinition;

type LevelTuning = {
  danger: number;
  narrow: number;
  speed: number;
  tier: number;
  variant: number;
};

const PATTERNS: LevelPattern[] = [
  createLongArcRun,
  createTallWallChimney,
  createBreakoutChimney,
  createSoftLowTunnel,
  createCrumbleSwitchback,
  createMovingLiftRoom,
  createCeilingNeedleRun,
  createSplitRoute,
  createTwinShaftTransfer,
  createLeftWallEscape,
  createGateBreaker,
  createFallingCatch,
  createSpiralTower,
  createMovingSpikeShaft,
  createCrumbleBridgeToShaft,
  createHighCavern,
  createSoftTrapExit,
  createBreakableUpperDoor,
  createNarrowWindows,
  createEnduranceMixer,
  createReverseRunback,
  createDropWellRecovery,
  createSerpentineShaft,
  createDoubleDoorVault,
  createCrumbleOrbit,
  createMovingGateTiming,
  createSoftCompressionLane,
  createPinballCage,
  createSkyIslandChain,
  createLeftRightFurnace,
  createFoldingBridge,
  createLateGauntletWeave,
];

function block(
  levelId: number,
  key: string,
  x: number,
  y: number,
  width: number,
  type: BlockType = "normal",
  options: BlockOptions = {},
): Block {
  return {
    breakSpeed: options.breakSpeed,
    height: options.height ?? BLOCK_HEIGHT,
    id: `stage-${levelId}-${key}`,
    motion: options.motion,
    type,
    width,
    x,
    y,
  };
}

function wall(
  levelId: number,
  key: string,
  x: number,
  y: number,
  height: number,
  type: BlockType = "wallJump",
  options: Omit<BlockOptions, "height"> = {},
): Block {
  return block(levelId, key, x, y, 34, type, { ...options, height });
}

function spikeUp(
  x: number,
  y: number,
  width = 54,
  motion?: SpikeMotion,
): Spike {
  return { height: SPIKE_HEIGHT, motion, orientation: "up", width, x, y };
}

function spikeDown(
  x: number,
  y: number,
  width = 54,
  motion?: SpikeMotion,
): Spike {
  return { height: SPIKE_HEIGHT, motion, orientation: "down", width, x, y };
}

function motion(
  axis: "x" | "y",
  min: number,
  max: number,
  speed: number,
  phase = 0,
): SpikeMotion {
  return { axis, max, min, phase, speed };
}

function getTuning(id: number): LevelTuning {
  const progress = (id - 1) / (LEVEL_COUNT - 1);

  return {
    danger: Math.min(1, progress * 1.15),
    narrow: progress * 42,
    speed: 1.2 + progress * 2.3,
    tier: Math.floor((id - 1) / 10),
    variant: (id * 47) % 31,
  };
}

function narrow(base: number, tuning: LevelTuning, floor = 76): number {
  return Math.max(floor, base - tuning.narrow - (tuning.variant % 4) * 5);
}

function movingBlock(
  id: number,
  key: string,
  x: number,
  y: number,
  width: number,
  type: BlockType,
  tuning: LevelTuning,
  axis: "x" | "y" = tuning.variant % 2 === 0 ? "x" : "y",
): Block {
  const phase = tuning.variant * 0.17;

  return block(id, key, x, y, width, type, {
    motion:
      axis === "x"
        ? motion("x", x - 48, x + 58, tuning.speed, phase)
        : motion("y", y - 38, y + 34, tuning.speed, phase),
  });
}

function optionalSpike(id: number, spike: Spike, minStage: number): Spike[] {
  return id >= minStage ? [spike] : [];
}

function createIntroLevel(id: number): LevelDefinition | null {
  switch (id) {
    case 1:
      return {
        blocks: [
          block(id, "start", 44, GROUND_Y, 190),
          block(id, "step-a", 310, 770, 160),
          block(id, "boost", 590, 720, 150, "high"),
          block(id, "goal", 1000, 520, 230),
        ],
        id,
        name: "첫 바운스",
        notes: "큰 맵에서 기본 자동 바운스와 좌우 이동을 익힌다.",
        spikes: [spikeUp(500, GROUND_Y - SPIKE_HEIGHT, 56)],
        start: { x: 90, y: GROUND_Y - 22 },
        target: { radius: 25, x: 1160, y: 478 },
      };
    case 2:
      return {
        blocks: [
          block(id, "start", 44, GROUND_Y, 180),
          block(id, "soft", 310, 786, 160, "soft"),
          block(id, "step", 560, 760, 145),
          block(id, "boost", 820, 738, 145, "high"),
          block(id, "goal", 1210, 488, 220),
        ],
        id,
        name: "약한 발판",
        notes: "soft 블록은 점프가 약해서 다음 발판까지 속도를 살려야 한다.",
        spikes: [spikeUp(728, GROUND_Y - SPIKE_HEIGHT, 58)],
        start: { x: 88, y: GROUND_Y - 22 },
        target: { radius: 25, x: 1370, y: 446 },
      };
    case 3:
      return {
        blocks: [
          block(id, "start", 44, GROUND_Y, 175),
          block(id, "crumb-a", 295, 770, 130, "crumble"),
          block(id, "crumb-b", 500, 720, 124, "crumble"),
          block(id, "safe", 750, 660, 170),
          block(id, "goal", 1040, 590, 220),
        ],
        id,
        name: "사라지는 다리",
        notes: "crumble 블록은 밟으면 사라지므로 망설이지 않고 건넌다.",
        spikes: [spikeUp(650, GROUND_Y - SPIKE_HEIGHT, 60)],
        start: { x: 86, y: GROUND_Y - 22 },
        target: { radius: 25, x: 1205, y: 548 },
      };
    case 4:
      return {
        blocks: [
          block(id, "start", 44, GROUND_Y, 170),
          block(id, "step", 300, 760, 150),
          block(id, "boost", 570, 735, 140, "high"),
          block(id, "upper", 930, 510, 175),
          block(id, "goal", 1225, 430, 185),
        ],
        id,
        name: "움직이는 바늘",
        notes: "움직이는 가시의 왕복 타이밍을 보고 지나간다.",
        spikes: [
          spikeUp(718, GROUND_Y - SPIKE_HEIGHT, 58, motion("x", 690, 880, 1.35)),
          spikeDown(1110, 120, 60),
        ],
        start: { x: 88, y: GROUND_Y - 22 },
        target: { radius: 25, x: 1360, y: 388 },
      };
    case 5:
      return {
        blocks: [
          block(id, "start", 44, GROUND_Y, 170),
          block(id, "boost-a", 300, 762, 140, "high"),
          block(id, "ledge-a", 610, 550, 150),
          block(id, "boost-b", 850, 520, 128, "high"),
          block(id, "goal", 1190, 300, 200),
        ],
        id,
        name: "높은 방",
        notes: "하이 점프 블록으로 카메라가 따라오는 높은 구역까지 오른다.",
        spikes: [spikeUp(500, GROUND_Y - SPIKE_HEIGHT, 60), spikeDown(980, 90, 60)],
        start: { x: 88, y: GROUND_Y - 22 },
        target: { radius: 25, x: 1340, y: 258 },
      };
    case 6:
      return {
        blocks: [
          block(id, "start", 44, GROUND_Y, 170),
          block(id, "approach", 285, 770, 140),
          block(id, "boost", 520, 748, 128, "high"),
          wall(id, "first-wall", 760, 390, 350),
          block(id, "ledge", 900, 370, 190),
          block(id, "goal", 1170, 325, 200),
        ],
        id,
        name: "벽 반동",
        notes: "벽 점프 블록에 옆으로 부딪히면 위로 튕겨 오른다.",
        spikes: [spikeUp(660, GROUND_Y - SPIKE_HEIGHT, 56)],
        start: { x: 88, y: GROUND_Y - 22 },
        target: { radius: 25, x: 1320, y: 283 },
      };
    case 7:
      return createIntroWallShaft(id);
    case 8:
      return createIntroBreakGate(id);
    case 9:
      return {
        blocks: [
          block(id, "start", 44, GROUND_Y, 165),
          block(id, "soft-a", 285, 790, 130, "soft"),
          block(id, "boost", 520, 756, 130, "high"),
          wall(id, "left", 760, 350, 430),
          wall(id, "right", 916, 260, 515),
          block(id, "exit", 1025, 250, 150),
          block(id, "goal", 1260, 210, 180),
        ],
        id,
        name: "낮게 눌렀다 오르기",
        notes: "soft 블록으로 낮아진 리듬을 하이 점프와 벽타기로 회복한다.",
        spikes: [spikeUp(435, GROUND_Y - SPIKE_HEIGHT, 58), spikeDown(840, 92, 58)],
        start: { x: 88, y: GROUND_Y - 22 },
        target: { radius: 25, x: 1395, y: 168 },
      };
    case 10:
      return {
        blocks: [
          block(id, "start", 44, GROUND_Y, 160),
          block(id, "crumb-a", 280, 770, 110, "crumble"),
          movingBlock(id, "lift", 520, 700, 120, "normal", getTuning(id), "y"),
          block(id, "boost", 760, 650, 120, "high"),
          wall(id, "wall", 980, 350, 360),
          block(id, "goal", 1165, 285, 200),
        ],
        id,
        name: "무너지는 엘리베이터",
        notes: "사라지는 발판과 움직이는 발판을 이어서 통과한다.",
        spikes: [spikeUp(405, GROUND_Y - SPIKE_HEIGHT, 58), spikeDown(900, 110, 56)],
        start: { x: 88, y: GROUND_Y - 22 },
        target: { radius: 25, x: 1320, y: 243 },
      };
    case 11:
      return {
        blocks: [
          block(id, "start", 44, GROUND_Y, 160),
          block(id, "boost", 290, 760, 130, "high"),
          block(id, "thread-a", 650, 560, 132),
          block(id, "thread-b", 880, 500, 118),
          wall(id, "wall", 1120, 235, 360),
          block(id, "goal", 1285, 190, 180),
        ],
        id,
        name: "천장 실밥",
        notes: "천장 가시 아래를 지나 벽으로 위쪽 출구를 잡는다.",
        spikes: [spikeDown(535, 100, 58), spikeDown(760, 90, 58), spikeUp(1020, GROUND_Y - SPIKE_HEIGHT, 58)],
        start: { x: 88, y: GROUND_Y - 22 },
        target: { radius: 25, x: 1420, y: 148 },
      };
    case 12:
      return createIntroBreakoutShaft(id);
    default:
      return null;
  }
}

function createIntroWallShaft(id: number): LevelDefinition {
  return {
    blocks: [
      block(id, "start", 44, GROUND_Y, 170),
      block(id, "approach", 300, 770, 145),
      block(id, "boost", 550, 752, 130, "high"),
      wall(id, "left", 760, 360, 420),
      wall(id, "right", 760 + SHAFT_WIDTH, 275, 500),
      block(id, "exit", 1010, 250, 170),
      block(id, "goal", 1240, 210, 190),
    ],
    id,
    name: "좌우 벽타기",
    notes: "좌우 벽 사이를 왔다 갔다 하며 위쪽 출구까지 올라간다.",
    spikes: [spikeUp(465, GROUND_Y - SPIKE_HEIGHT, 58), spikeDown(850, 95, 56)],
    start: { x: 88, y: GROUND_Y - 22 },
    target: { radius: 25, x: 1380, y: 168 },
  };
}

function createIntroBreakGate(id: number): LevelDefinition {
  return {
    blocks: [
      block(id, "start", 44, GROUND_Y, 170),
      block(id, "runway", 300, 770, 230),
      block(id, "boost", 585, 752, 130, "high"),
      wall(id, "gate", 815, 490, 245, "breakable", { breakSpeed: 220 }),
      block(id, "after", 910, 650, 160),
      block(id, "goal", 1185, 580, 210),
    ],
    id,
    name: "부수는 문",
    notes: "속도를 모아 옆 벽을 부수고 다음 방으로 빠져나간다.",
    spikes: [spikeUp(1080, GROUND_Y - SPIKE_HEIGHT, 58)],
    start: { x: 88, y: GROUND_Y - 22 },
    target: { radius: 25, x: 1345, y: 538 },
  };
}

function createIntroBreakoutShaft(id: number): LevelDefinition {
  return {
    blocks: [
      block(id, "start", 44, GROUND_Y, 160),
      block(id, "boost", 300, 762, 130, "high"),
      wall(id, "left", 640, 370, 420),
      wall(id, "right", 796, 270, 510),
      wall(id, "break-exit", 960, 160, 210, "breakable", { breakSpeed: 215 }),
      block(id, "escape", 1045, 170, 170),
      block(id, "goal", 1295, 150, 185),
    ],
    id,
    name: "벽타기 탈출",
    notes: "샤프트를 올라간 뒤 breakable 벽을 부수고 빠져나간다.",
    spikes: [spikeUp(500, GROUND_Y - SPIKE_HEIGHT, 58), spikeDown(710, 92, 56)],
    start: { x: 88, y: GROUND_Y - 22 },
    target: { radius: 25, x: 1430, y: 108 },
  };
}

function createLongArcRun(id: number, tuning: LevelTuning): LevelDefinition {
  const shift = (tuning.variant % 5) * 18;
  const top = 470 - tuning.tier * 14;

  return {
    blocks: [
      block(id, "start", 44, GROUND_Y, narrow(170, tuning)),
      block(id, "a", 285 + shift, 770, narrow(136, tuning)),
      block(id, "boost-a", 540, 724, narrow(126, tuning), "high"),
      block(id, "b", 835 - shift * 0.35, top, narrow(138, tuning)),
      block(id, "boost-b", 1090, top - 38, narrow(118, tuning), "high"),
      block(id, "goal", 1335, top - 225, narrow(172, tuning)),
    ],
    id,
    name: `긴 포물선 ${id}`,
    notes: "가로로 긴 맵을 고속 포물선으로 통과한다.",
    spikes: [
      spikeUp(465, GROUND_Y - SPIKE_HEIGHT, 58),
      spikeUp(720, GROUND_Y - SPIKE_HEIGHT, 58),
      ...optionalSpike(id, spikeDown(1015, 96, 56), 28),
    ],
    start: { x: 88, y: GROUND_Y - 22 },
    target: { radius: 25, x: 1465, y: top - 267 },
  };
}

function createTallWallChimney(id: number, tuning: LevelTuning): LevelDefinition {
  const leftX = 605 + (tuning.variant % 3) * 18;
  const rightX = leftX + SHAFT_WIDTH;
  const topY = 190 - tuning.tier * 5;

  return {
    blocks: [
      block(id, "start", 44, GROUND_Y, narrow(165, tuning)),
      block(id, "approach", 300, 770, narrow(136, tuning), "soft"),
      block(id, "boost", 520, 748, narrow(124, tuning), "high"),
      wall(id, "left-wall", leftX, 335, 455),
      wall(id, "right-wall", rightX, 240, 540),
      block(id, "exit-ledge", rightX + 118, topY + 55, narrow(170, tuning)),
      block(id, "goal", 1235, topY + 30, narrow(195, tuning)),
    ],
    id,
    name: `굴뚝 벽타기 ${id}`,
    notes: "두 벽 사이를 번갈아 차고 올라가는 세로 샤프트다.",
    spikes: [
      spikeUp(455, GROUND_Y - SPIKE_HEIGHT, 56),
      spikeDown(leftX + 54, 88, 52),
      ...optionalSpike(id, spikeUp(leftX + 70, GROUND_Y - SPIKE_HEIGHT, 52), 36),
    ],
    start: { x: 88, y: GROUND_Y - 22 },
    target: { radius: 25, x: 1385, y: topY - 12 },
  };
}

function createBreakoutChimney(id: number, tuning: LevelTuning): LevelDefinition {
  const leftX = 570 + (tuning.variant % 4) * 16;
  const rightX = leftX + SHAFT_WIDTH;
  const exitY = 150 + (tuning.variant % 3) * 16;

  return {
    blocks: [
      block(id, "start", 44, GROUND_Y, narrow(160, tuning)),
      block(id, "boost", 295, 760, narrow(125, tuning), "high"),
      wall(id, "left", leftX, 360, 430),
      wall(id, "right", rightX, 260, 515),
      wall(id, "break-exit", rightX + 170, exitY, 205, "breakable", {
        breakSpeed: 205 + tuning.tier * 4,
      }),
      block(id, "escape", rightX + 248, exitY + 12, narrow(170, tuning)),
      block(id, "goal", 1300, exitY - 8, narrow(185, tuning)),
    ],
    id,
    name: `탈출 벽 ${id}`,
    notes: "벽타기로 높이를 만든 뒤 옆문을 부수고 나간다.",
    spikes: [
      spikeUp(445, GROUND_Y - SPIKE_HEIGHT, 56),
      spikeDown(leftX + 74, 94, 54),
      ...optionalSpike(id, spikeUp(rightX + 86, GROUND_Y - SPIKE_HEIGHT, 56), 44),
    ],
    start: { x: 88, y: GROUND_Y - 22 },
    target: { radius: 25, x: 1430, y: exitY - 50 },
  };
}

function createSoftLowTunnel(id: number, tuning: LevelTuning): LevelDefinition {
  const floorY = 792 - (tuning.variant % 3) * 12;

  return {
    blocks: [
      block(id, "start", 44, GROUND_Y, narrow(160, tuning)),
      block(id, "soft-a", 280, floorY, narrow(130, tuning), "soft"),
      block(id, "soft-b", 500, floorY - 18, narrow(126, tuning), "soft"),
      block(id, "boost", 760, floorY - 40, narrow(124, tuning), "high"),
      block(id, "ledge", 1085, 540, narrow(150, tuning)),
      block(id, "goal", 1340, 455, narrow(160, tuning)),
    ],
    id,
    name: `무른 바닥 터널 ${id}`,
    notes: "점프가 약한 바닥을 지나 마지막 하이 점프로 높이를 회복한다.",
    spikes: [
      spikeUp(430, GROUND_Y - SPIKE_HEIGHT, 56),
      spikeUp(665, GROUND_Y - SPIKE_HEIGHT, 56),
      ...optionalSpike(id, spikeDown(980, 110, 58), 30),
    ],
    start: { x: 88, y: GROUND_Y - 22 },
    target: { radius: 25, x: 1460, y: 413 },
  };
}

function createCrumbleSwitchback(id: number, tuning: LevelTuning): LevelDefinition {
  const rise = 34 + (tuning.variant % 4) * 10;

  return {
    blocks: [
      block(id, "start", 44, GROUND_Y, narrow(158, tuning)),
      block(id, "crumb-a", 285, 770, narrow(108, tuning, 72), "crumble"),
      block(id, "safe-a", 470, 720 - rise * 0.2, narrow(120, tuning, 78)),
      block(id, "crumb-b", 670, 650 - rise * 0.5, narrow(100, tuning, 70), "crumble"),
      block(id, "boost", 855, 590 - rise * 0.8, narrow(108, tuning, 70), "high"),
      block(id, "safe-b", 1160, 390 - rise, narrow(142, tuning, 82)),
      block(id, "goal", 1365, 318 - rise, narrow(142, tuning, 82)),
    ],
    id,
    name: `스위치백 다리 ${id}`,
    notes: "한 번 밟으면 사라지는 발판을 지그재그로 빠르게 건넌다.",
    spikes: [
      spikeUp(405, GROUND_Y - SPIKE_HEIGHT, 54),
      spikeUp(775, GROUND_Y - SPIKE_HEIGHT, 54),
      ...optionalSpike(id, spikeDown(1060, 96, 54), 34),
    ],
    start: { x: 88, y: GROUND_Y - 22 },
    target: { radius: 25, x: 1470, y: 276 - rise },
  };
}

function createMovingLiftRoom(id: number, tuning: LevelTuning): LevelDefinition {
  const baseY = 730 - tuning.tier * 10;

  return {
    blocks: [
      block(id, "start", 44, GROUND_Y, narrow(155, tuning)),
      movingBlock(id, "lift-a", 315, baseY, narrow(115, tuning), "normal", tuning, "y"),
      block(id, "boost", 555, baseY - 50, narrow(118, tuning), "high"),
      movingBlock(id, "lift-b", 850, baseY - 215, narrow(108, tuning), "normal", tuning, "x"),
      block(id, "soft", 1085, baseY - 260, narrow(112, tuning), "soft"),
      block(id, "goal", 1320, baseY - 340, narrow(172, tuning)),
    ],
    id,
    name: `왕복 승강장 ${id}`,
    notes: "움직이는 발판의 높이와 위치를 맞춰 큰 방을 가로지른다.",
    spikes: [
      spikeUp(455, GROUND_Y - SPIKE_HEIGHT, 54),
      spikeUp(720, GROUND_Y - SPIKE_HEIGHT, 54, motion("x", 680, 900, tuning.speed, 0.6)),
      ...optionalSpike(id, spikeDown(1130, 92, 54), 42),
    ],
    start: { x: 88, y: GROUND_Y - 22 },
    target: { radius: 25, x: 1455, y: baseY - 382 },
  };
}

function createCeilingNeedleRun(id: number, tuning: LevelTuning): LevelDefinition {
  const laneY = 650 - tuning.tier * 9;

  return {
    blocks: [
      block(id, "start", 44, GROUND_Y, narrow(155, tuning)),
      block(id, "boost", 300, 760, narrow(120, tuning), "high"),
      block(id, "thread-a", 650, laneY, narrow(122, tuning)),
      block(id, "thread-b", 900, laneY - 50, narrow(108, tuning)),
      block(id, "boost-b", 1115, laneY - 88, narrow(104, tuning), "high"),
      block(id, "goal", 1350, laneY - 250, narrow(150, tuning)),
    ],
    id,
    name: `천장 바늘길 ${id}`,
    notes: "낮은 천장 가시 아래에서 바운스 높이를 조절한다.",
    spikes: [
      spikeDown(525, 92, 58),
      spikeDown(735, 102, 58),
      spikeDown(965, 92, 58, motion("x", 910, 1080, tuning.speed * 0.85, 0.8)),
      spikeUp(1230, GROUND_Y - SPIKE_HEIGHT, 56),
    ],
    start: { x: 88, y: GROUND_Y - 22 },
    target: { radius: 25, x: 1465, y: laneY - 292 },
  };
}

function createSplitRoute(id: number, tuning: LevelTuning): LevelDefinition {
  const leftX = 825 + (tuning.variant % 2) * 26;

  return {
    blocks: [
      block(id, "start", 44, GROUND_Y, narrow(160, tuning)),
      block(id, "lower-a", 300, 770, narrow(126, tuning), "crumble"),
      block(id, "lower-b", 535, 760, narrow(114, tuning), "soft"),
      block(id, "upper-boost", 500, 585, narrow(112, tuning), "high"),
      wall(id, "left", leftX, 365, 415),
      wall(id, "right", leftX + SHAFT_WIDTH, 260, 520),
      block(id, "goal", 1250, 235, narrow(210, tuning)),
    ],
    id,
    name: `갈림길 샤프트 ${id}`,
    notes: "아래 길은 복구용, 빠른 길은 위쪽 벽타기 루트다.",
    spikes: [
      spikeUp(430, GROUND_Y - SPIKE_HEIGHT, 56),
      spikeUp(700, GROUND_Y - SPIKE_HEIGHT, 56),
      spikeDown(leftX + 58, 94, 54),
    ],
    start: { x: 88, y: GROUND_Y - 22 },
    target: { radius: 25, x: 1410, y: 193 },
  };
}

function createTwinShaftTransfer(id: number, tuning: LevelTuning): LevelDefinition {
  const firstX = 505 + (tuning.variant % 3) * 14;
  const secondX = 1030 - (tuning.variant % 2) * 22;

  return {
    blocks: [
      block(id, "start", 44, GROUND_Y, narrow(155, tuning)),
      block(id, "boost", 285, 760, narrow(120, tuning), "high"),
      wall(id, "first-left", firstX, 400, 390),
      wall(id, "first-right", firstX + SHAFT_WIDTH, 305, 475),
      block(id, "transfer", 755, 295, narrow(155, tuning)),
      wall(id, "second-left", secondX, 265, 430),
      wall(id, "second-right", secondX + SHAFT_WIDTH, 165, 515),
      block(id, "goal", 1320, 150, narrow(165, tuning)),
    ],
    id,
    name: `쌍둥이 굴뚝 ${id}`,
    notes: "첫 샤프트에서 나온 뒤 두 번째 샤프트로 갈아탄다.",
    spikes: [
      spikeUp(415, GROUND_Y - SPIKE_HEIGHT, 56),
      spikeDown(firstX + 80, 96, 54),
      spikeDown(secondX + 72, 86, 54),
      ...optionalSpike(id, spikeUp(905, GROUND_Y - SPIKE_HEIGHT, 56), 52),
    ],
    start: { x: 88, y: GROUND_Y - 22 },
    target: { radius: 25, x: 1445, y: 108 },
  };
}

function createLeftWallEscape(id: number, tuning: LevelTuning): LevelDefinition {
  const wallX = 170 + (tuning.variant % 3) * 20;
  const topY = 150 + (tuning.variant % 4) * 12;

  return {
    blocks: [
      block(id, "start", 44, GROUND_Y, narrow(155, tuning)),
      block(id, "boost", 300, 760, narrow(125, tuning), "high"),
      wall(id, "left-wall", wallX, 330, 465),
      wall(id, "right-wall", wallX + SHAFT_WIDTH, 245, 540),
      block(id, "reverse-ledge", 565, topY + 95, narrow(145, tuning)),
      block(id, "long-ledge", 835, topY + 58, narrow(155, tuning)),
      block(id, "goal", 1180, topY + 25, narrow(245, tuning)),
    ],
    id,
    name: `왼쪽 탈출구 ${id}`,
    notes: "왼쪽으로 돌아 올라간 뒤 오른쪽으로 길게 빠져나간다.",
    spikes: [
      spikeUp(465, GROUND_Y - SPIKE_HEIGHT, 54),
      spikeDown(wallX + 72, 92, 54),
      ...optionalSpike(id, spikeUp(740, GROUND_Y - SPIKE_HEIGHT, 56), 48),
    ],
    start: { x: 88, y: GROUND_Y - 22 },
    target: { radius: 25, x: 1370, y: topY - 17 },
  };
}

function createGateBreaker(id: number, tuning: LevelTuning): LevelDefinition {
  const gateX = 850 + (tuning.variant % 3) * 24;

  return {
    blocks: [
      block(id, "start", 44, GROUND_Y, narrow(160, tuning)),
      block(id, "runway-a", 295, 770, narrow(210, tuning, 120)),
      block(id, "runway-b", 585, 750, narrow(170, tuning, 105), "high"),
      wall(id, "gate", gateX, 500, 240, "breakable", {
        breakSpeed: 210 + tuning.tier * 4,
      }),
      block(id, "after-soft", gateX + 115, 640, narrow(140, tuning), "soft"),
      block(id, "boost", gateX + 355, 610, narrow(118, tuning), "high"),
      block(id, "goal", 1320, 390, narrow(165, tuning)),
    ],
    id,
    name: `가속 관문 ${id}`,
    notes: "넓은 활주 구간에서 옆 속도를 만들어 벽을 부순다.",
    spikes: [
      spikeUp(gateX + 250, GROUND_Y - SPIKE_HEIGHT, 56),
      ...optionalSpike(id, spikeDown(gateX + 65, 110, 54), 46),
    ],
    start: { x: 88, y: GROUND_Y - 22 },
    target: { radius: 25, x: 1450, y: 348 },
  };
}

function createFallingCatch(id: number, tuning: LevelTuning): LevelDefinition {
  const hookY = 580 - tuning.tier * 10;

  return {
    blocks: [
      block(id, "start", 44, 620, narrow(160, tuning)),
      block(id, "fall-soft", 300, 790, narrow(135, tuning), "soft"),
      block(id, "hook", 560, hookY, narrow(120, tuning), "high"),
      block(id, "recover", 840, hookY - 155, narrow(130, tuning)),
      wall(id, "wall", 1090, hookY - 345, 360),
      block(id, "goal", 1280, hookY - 335, narrow(190, tuning)),
    ],
    id,
    name: `낙하 후 훅 ${id}`,
    notes: "한 번 아래로 떨어진 뒤 하이 점프로 위쪽 루트를 되찾는다.",
    spikes: [
      spikeUp(455, GROUND_Y - SPIKE_HEIGHT, 56),
      spikeUp(720, GROUND_Y - SPIKE_HEIGHT, 56),
      spikeDown(980, 98, 56),
    ],
    start: { x: 88, y: 598 },
    target: { radius: 25, x: 1420, y: hookY - 377 },
  };
}

function createSpiralTower(id: number, tuning: LevelTuning): LevelDefinition {
  const shift = (tuning.variant % 4) * 14;

  return {
    blocks: [
      block(id, "start", 44, GROUND_Y, narrow(155, tuning)),
      block(id, "a", 310, 760, narrow(118, tuning)),
      block(id, "b", 540 + shift, 660, narrow(112, tuning), "high"),
      block(id, "c", 820 - shift, 470, narrow(108, tuning)),
      block(id, "d", 1080 + shift * 0.4, 340, narrow(104, tuning), "high"),
      block(id, "goal", 1300, 130, narrow(175, tuning)),
    ],
    id,
    name: `나선 탑 ${id}`,
    notes: "큰 방을 시계방향으로 감아 오르는 고도전이다.",
    spikes: [
      spikeUp(450, GROUND_Y - SPIKE_HEIGHT, 54),
      spikeDown(705, 92, 54),
      spikeUp(960, GROUND_Y - SPIKE_HEIGHT, 54),
      ...optionalSpike(id, spikeDown(1190, 86, 54), 58),
    ],
    start: { x: 88, y: GROUND_Y - 22 },
    target: { radius: 25, x: 1435, y: 88 },
  };
}

function createMovingSpikeShaft(id: number, tuning: LevelTuning): LevelDefinition {
  const leftX = 620 + (tuning.variant % 2) * 34;
  const rightX = leftX + SHAFT_WIDTH;

  return {
    blocks: [
      block(id, "start", 44, GROUND_Y, narrow(155, tuning)),
      block(id, "boost", 300, 760, narrow(120, tuning), "high"),
      wall(id, "left", leftX, 355, 430),
      wall(id, "right", rightX, 235, 540),
      block(id, "exit", rightX + 115, 205, narrow(160, tuning)),
      block(id, "goal", 1260, 165, narrow(205, tuning)),
    ],
    id,
    name: `왕복 가시 굴뚝 ${id}`,
    notes: "벽 사이를 오르면서 움직이는 가시가 가운데를 지나간다.",
    spikes: [
      spikeUp(455, GROUND_Y - SPIKE_HEIGHT, 56),
      spikeUp(leftX + 58, 560, 54, motion("y", 465, 665, tuning.speed * 0.82, 0.3)),
      spikeDown(rightX - 28, 110, 54, motion("y", 90, 250, tuning.speed * 0.75, 1.1)),
      ...optionalSpike(id, spikeUp(rightX + 95, GROUND_Y - SPIKE_HEIGHT, 54), 62),
    ],
    start: { x: 88, y: GROUND_Y - 22 },
    target: { radius: 25, x: 1415, y: 123 },
  };
}

function createCrumbleBridgeToShaft(id: number, tuning: LevelTuning): LevelDefinition {
  const leftX = 900 + (tuning.variant % 3) * 16;

  return {
    blocks: [
      block(id, "start", 44, GROUND_Y, narrow(150, tuning)),
      block(id, "crumb-a", 285, 770, narrow(98, tuning, 68), "crumble"),
      block(id, "crumb-b", 455, 725, narrow(94, tuning, 66), "crumble"),
      block(id, "boost", 650, 690, narrow(110, tuning), "high"),
      wall(id, "left", leftX, 360, 420),
      wall(id, "right", leftX + SHAFT_WIDTH, 260, 510),
      block(id, "goal", 1245, 230, narrow(220, tuning)),
    ],
    id,
    name: `부서지는 길과 벽 ${id}`,
    notes: "무너지는 다리를 통과한 뒤 곧바로 벽타기로 전환한다.",
    spikes: [
      spikeUp(560, GROUND_Y - SPIKE_HEIGHT, 54),
      spikeDown(leftX + 72, 96, 54),
      ...optionalSpike(id, spikeUp(805, GROUND_Y - SPIKE_HEIGHT, 54), 52),
    ],
    start: { x: 88, y: GROUND_Y - 22 },
    target: { radius: 25, x: 1410, y: 188 },
  };
}

function createHighCavern(id: number, tuning: LevelTuning): LevelDefinition {
  const ceiling = 118 + (tuning.variant % 3) * 18;

  return {
    blocks: [
      block(id, "start", 44, GROUND_Y, narrow(155, tuning)),
      block(id, "boost-a", 310, 760, narrow(120, tuning), "high"),
      block(id, "catch-a", 715, 425, narrow(126, tuning)),
      block(id, "boost-b", 960, 395, narrow(110, tuning), "high"),
      block(id, "catch-b", 1235, ceiling + 130, narrow(120, tuning)),
      block(id, "goal", 1405, ceiling + 72, narrow(118, tuning)),
    ],
    id,
    name: `고천장 동굴 ${id}`,
    notes: "하이 점프의 큰 체공 시간을 이용해 멀리 있는 발판에 착지한다.",
    spikes: [
      spikeDown(570, 94, 56),
      spikeUp(860, GROUND_Y - SPIKE_HEIGHT, 56),
      spikeDown(1120, 88, 56),
    ],
    start: { x: 88, y: GROUND_Y - 22 },
    target: { radius: 25, x: 1472, y: ceiling + 30 },
  };
}

function createSoftTrapExit(id: number, tuning: LevelTuning): LevelDefinition {
  const leftX = 710 + (tuning.variant % 4) * 14;

  return {
    blocks: [
      block(id, "start", 44, GROUND_Y, narrow(155, tuning)),
      block(id, "soft-a", 295, 790, narrow(118, tuning), "soft"),
      block(id, "soft-b", 485, 792, narrow(110, tuning), "soft"),
      block(id, "boost", 610, 760, narrow(104, tuning), "high"),
      wall(id, "left", leftX, 355, 430),
      wall(id, "right", leftX + SHAFT_WIDTH, 250, 525),
      block(id, "goal", 1165, 215, narrow(240, tuning)),
    ],
    id,
    name: `늪 이후 탈출 ${id}`,
    notes: "낮은 점프 구간을 지나 벽타기로 한 번에 고도를 올린다.",
    spikes: [
      spikeUp(430, GROUND_Y - SPIKE_HEIGHT, 54),
      spikeDown(leftX + 70, 92, 54),
      ...optionalSpike(id, spikeUp(leftX + 260, GROUND_Y - SPIKE_HEIGHT, 54), 56),
    ],
    start: { x: 88, y: GROUND_Y - 22 },
    target: { radius: 25, x: 1365, y: 173 },
  };
}

function createBreakableUpperDoor(id: number, tuning: LevelTuning): LevelDefinition {
  const leftX = 565 + (tuning.variant % 2) * 28;
  const rightX = leftX + SHAFT_WIDTH;
  const doorY = 128 + (tuning.variant % 4) * 12;

  return {
    blocks: [
      block(id, "start", 44, GROUND_Y, narrow(150, tuning)),
      block(id, "boost", 305, 760, narrow(118, tuning), "high"),
      wall(id, "left", leftX, 350, 440),
      wall(id, "right", rightX, 230, 545),
      wall(id, "door", rightX + 170, doorY, 195, "breakable", {
        breakSpeed: 210 + tuning.tier * 5,
      }),
      block(id, "landing", rightX + 255, doorY + 25, narrow(150, tuning)),
      block(id, "goal", 1275, doorY + 6, narrow(190, tuning)),
    ],
    id,
    name: `상층 문 부수기 ${id}`,
    notes: "샤프트 정상에서 옆 속도를 살려 위쪽 문을 깬다.",
    spikes: [
      spikeUp(445, GROUND_Y - SPIKE_HEIGHT, 54),
      spikeDown(leftX + 72, 88, 54),
      spikeDown(rightX + 78, 86, 54),
    ],
    start: { x: 88, y: GROUND_Y - 22 },
    target: { radius: 25, x: 1420, y: doorY - 36 },
  };
}

function createNarrowWindows(id: number, tuning: LevelTuning): LevelDefinition {
  const upper = 280 - tuning.tier * 5;

  return {
    blocks: [
      block(id, "start", 44, GROUND_Y, narrow(148, tuning, 92)),
      block(id, "a", 300, 760, narrow(100, tuning, 68)),
      block(id, "boost", 525, 728, narrow(92, tuning, 66), "high"),
      block(id, "window-a", 840, 505, narrow(84, tuning, 62)),
      wall(id, "wall", 1040, upper, 410),
      block(id, "window-b", 1160, upper + 52, narrow(84, tuning, 62), "soft"),
      block(id, "goal", 1340, upper - 18, narrow(150, tuning, 76)),
    ],
    id,
    name: `좁은 창문 ${id}`,
    notes: "착지 폭이 좁아져도 벽 반동으로 다음 창을 잡는다.",
    spikes: [
      spikeUp(440, GROUND_Y - SPIKE_HEIGHT, 52),
      spikeDown(735, 92, 52),
      spikeUp(960, GROUND_Y - SPIKE_HEIGHT, 52),
      ...optionalSpike(id, spikeDown(1255, 86, 52), 70),
    ],
    start: { x: 88, y: GROUND_Y - 22 },
    target: { radius: 25, x: 1452, y: upper - 60 },
  };
}

function createEnduranceMixer(id: number, tuning: LevelTuning): LevelDefinition {
  const leftX = 760 + (tuning.variant % 3) * 18;
  const rightX = leftX + SHAFT_WIDTH;
  const topY = 130 + (tuning.variant % 3) * 16;

  return {
    blocks: [
      block(id, "start", 44, GROUND_Y, narrow(145, tuning, 88)),
      block(id, "crumb", 250, 775, narrow(94, tuning, 62), "crumble"),
      block(id, "soft", 420, 760, narrow(96, tuning, 64), "soft"),
      block(id, "boost", 580, 730, narrow(96, tuning, 64), "high"),
      wall(id, "left", leftX, 360, 430),
      wall(id, "right", rightX, 230, 545),
      wall(id, "break", rightX + 175, topY, 205, "breakable", {
        breakSpeed: 215 + tuning.tier * 5,
      }),
      movingBlock(id, "last", rightX + 295, topY + 55, narrow(110, tuning, 66), "high", tuning, "x"),
      block(id, "goal", 1370, topY + 10, narrow(120, tuning, 70)),
    ],
    id,
    name: `복합 탈출 ${id}`,
    notes: "soft, crumble, 벽타기, 부수기, 이동 발판을 한 번에 엮는다.",
    spikes: [
      spikeUp(355, GROUND_Y - SPIKE_HEIGHT, 52),
      spikeUp(655, GROUND_Y - SPIKE_HEIGHT, 52),
      spikeDown(leftX + 72, 90, 52, motion("y", 82, 210, tuning.speed * 0.8, 0.7)),
      spikeUp(rightX + 88, GROUND_Y - SPIKE_HEIGHT, 52, motion("x", rightX + 40, rightX + 220, tuning.speed, 1.2)),
    ],
    start: { x: 88, y: GROUND_Y - 22 },
    target: { radius: 26, x: 1465, y: topY - 32 },
  };
}

function createReverseRunback(id: number, tuning: LevelTuning): LevelDefinition {
  const shaftX = 760 - (tuning.variant % 3) * 18;
  const topY = 150 + (tuning.variant % 3) * 18;

  return {
    blocks: [
      block(id, "start-right", 1360, GROUND_Y, narrow(180, tuning, 108)),
      block(id, "reverse-step", 1120, 782, narrow(126, tuning, 78), "soft"),
      block(id, "reverse-boost", 940, 740, narrow(112, tuning, 72), "high"),
      wall(id, "shaft-left", shaftX, 350, 430),
      wall(id, "shaft-right", shaftX + SHAFT_WIDTH, 255, 520),
      block(id, "turn-ledge", shaftX - 205, topY + 92, narrow(148, tuning, 78)),
      wall(id, "left-door", shaftX - 270, topY + 10, 205, "breakable", {
        breakSpeed: 195 + tuning.tier * 4,
      }),
      block(id, "exit-left", 285, topY + 30, narrow(160, tuning, 82)),
      block(id, "goal", 92, topY, narrow(152, tuning, 82)),
    ],
    id,
    name: `역주행 탈출 ${id}`,
    notes: "오른쪽에서 시작해 왼쪽으로 되돌아가며 샤프트와 문 파괴를 이어간다.",
    spikes: [
      spikeUp(1260, GROUND_Y - SPIKE_HEIGHT, 54),
      spikeUp(1050, GROUND_Y - SPIKE_HEIGHT, 54),
      spikeDown(shaftX + 70, 90, 52),
      ...optionalSpike(id, spikeUp(shaftX - 80, GROUND_Y - SPIKE_HEIGHT, 52), 54),
    ],
    start: { x: 1490, y: GROUND_Y - 22 },
    target: { radius: 25, x: 160, y: topY - 42 },
  };
}

function createDropWellRecovery(id: number, tuning: LevelTuning): LevelDefinition {
  const hookY = 585 - tuning.tier * 8;

  return {
    blocks: [
      block(id, "start-high", 44, 286, narrow(170, tuning, 96)),
      block(id, "fall-cushion", 280, 795, narrow(145, tuning, 82), "soft"),
      block(id, "rebound", 520, 752, narrow(124, tuning, 76), "high"),
      movingBlock(id, "catch", 760, hookY, narrow(116, tuning, 72), "normal", tuning, "y"),
      block(id, "side-boost", 980, hookY - 120, narrow(104, tuning, 68), "high"),
      wall(id, "climb", 1190, hookY - 350, 360),
      block(id, "goal", 1340, hookY - 342, narrow(168, tuning, 82)),
    ],
    id,
    name: `낙하 우물 ${id}`,
    notes: "높은 시작점에서 일부러 떨어진 뒤 낮은 쿠션과 하이 점프로 루트를 복구한다.",
    spikes: [
      spikeUp(445, GROUND_Y - SPIKE_HEIGHT, 54),
      spikeUp(660, GROUND_Y - SPIKE_HEIGHT, 54),
      spikeDown(870, 96, 52),
      ...optionalSpike(id, spikeUp(1110, GROUND_Y - SPIKE_HEIGHT, 52), 48),
    ],
    start: { x: 92, y: 264 },
    target: { radius: 25, x: 1460, y: hookY - 384 },
  };
}

function createSerpentineShaft(id: number, tuning: LevelTuning): LevelDefinition {
  const baseX = 590 + (tuning.variant % 4) * 12;

  return {
    blocks: [
      block(id, "start", 44, GROUND_Y, narrow(150, tuning, 92)),
      block(id, "boost", 300, 760, narrow(112, tuning, 72), "high"),
      wall(id, "left-low", baseX, 610, 170),
      wall(id, "right-low", baseX + 190, 520, 180),
      wall(id, "left-mid", baseX + 24, 410, 170),
      wall(id, "right-mid", baseX + 214, 310, 185),
      wall(id, "left-top", baseX + 46, 220, 170),
      block(id, "exit", baseX + 300, 198, narrow(150, tuning, 78)),
      block(id, "goal", 1250, 168, narrow(210, tuning, 92)),
    ],
    id,
    name: `뱀굴 샤프트 ${id}`,
    notes: "짧은 벽 조각을 좌우로 갈아타며 S자처럼 위로 올라간다.",
    spikes: [
      spikeUp(455, GROUND_Y - SPIKE_HEIGHT, 52),
      spikeDown(baseX + 116, 92, 50),
      spikeUp(baseX + 100, 760, 50, motion("y", 610, 770, tuning.speed * 0.8, 0.4)),
      ...optionalSpike(id, spikeDown(baseX + 305, 94, 50), 58),
    ],
    start: { x: 88, y: GROUND_Y - 22 },
    target: { radius: 25, x: 1410, y: 126 },
  };
}

function createDoubleDoorVault(id: number, tuning: LevelTuning): LevelDefinition {
  const firstDoorX = 575 + (tuning.variant % 3) * 18;
  const secondDoorX = 1065 - (tuning.variant % 2) * 20;

  return {
    blocks: [
      block(id, "start", 44, GROUND_Y, narrow(160, tuning, 96)),
      block(id, "runway", 300, 780, narrow(230, tuning, 128)),
      wall(id, "first-door", firstDoorX, 580, 190, "breakable", {
        breakSpeed: 190 + tuning.tier * 4,
      }),
      block(id, "after-door", firstDoorX + 88, 705, narrow(142, tuning, 80), "soft"),
      block(id, "vault", firstDoorX + 300, 660, narrow(112, tuning, 70), "high"),
      wall(id, "second-door", secondDoorX, 365, 245, "breakable", {
        breakSpeed: 210 + tuning.tier * 5,
      }),
      block(id, "upper-run", secondDoorX + 92, 410, narrow(142, tuning, 78)),
      block(id, "goal", 1320, 335, narrow(168, tuning, 82)),
    ],
    id,
    name: `이중 관문 ${id}`,
    notes: "낮은 문을 부수고 착지한 뒤, 더 높은 문을 한 번 더 뚫는다.",
    spikes: [
      spikeUp(firstDoorX + 212, GROUND_Y - SPIKE_HEIGHT, 52),
      spikeUp(secondDoorX - 90, GROUND_Y - SPIKE_HEIGHT, 52),
      ...optionalSpike(id, spikeDown(secondDoorX + 75, 96, 52), 50),
    ],
    start: { x: 88, y: GROUND_Y - 22 },
    target: { radius: 25, x: 1450, y: 293 },
  };
}

function createCrumbleOrbit(id: number, tuning: LevelTuning): LevelDefinition {
  const centerX = 820 + (tuning.variant % 3) * 18;
  const centerY = 455 - tuning.tier * 4;

  return {
    blocks: [
      block(id, "start", 44, GROUND_Y, narrow(150, tuning, 92)),
      block(id, "entry", 300, 760, narrow(108, tuning, 70), "high"),
      block(id, "orbit-a", centerX - 285, centerY + 210, narrow(94, tuning, 64), "crumble"),
      block(id, "orbit-b", centerX - 160, centerY + 72, narrow(92, tuning, 62)),
      block(id, "orbit-c", centerX + 20, centerY - 20, narrow(88, tuning, 60), "crumble"),
      block(id, "orbit-d", centerX + 215, centerY + 40, narrow(92, tuning, 62), "high"),
      block(id, "orbit-e", centerX + 320, centerY - 145, narrow(96, tuning, 64), "crumble"),
      block(id, "goal", centerX + 480, centerY - 200, narrow(148, tuning, 78)),
    ],
    id,
    name: `분해 궤도 ${id}`,
    notes: "중앙 위험 지대를 크게 감아 돌며 사라지는 발판을 순서대로 밟는다.",
    spikes: [
      spikeUp(centerX - 45, centerY + 300, 58),
      spikeDown(centerX - 20, centerY - 310, 58),
      spikeUp(centerX + 160, GROUND_Y - SPIKE_HEIGHT, 54),
      ...optionalSpike(id, spikeDown(centerX + 345, 92, 54), 56),
    ],
    start: { x: 88, y: GROUND_Y - 22 },
    target: { radius: 25, x: centerX + 590, y: centerY - 242 },
  };
}

function createMovingGateTiming(id: number, tuning: LevelTuning): LevelDefinition {
  const gateX = 760 + (tuning.variant % 4) * 16;

  return {
    blocks: [
      block(id, "start", 44, GROUND_Y, narrow(156, tuning, 92)),
      block(id, "boost", 300, 760, narrow(112, tuning, 72), "high"),
      block(id, "gate-a", gateX, 520, 34, "normal", {
        height: 250,
        motion: motion("y", 450, 620, tuning.speed * 0.85, 0.2),
      }),
      block(id, "gate-b", gateX + 172, 220, 34, "wallJump", {
        height: 330,
        motion: motion("y", 190, 330, tuning.speed * 0.75, 1.1),
      }),
      block(id, "safe-pocket", gateX + 270, 610, narrow(122, tuning, 72), "soft"),
      block(id, "escape-boost", gateX + 470, 550, narrow(110, tuning, 68), "high"),
      block(id, "goal", 1330, 325, narrow(170, tuning, 82)),
    ],
    id,
    name: `움직이는 문틈 ${id}`,
    notes: "세로로 움직이는 벽 사이의 빈 타이밍을 보고 통과한다.",
    spikes: [
      spikeUp(500, GROUND_Y - SPIKE_HEIGHT, 52),
      spikeUp(gateX + 100, GROUND_Y - SPIKE_HEIGHT, 52),
      spikeDown(gateX + 360, 94, 52, motion("x", gateX + 310, gateX + 460, tuning.speed, 0.8)),
    ],
    start: { x: 88, y: GROUND_Y - 22 },
    target: { radius: 25, x: 1455, y: 283 },
  };
}

function createSoftCompressionLane(id: number, tuning: LevelTuning): LevelDefinition {
  const laneY = 782 - (tuning.variant % 4) * 8;

  return {
    blocks: [
      block(id, "start", 44, GROUND_Y, narrow(150, tuning, 92)),
      block(id, "soft-a", 270, laneY, narrow(116, tuning, 74), "soft"),
      block(id, "soft-b", 455, laneY - 10, narrow(112, tuning, 72), "soft"),
      block(id, "soft-c", 640, laneY - 20, narrow(108, tuning, 70), "soft"),
      block(id, "release", 850, laneY - 52, narrow(106, tuning, 68), "high"),
      wall(id, "release-wall", 1060, 390, 350),
      block(id, "goal", 1235, 330, narrow(230, tuning, 92)),
    ],
    id,
    name: `압축 저공로 ${id}`,
    notes: "soft 블록으로 낮게 눌린 리듬을 유지하다가 마지막에 한 번에 터뜨린다.",
    spikes: [
      spikeDown(365, 118, 52),
      spikeDown(550, 118, 52),
      spikeDown(735, 118, 52),
      spikeUp(980, GROUND_Y - SPIKE_HEIGHT, 52),
    ],
    start: { x: 88, y: GROUND_Y - 22 },
    target: { radius: 25, x: 1410, y: 288 },
  };
}

function createPinballCage(id: number, tuning: LevelTuning): LevelDefinition {
  const cageLeft = 555 + (tuning.variant % 3) * 18;
  const cageRight = cageLeft + 430;

  return {
    blocks: [
      block(id, "start", 44, GROUND_Y, narrow(150, tuning, 92)),
      block(id, "launch", 300, 760, narrow(118, tuning, 72), "high"),
      wall(id, "bumper-left", cageLeft, 300, 485),
      wall(id, "bumper-right", cageRight, 260, 525),
      block(id, "center-soft", cageLeft + 152, 655, narrow(118, tuning, 72), "soft"),
      block(id, "center-boost", cageLeft + 232, 480, narrow(102, tuning, 66), "high"),
      wall(id, "top-door", cageRight + 95, 150, 220, "breakable", {
        breakSpeed: 205 + tuning.tier * 4,
      }),
      block(id, "goal", cageRight + 190, 185, narrow(175, tuning, 82)),
    ],
    id,
    name: `핀볼 우리 ${id}`,
    notes: "좌우 벽 범퍼 안에서 튕김 방향을 모아 위쪽 문을 부순다.",
    spikes: [
      spikeUp(cageLeft + 205, GROUND_Y - SPIKE_HEIGHT, 54),
      spikeDown(cageLeft + 190, 92, 54),
      spikeUp(cageRight + 40, GROUND_Y - SPIKE_HEIGHT, 54),
    ],
    start: { x: 88, y: GROUND_Y - 22 },
    target: { radius: 25, x: cageRight + 325, y: 143 },
  };
}

function createSkyIslandChain(id: number, tuning: LevelTuning): LevelDefinition {
  const highY = 170 + (tuning.variant % 4) * 14;

  return {
    blocks: [
      block(id, "start", 44, GROUND_Y, narrow(148, tuning, 92)),
      block(id, "boost-a", 285, 760, narrow(110, tuning, 70), "high"),
      block(id, "island-a", 560, 470, narrow(100, tuning, 64)),
      movingBlock(id, "island-b", 820, 360, narrow(92, tuning, 62), "crumble", tuning, "x"),
      block(id, "island-c", 1050, 255, narrow(96, tuning, 62), "high"),
      block(id, "island-d", 1255, highY, narrow(90, tuning, 60), "soft"),
      block(id, "goal", 1395, highY - 40, narrow(112, tuning, 66)),
    ],
    id,
    name: `하늘 섬 사슬 ${id}`,
    notes: "공중 섬을 길게 이어 가며 사라지는 이동 섬까지 밟는다.",
    spikes: [
      spikeUp(450, GROUND_Y - SPIKE_HEIGHT, 52),
      spikeDown(700, 92, 52),
      spikeUp(930, GROUND_Y - SPIKE_HEIGHT, 52),
      spikeDown(1180, 86, 52),
    ],
    start: { x: 88, y: GROUND_Y - 22 },
    target: { radius: 25, x: 1465, y: highY - 82 },
  };
}

function createLeftRightFurnace(id: number, tuning: LevelTuning): LevelDefinition {
  const leftX = 420 + (tuning.variant % 3) * 18;
  const rightX = 1050 - (tuning.variant % 3) * 12;

  return {
    blocks: [
      block(id, "start", 44, GROUND_Y, narrow(150, tuning, 92)),
      block(id, "boost-left", 275, 760, narrow(108, tuning, 70), "high"),
      wall(id, "left-wall", leftX, 375, 400),
      block(id, "middle-catch", 650, 510, narrow(112, tuning, 70), "soft"),
      wall(id, "right-wall", rightX, 285, 480),
      block(id, "return-catch", 815, 255, narrow(104, tuning, 66), "crumble"),
      wall(id, "left-upper", leftX + 85, 175, 280),
      block(id, "goal", 1180, 125, narrow(230, tuning, 92)),
    ],
    id,
    name: `좌우 용광로 ${id}`,
    notes: "왼쪽 벽, 오른쪽 벽, 다시 왼쪽 벽으로 크게 왕복하며 위로 빠진다.",
    spikes: [
      spikeUp(520, GROUND_Y - SPIKE_HEIGHT, 52),
      spikeUp(900, GROUND_Y - SPIKE_HEIGHT, 52),
      spikeDown(705, 92, 52, motion("x", 610, 830, tuning.speed * 0.85, 0.6)),
      spikeDown(1040, 86, 52),
    ],
    start: { x: 88, y: GROUND_Y - 22 },
    target: { radius: 25, x: 1360, y: 83 },
  };
}

function createFoldingBridge(id: number, tuning: LevelTuning): LevelDefinition {
  const bridgeY = 720 - tuning.tier * 6;

  return {
    blocks: [
      block(id, "start", 44, GROUND_Y, narrow(148, tuning, 92)),
      movingBlock(id, "fold-a", 305, bridgeY, narrow(100, tuning, 64), "normal", tuning, "y"),
      movingBlock(id, "fold-b", 505, bridgeY - 88, narrow(96, tuning, 62), "soft", {
        ...tuning,
        variant: tuning.variant + 7,
      }, "y"),
      movingBlock(id, "fold-c", 720, bridgeY - 176, narrow(92, tuning, 60), "crumble", {
        ...tuning,
        variant: tuning.variant + 14,
      }, "y"),
      block(id, "boost", 950, bridgeY - 232, narrow(96, tuning, 62), "high"),
      wall(id, "last-wall", 1160, bridgeY - 500, 345),
      block(id, "goal", 1330, bridgeY - 512, narrow(160, tuning, 78)),
    ],
    id,
    name: `접히는 다리 ${id}`,
    notes: "세 개의 위아래 발판이 서로 다른 박자로 접히는 듯 움직인다.",
    spikes: [
      spikeUp(430, GROUND_Y - SPIKE_HEIGHT, 52),
      spikeUp(645, GROUND_Y - SPIKE_HEIGHT, 52),
      spikeUp(860, GROUND_Y - SPIKE_HEIGHT, 52),
      ...optionalSpike(id, spikeDown(1085, 92, 52), 64),
    ],
    start: { x: 88, y: GROUND_Y - 22 },
    target: { radius: 25, x: 1450, y: bridgeY - 554 },
  };
}

function createLateGauntletWeave(id: number, tuning: LevelTuning): LevelDefinition {
  const shaftX = 690 + (tuning.variant % 3) * 18;
  const topY = 120 + (tuning.variant % 4) * 12;

  return {
    blocks: [
      block(id, "start", 44, GROUND_Y, narrow(140, tuning, 86)),
      block(id, "crumb-a", 250, 775, narrow(88, tuning, 58), "crumble"),
      block(id, "soft-a", 410, 760, narrow(88, tuning, 58), "soft"),
      block(id, "boost", 565, 720, narrow(88, tuning, 58), "high"),
      wall(id, "left", shaftX, 355, 430),
      wall(id, "right", shaftX + SHAFT_WIDTH, 230, 545),
      wall(id, "break-low", shaftX + 290, 440, 205, "breakable", {
        breakSpeed: 205 + tuning.tier * 4,
      }),
      movingBlock(id, "moving-catch", shaftX + 390, 380, narrow(94, tuning, 58), "soft", tuning, "x"),
      wall(id, "break-high", shaftX + 590, topY, 210, "breakable", {
        breakSpeed: 215 + tuning.tier * 5,
      }),
      block(id, "goal", 1365, topY + 35, narrow(120, tuning, 66)),
    ],
    id,
    name: `후반 직조로 ${id}`,
    notes: "사라짐, 약한 점프, 벽타기, 두 개의 문, 이동 발판을 엮은 후반용 패턴이다.",
    spikes: [
      spikeUp(340, GROUND_Y - SPIKE_HEIGHT, 50),
      spikeUp(645, GROUND_Y - SPIKE_HEIGHT, 50),
      spikeDown(shaftX + 70, 88, 50, motion("y", 80, 220, tuning.speed * 0.82, 0.5)),
      spikeUp(shaftX + 255, GROUND_Y - SPIKE_HEIGHT, 50, motion("x", shaftX + 210, shaftX + 360, tuning.speed, 1.1)),
      spikeDown(shaftX + 505, 84, 50),
    ],
    start: { x: 88, y: GROUND_Y - 22 },
    target: { radius: 26, x: 1460, y: topY - 8 },
  };
}

function createLevel(id: number): LevelDefinition {
  const introLevel = createIntroLevel(id);

  if (introLevel) {
    return introLevel;
  }

  const tuning = getTuning(id);
  if (id === LEVEL_COUNT) {
    return createEnduranceMixer(id, { ...tuning, variant: tuning.variant + 9 });
  }

  const patternIndex = (id * 7 + tuning.tier * 11 + tuning.variant) % PATTERNS.length;

  return PATTERNS[patternIndex](id, tuning);
}

export const LEVELS: LevelDefinition[] = Array.from(
  { length: LEVEL_COUNT },
  (_, index) => createLevel(index + 1),
);
