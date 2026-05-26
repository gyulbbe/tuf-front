import type {
  BossTier,
  BonusKind,
  CrystalCrateDefinition,
  EnemyDefinition,
  EnemyKind,
  Platform,
  PlatformKind,
  Rect,
  RiftPad,
  StageDefinition,
  Vec2,
} from "./types";

const GROUND_Y = 202;

function platform(
  id: string,
  x: number,
  y: number,
  width: number,
  kind: PlatformKind = "stone",
  height = 9,
): Platform {
  return { height, id, kind, width, x, y };
}

function pad(id: string, pairId: string, x: number, y: number): RiftPad {
  return { height: 7, id, pairId, width: 18, x, y };
}

function crate(
  id: string,
  x: number,
  y: number,
  bonus: BonusKind,
): CrystalCrateDefinition {
  return { bonus, height: 13, id, width: 13, x, y };
}

function enemy(
  id: string,
  kind: EnemyKind,
  x: number,
  y: number,
  minX: number,
  maxX: number,
): EnemyDefinition {
  return { id, kind, maxX, minX, x, y };
}

function boss(
  stageId: number,
  order: BossTier,
  name: string,
  x: number,
  y: number,
  minX: number,
  maxX: number,
): EnemyDefinition {
  return {
    bossTier: order,
    id: `s${stageId}-boss-${order}`,
    kind: "boss",
    maxX,
    minX,
    name,
    stageId,
    threat: Math.max(1, Math.round(stageId * 0.75 + (order - 1) * 1.5)),
    x,
    y,
  };
}

function portal(x: number, y: number): Rect {
  return { height: 28, width: 18, x, y };
}

function v(x: number, y: number): Vec2 {
  return { x, y };
}

const baseGround = platform("ground", 0, GROUND_Y, 320, "dark", 22);

export const STAGES: StageDefinition[] = [
  {
    bosses: [
      boss(1, 1, "관문 감시자", 160, 88, 72, 246),
      boss(1, 2, "수정 칼날지기", 92, 143, 34, 146),
      boss(1, 3, "황금 차원기사", 160, 82, 74, 246),
    ],
    crates: [crate("s1-c1", 72, 139, "gem"), crate("s1-c2", 236, 139, "range")],
    enemies: [
      enemy("s1-e1", "patrol", 86, 140, 48, 118),
      enemy("s1-e2", "patrol", 224, 140, 198, 268),
    ],
    id: 1,
    keySpawn: v(158, 88),
    name: "관문 앞초소",
    pads: [pad("s1-p1", "a", 35, 195), pad("s1-p2", "a", 151, 94)],
    platforms: [
      baseGround,
      platform("s1-left", 42, 156, 86, "stone"),
      platform("s1-right", 192, 156, 86, "stone"),
      platform("s1-top", 119, 101, 82, "gold"),
    ],
    portal: portal(288, 174),
    reinforcements: [enemy("s1-r1", "patrol", 52, 188, 24, 104)],
    start: v(28, 184),
  },
  {
    bosses: [
      boss(2, 1, "저장고 파수꾼", 242, 86, 204, 300),
      boss(2, 2, "공명 분쇄자", 160, 122, 112, 232),
      boss(2, 3, "삼중 수정군주", 248, 82, 198, 302),
    ],
    crates: [
      crate("s2-c1", 39, 180, "cooldown"),
      crate("s2-c2", 144, 121, "shield"),
      crate("s2-c3", 250, 84, "gem"),
    ],
    enemies: [
      enemy("s2-e1", "patrol", 76, 183, 34, 132),
      enemy("s2-e2", "charger", 188, 123, 152, 234),
      enemy("s2-e3", "patrol", 258, 86, 226, 300),
    ],
    id: 2,
    keySpawn: v(262, 78),
    name: "수정 저장고",
    pads: [pad("s2-p1", "a", 279, 195), pad("s2-p2", "a", 236, 84)],
    platforms: [
      baseGround,
      platform("s2-low", 28, 176, 86, "stone"),
      platform("s2-mid", 132, 137, 92, "gold"),
      platform("s2-high", 222, 100, 82, "stone"),
    ],
    portal: portal(18, 148),
    reinforcements: [
      enemy("s2-r1", "patrol", 66, 183, 28, 118),
      enemy("s2-r2", "caster", 184, 123, 148, 230),
    ],
    start: v(26, 184),
  },
  {
    bosses: [
      boss(3, 1, "회전문 추적자", 52, 110, 20, 104),
      boss(3, 2, "중력 역행자", 160, 62, 112, 208),
      boss(3, 3, "차원교 수호자", 268, 110, 216, 304),
    ],
    crates: [
      crate("s3-c1", 28, 107, "speed"),
      crate("s3-c2", 280, 107, "range"),
    ],
    enemies: [
      enemy("s3-e1", "charger", 52, 110, 24, 92),
      enemy("s3-e2", "caster", 160, 72, 118, 202),
      enemy("s3-e3", "charger", 268, 110, 226, 300),
    ],
    id: 3,
    keySpawn: v(158, 60),
    name: "회전 차원교",
    pads: [
      pad("s3-p1", "a", 30, 195),
      pad("s3-p2", "a", 151, 131),
      pad("s3-p3", "b", 272, 195),
      pad("s3-p4", "b", 151, 61),
    ],
    platforms: [
      baseGround,
      platform("s3-left", 16, 123, 82, "stone"),
      platform("s3-mid", 119, 147, 82, "gold"),
      platform("s3-right", 222, 123, 82, "stone"),
      platform("s3-top", 116, 77, 88, "stone"),
    ],
    portal: portal(286, 95),
    reinforcements: [
      enemy("s3-r1", "patrol", 42, 110, 18, 94),
      enemy("s3-r2", "patrol", 278, 110, 226, 302),
    ],
    start: v(30, 184),
  },
  {
    bosses: [
      boss(4, 1, "뿔 돌격대장", 72, 151, 28, 142),
      boss(4, 2, "쌍검 사냥꾼", 248, 151, 178, 292),
      boss(4, 3, "광폭 균열장군", 160, 82, 100, 220),
    ],
    crates: [
      crate("s4-c1", 92, 148, "shield"),
      crate("s4-c2", 206, 148, "cooldown"),
    ],
    enemies: [
      enemy("s4-e1", "charger", 74, 152, 34, 136),
      enemy("s4-e2", "charger", 234, 152, 184, 286),
      enemy("s4-e3", "caster", 158, 84, 116, 202),
    ],
    id: 4,
    keySpawn: v(158, 76),
    name: "돌진 괴수 소굴",
    pads: [pad("s4-p1", "a", 151, 195), pad("s4-p2", "a", 151, 87)],
    platforms: [
      baseGround,
      platform("s4-left", 28, 164, 108, "stone"),
      platform("s4-right", 184, 164, 108, "stone"),
      platform("s4-top", 112, 94, 96, "gold"),
      platform("s4-cap", 62, 126, 58, "dark"),
      platform("s4-cap2", 202, 126, 58, "dark"),
    ],
    portal: portal(16, 176),
    reinforcements: [
      enemy("s4-r1", "charger", 64, 152, 30, 136),
      enemy("s4-r2", "charger", 248, 152, 184, 290),
    ],
    start: v(160, 184),
  },
  {
    bosses: [
      boss(5, 1, "광선 사제", 54, 88, 22, 112),
      boss(5, 2, "탄막 예언자", 266, 88, 204, 300),
      boss(5, 3, "사이오닉 폭풍핵", 160, 126, 92, 228),
    ],
    crates: [
      crate("s5-c1", 50, 87, "range"),
      crate("s5-c2", 152, 124, "gem"),
      crate("s5-c3", 256, 87, "speed"),
    ],
    enemies: [
      enemy("s5-e1", "caster", 54, 88, 26, 106),
      enemy("s5-e2", "caster", 266, 88, 216, 296),
      enemy("s5-e3", "charger", 160, 128, 112, 208),
      enemy("s5-e4", "patrol", 160, 184, 96, 224),
    ],
    id: 5,
    keySpawn: v(158, 115),
    name: "사이오닉 포화",
    pads: [
      pad("s5-p1", "a", 36, 195),
      pad("s5-p2", "a", 46, 87),
      pad("s5-p3", "b", 266, 195),
      pad("s5-p4", "b", 254, 87),
    ],
    platforms: [
      baseGround,
      platform("s5-left", 22, 103, 92, "stone"),
      platform("s5-mid", 112, 140, 96, "gold"),
      platform("s5-right", 206, 103, 92, "stone"),
      platform("s5-low", 83, 170, 154, "dark"),
    ],
    portal: portal(150, 174),
    reinforcements: [
      enemy("s5-r1", "caster", 54, 88, 26, 106),
      enemy("s5-r2", "caster", 266, 88, 216, 296),
    ],
    start: v(160, 184),
  },
  {
    bosses: [
      boss(6, 1, "차원 군주", 160, 76, 88, 232),
      boss(6, 2, "균열 포식자", 70, 150, 24, 126),
      boss(6, 3, "공허 판결자", 240, 150, 190, 296),
    ],
    crates: [
      crate("s6-c1", 38, 148, "shield"),
      crate("s6-c2", 268, 148, "cooldown"),
      crate("s6-c3", 154, 76, "range"),
    ],
    enemies: [
      enemy("s6-e1", "patrol", 64, 152, 26, 114),
      enemy("s6-e2", "patrol", 256, 152, 206, 294),
      enemy("s6-e3", "caster", 160, 112, 112, 208),
    ],
    id: 6,
    keySpawn: v(160, 68),
    name: "차원 군주",
    pads: [
      pad("s6-p1", "a", 24, 195),
      pad("s6-p2", "a", 70, 116),
      pad("s6-p3", "b", 278, 195),
      pad("s6-p4", "b", 232, 116),
    ],
    platforms: [
      baseGround,
      platform("s6-left", 24, 164, 94, "stone"),
      platform("s6-right", 202, 164, 94, "stone"),
      platform("s6-mid", 112, 128, 96, "gold"),
      platform("s6-top", 118, 92, 84, "dark"),
    ],
    portal: portal(151, 174),
    reinforcements: [
      enemy("s6-r1", "charger", 60, 152, 24, 118),
      enemy("s6-r2", "caster", 260, 152, 204, 296),
    ],
    start: v(160, 184),
  },
  {
    bosses: [
      boss(7, 1, "거울 포식체", 58, 89, 22, 120),
      boss(7, 2, "위상 복제자", 262, 89, 200, 300),
      boss(7, 3, "만화경 집행자", 160, 134, 96, 224),
    ],
    crates: [
      crate("s7-c1", 58, 89, "shield"),
      crate("s7-c2", 150, 134, "cooldown"),
      crate("s7-c3", 250, 89, "gem"),
    ],
    enemies: [
      enemy("s7-e1", "caster", 58, 90, 24, 114),
      enemy("s7-e2", "charger", 160, 136, 102, 218),
      enemy("s7-e3", "caster", 262, 90, 206, 296),
    ],
    id: 7,
    keySpawn: v(160, 119),
    name: "거울 수정실",
    pads: [
      pad("s7-p1", "a", 38, 195),
      pad("s7-p2", "a", 52, 90),
      pad("s7-p3", "b", 264, 195),
      pad("s7-p4", "b", 250, 90),
    ],
    platforms: [
      baseGround,
      platform("s7-left", 20, 106, 96, "gold"),
      platform("s7-mid", 106, 152, 108, "stone"),
      platform("s7-right", 204, 106, 96, "gold"),
      platform("s7-top", 116, 73, 88, "dark"),
    ],
    portal: portal(151, 45),
    reinforcements: [
      enemy("s7-r1", "caster", 58, 90, 24, 114),
      enemy("s7-r2", "caster", 262, 90, 206, 296),
    ],
    start: v(160, 184),
  },
  {
    bosses: [
      boss(8, 1, "중력 굴착자", 160, 76, 96, 224),
      boss(8, 2, "낙하성 지휘관", 64, 145, 22, 126),
      boss(8, 3, "궤도 파쇄자", 256, 145, 194, 300),
    ],
    crates: [
      crate("s8-c1", 34, 148, "speed"),
      crate("s8-c2", 152, 75, "range"),
      crate("s8-c3", 270, 148, "shield"),
    ],
    enemies: [
      enemy("s8-e1", "charger", 64, 150, 24, 124),
      enemy("s8-e2", "caster", 160, 78, 106, 214),
      enemy("s8-e3", "charger", 256, 150, 196, 296),
    ],
    id: 8,
    keySpawn: v(160, 65),
    name: "궤도 균열로",
    pads: [
      pad("s8-p1", "a", 22, 195),
      pad("s8-p2", "a", 151, 80),
      pad("s8-p3", "b", 280, 195),
      pad("s8-p4", "b", 151, 142),
    ],
    platforms: [
      baseGround,
      platform("s8-top", 110, 91, 100, "gold"),
      platform("s8-left", 22, 164, 106, "stone"),
      platform("s8-mid", 116, 153, 88, "dark"),
      platform("s8-right", 192, 164, 106, "stone"),
    ],
    portal: portal(151, 174),
    reinforcements: [
      enemy("s8-r1", "charger", 64, 150, 24, 124),
      enemy("s8-r2", "charger", 256, 150, 196, 296),
      enemy("s8-r3", "caster", 160, 78, 106, 214),
    ],
    start: v(160, 184),
  },
  {
    bosses: [
      boss(9, 1, "황혼 기사", 82, 128, 28, 144),
      boss(9, 2, "심연 주교", 238, 128, 176, 292),
      boss(9, 3, "심판의 삼위체", 160, 68, 84, 236),
    ],
    crates: [
      crate("s9-c1", 82, 122, "cooldown"),
      crate("s9-c2", 238, 122, "range"),
      crate("s9-c3", 154, 52, "shield"),
    ],
    enemies: [
      enemy("s9-e1", "caster", 84, 130, 28, 142),
      enemy("s9-e2", "caster", 236, 130, 178, 292),
      enemy("s9-e3", "charger", 160, 184, 96, 224),
    ],
    id: 9,
    keySpawn: v(160, 55),
    name: "황혼 성소",
    pads: [
      pad("s9-p1", "a", 42, 195),
      pad("s9-p2", "a", 77, 130),
      pad("s9-p3", "b", 260, 195),
      pad("s9-p4", "b", 225, 130),
      pad("s9-p5", "c", 151, 195),
      pad("s9-p6", "c", 151, 62),
    ],
    platforms: [
      baseGround,
      platform("s9-left", 28, 146, 112, "gold"),
      platform("s9-right", 180, 146, 112, "gold"),
      platform("s9-top", 114, 76, 92, "dark"),
      platform("s9-mid", 111, 111, 98, "stone"),
    ],
    portal: portal(151, 83),
    reinforcements: [
      enemy("s9-r1", "caster", 84, 130, 28, 142),
      enemy("s9-r2", "caster", 236, 130, 178, 292),
      enemy("s9-r3", "charger", 160, 184, 96, 224),
    ],
    start: v(160, 184),
  },
  {
    bosses: [
      boss(10, 1, "왕관의 문지기", 64, 150, 24, 126),
      boss(10, 2, "별빛 파멸자", 256, 150, 194, 296),
      boss(10, 3, "공허의 왕관", 160, 65, 72, 248),
    ],
    crates: [
      crate("s10-c1", 40, 150, "shield"),
      crate("s10-c2", 150, 112, "cooldown"),
      crate("s10-c3", 267, 150, "range"),
      crate("s10-c4", 154, 52, "speed"),
    ],
    enemies: [
      enemy("s10-e1", "charger", 64, 152, 24, 126),
      enemy("s10-e2", "caster", 160, 115, 108, 212),
      enemy("s10-e3", "charger", 256, 152, 194, 296),
      enemy("s10-e4", "caster", 160, 60, 102, 218),
    ],
    id: 10,
    keySpawn: v(160, 48),
    name: "최종 차원문",
    pads: [
      pad("s10-p1", "a", 24, 195),
      pad("s10-p2", "a", 72, 152),
      pad("s10-p3", "b", 278, 195),
      pad("s10-p4", "b", 230, 152),
      pad("s10-p5", "c", 151, 195),
      pad("s10-p6", "c", 151, 62),
    ],
    platforms: [
      baseGround,
      platform("s10-left", 22, 166, 108, "stone"),
      platform("s10-right", 190, 166, 108, "stone"),
      platform("s10-mid", 112, 130, 96, "gold"),
      platform("s10-top", 108, 76, 104, "dark"),
      platform("s10-crown", 130, 110, 60, "gold"),
    ],
    portal: portal(151, 174),
    reinforcements: [
      enemy("s10-r1", "charger", 60, 152, 24, 126),
      enemy("s10-r2", "caster", 160, 115, 108, 212),
      enemy("s10-r3", "charger", 260, 152, 194, 296),
    ],
    start: v(160, 184),
  },
];
