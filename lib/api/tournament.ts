import axios from "axios";
import { apiClient } from "@/lib/api/client";
import type { TournamentCreateRequest } from "@/lib/tournament/create-types";
import type {
  Tournament,
  TournamentBracketType,
  TournamentConnectorSegment,
  TournamentGroup,
  TournamentGroupCode,
  TournamentMatch,
  TournamentMatchKey,
  TournamentMatchRole,
  TournamentMatchSlot,
  TournamentMatchStatus,
  TournamentParticipant,
  TournamentParticipantConnector,
  TournamentPage,
  TournamentResultSlot,
  TournamentResultType,
  TournamentSummary,
  TournamentSlotOutcome,
  TournamentStatus,
} from "@/lib/tournament/types";

export type ListTournamentsParams = {
  page?: number;
  size?: number;
  keyword?: string;
};

export type {
  TournamentBestOf,
  TournamentBracketType,
  TournamentCreateGroupRequest,
  TournamentCreateRequest,
  TournamentCreateSlotRequest,
} from "@/lib/tournament/create-types";

type ApiEnvelope<T> = {
  status?: number;
  message?: string;
  data?: T | null;
};

type ErrorResponseBody = {
  message?: string;
  error?: string;
};

type RawObject = Record<string, unknown>;

export type TournamentScoreSubmissionStatus =
  | "PENDING"
  | "APPROVED"
  | "REJECTED";

export type TournamentScoreSubmitterRole = "PLAYER" | "ADMIN";

export type TournamentMatchScoreSubmission = {
  id: string;
  matchId: string;
  submittedByUserId: string | null;
  submittedByParticipantId: string | null;
  submitterLoginId?: string | null;
  submitterDisplayName?: string | null;
  submitterRole: TournamentScoreSubmitterRole;
  slot1Score: number;
  slot2Score: number;
  winnerSlotNo: 1 | 2;
  status: TournamentScoreSubmissionStatus;
  adminNote?: string | null;
  regDate?: string | null;
};

export type TournamentSubmitScoreRequest = {
  scores: Array<{
    slotNo: 1 | 2;
    score: number;
  }>;
};

export type TournamentRejectScoreSubmissionRequest = {
  adminNote: string;
};

export type RaceSurvivalProgressSubmissionStatus =
  | "PENDING"
  | "APPROVED"
  | "REJECTED";

export type RaceSurvivalProgressSubmissionMatch = {
  id: string;
  matchOrder: number;
  mapId: number | null;
  mapName: string | null;
  slot1ParticipantId: string;
  slot1Participant: TournamentParticipant | null;
  slot1Race: string | null;
  slot2ParticipantId: string;
  slot2Participant: TournamentParticipant | null;
  slot2Race: string | null;
  slot1Score: number;
  slot2Score: number;
  winnerParticipantId: string | null;
  winnerParticipant: TournamentParticipant | null;
};

export type RaceSurvivalProgressSubmission = {
  id: string;
  tournamentId: string;
  submittedByUserId: string | null;
  submitterLoginId: string | null;
  status: RaceSurvivalProgressSubmissionStatus;
  reviewedByUserId: string | null;
  reviewerLoginId: string | null;
  adminNote: string | null;
  regDate: string | null;
  reviewedAt: string | null;
  matches: RaceSurvivalProgressSubmissionMatch[];
};

export type RaceSurvivalProgressSubmissionRequest = {
  matches: Array<{
    matchOrder: number;
    mapId: number | null;
    slot1ParticipantId: number;
    slot2ParticipantId: number;
    slot1Score: number;
    slot2Score: number;
  }>;
};

const endpoint = "/tournaments";

const matchLayoutByRole: Record<
  TournamentMatchRole,
  { layoutCol: number; layoutRow: number }
> = {
  OPENING: { layoutCol: 0, layoutRow: 102 },
  WINNERS: { layoutCol: 310, layoutRow: 127 },
  LOSERS: { layoutCol: 310, layoutRow: 280 },
  DECIDER: { layoutCol: 660, layoutRow: 204 },
  ROUND: { layoutCol: 0, layoutRow: 102 },
  FINAL: { layoutCol: 310, layoutRow: 204 },
};

const duelMatchLayoutByKey: Record<string, { layoutCol: number; layoutRow: number }> = {
  A1: { layoutCol: 0, layoutRow: 102 },
  A2: { layoutCol: 0, layoutRow: 244 },
  AW: { layoutCol: 310, layoutRow: 127 },
  AL: { layoutCol: 310, layoutRow: 280 },
  AF: { layoutCol: 660, layoutRow: 204 },
  B1: { layoutCol: 0, layoutRow: 102 },
  B2: { layoutCol: 0, layoutRow: 244 },
  BW: { layoutCol: 310, layoutRow: 127 },
  BL: { layoutCol: 310, layoutRow: 280 },
  BF: { layoutCol: 660, layoutRow: 204 },
};

const participantColors = [
  "#146c94",
  "#267550",
  "#8a6500",
  "#b34040",
  "#5577d9",
  "#9d7a62",
  "#3f86b5",
  "#737d8a",
];

function readObject(value: unknown): RawObject {
  return value && typeof value === "object" ? (value as RawObject) : {};
}

function readArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function readString(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function readStringOrNull(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function readNumber(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function readNullableNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  return null;
}

function readBoolean(value: unknown) {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    return value === 1;
  }

  return false;
}

function readId(value: unknown, fallback: string) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  return readString(value, fallback);
}

function readNullableId(value: unknown) {
  if (value === null || value === undefined) {
    return null;
  }

  const id = readId(value, "");

  return id || null;
}

function normalizeTournamentStatus(value: unknown): TournamentStatus {
  return value === "FINISHED" ? "FINISHED" : "LIVE";
}

function normalizeBracketType(value: unknown): TournamentBracketType | null {
  switch (value) {
    case "SINGLE_ELIMINATION":
    case "DUAL_GROUP":
    case "ULTIMATE_BATTLE":
    case "RACE_SURVIVAL":
      return value;
    default:
      return null;
  }
}

function normalizeMatchStatus(value: unknown): TournamentMatchStatus {
  switch (value) {
    case "READY":
    case "FINISHED":
    case "CANCELLED":
      return value;
    case "PENDING":
    default:
      return "PENDING";
  }
}

function normalizeScoreSubmissionStatus(
  value: unknown,
): TournamentScoreSubmissionStatus {
  switch (value) {
    case "APPROVED":
    case "REJECTED":
      return value;
    case "PENDING":
    default:
      return "PENDING";
  }
}

function normalizeScoreSubmitterRole(
  value: unknown,
): TournamentScoreSubmitterRole {
  return value === "ADMIN" ? "ADMIN" : "PLAYER";
}

function normalizeRaceSurvivalProgressSubmissionStatus(
  value: unknown,
): RaceSurvivalProgressSubmissionStatus {
  switch (value) {
    case "APPROVED":
    case "REJECTED":
      return value;
    case "PENDING":
    default:
      return "PENDING";
  }
}

function normalizeMatchRole(value: unknown): TournamentMatchRole {
  switch (value) {
    case "WINNERS":
    case "LOSERS":
    case "DECIDER":
    case "ROUND":
    case "FINAL":
      return value;
    case "OPENING":
    default:
      return "OPENING";
  }
}

function normalizeSourceOutcome(value: unknown): TournamentSlotOutcome | undefined {
  switch (value) {
    case "WIN":
    case "WINNER":
      return "WIN";
    case "LOSS":
    case "LOSER":
      return "LOSS";
    default:
      return undefined;
  }
}

function normalizeResultType(value: unknown, rankNo: number): TournamentResultType {
  switch (value) {
    case "GROUP_WINNER":
    case "CHAMPION":
      return "GROUP_WINNER";
    case "GROUP_RUNNER_UP":
    case "RUNNER_UP":
      return "GROUP_RUNNER_UP";
    case "QUALIFIED":
    default:
      return rankNo === 1 ? "GROUP_WINNER" : "GROUP_RUNNER_UP";
  }
}

function normalizeGroupCode(
  value: unknown,
  fallback: TournamentGroupCode,
): TournamentGroupCode {
  return readString(value, fallback) as TournamentGroupCode;
}

function resolveParticipantDisplayName(value: RawObject) {
  const userLoginId = readStringOrNull(value.userLoginId);
  const participantName = readStringOrNull(value.participantName);
  const displayName = readStringOrNull(value.displayName);

  if (userLoginId) {
    return displayName && displayName !== participantName
      ? displayName
      : userLoginId;
  }

  return displayName ?? participantName ?? "외부 참가자";
}

function buildSeedLabel(value: RawObject, fallbackIndex: number) {
  const explicitSeedLabel = readString(value.seedLabel);
  if (explicitSeedLabel) {
    return explicitSeedLabel;
  }

  const seedNo = readNumber(value.seedNo, 0);
  if (seedNo > 0) {
    return String(seedNo);
  }

  const displayName = resolveParticipantDisplayName(value);
  return displayName.slice(0, 1).toUpperCase() || String(fallbackIndex + 1);
}

function normalizeParticipant(
  value: unknown,
  fallbackIndex: number,
): TournamentParticipant | null {
  const raw = readObject(value);
  const id = readId(raw.id, "");

  if (!id) {
    return null;
  }

  const userLoginId = readStringOrNull(raw.userLoginId);
  const participantName = readStringOrNull(raw.participantName);
  const displayName = resolveParticipantDisplayName(raw);

  return {
    id,
    userId: readNullableId(raw.userId),
    userLoginId,
    participantName,
    displayName,
    seedLabel: buildSeedLabel(raw, fallbackIndex),
    color: readString(
      raw.color,
      participantColors[fallbackIndex % participantColors.length],
    ),
    status: readStringOrNull(raw.status),
  };
}

function inferLayout(
  matchRole: TournamentMatchRole,
  matchKey: string,
  rawLayoutCol: unknown,
  rawLayoutRow: unknown,
) {
  const duelLayout = inferCanonicalDuelLayout(matchKey);

  if (duelLayout) {
    return duelLayout;
  }

  const fallbackLayout = matchLayoutByRole[matchRole] ?? matchLayoutByRole.ROUND;
  const apiLayoutCol =
    typeof rawLayoutCol === "number" && Number.isFinite(rawLayoutCol)
      ? rawLayoutCol
      : null;
  const apiLayoutRow =
    typeof rawLayoutRow === "number" && Number.isFinite(rawLayoutRow)
      ? rawLayoutRow
      : null;
  const hasPixelApiLayout =
    (apiLayoutCol !== null && Math.abs(apiLayoutCol) >= 80) ||
    (apiLayoutRow !== null && Math.abs(apiLayoutRow) >= 80);

  if (!hasPixelApiLayout) {
    return inferGridLayout(apiLayoutCol, apiLayoutRow, fallbackLayout);
  }

  return {
    layoutCol: apiLayoutCol ?? fallbackLayout.layoutCol,
    layoutRow:
      apiLayoutRow !== null && apiLayoutRow > 0
        ? apiLayoutRow
        : fallbackLayout.layoutRow,
  };
}

function inferGridLayout(
  layoutCol: number | null,
  layoutRow: number | null,
  fallbackLayout: { layoutCol: number; layoutRow: number },
) {
  const hasGridLayout =
    (layoutCol !== null && layoutCol > 0 && layoutCol < 80) ||
    (layoutRow !== null && layoutRow > 0 && layoutRow < 80);

  if (!hasGridLayout) {
    return fallbackLayout;
  }

  return {
    layoutCol:
      layoutCol !== null && layoutCol > 0 && layoutCol < 80
        ? (layoutCol - 1) * 310
        : fallbackLayout.layoutCol,
    layoutRow:
      layoutRow !== null && layoutRow > 0 && layoutRow < 80
        ? 102 + (layoutRow - 1) * 102
        : fallbackLayout.layoutRow,
  };
}

function inferCanonicalDuelLayout(matchKey: string) {
  return duelMatchLayoutByKey[matchKey.toUpperCase()] ?? null;
}

function formatSingleEliminationMatchName(
  matchKey: string,
  matchRole: TournamentMatchRole,
  rawDisplayName: unknown,
) {
  const normalizedKey = matchKey.trim().toUpperCase();
  const roundMatchByKey = normalizedKey.match(/^R(\d+)M(\d+)$/);

  if (roundMatchByKey) {
    return `ROUND${roundMatchByKey[1]} MATCH ${roundMatchByKey[2]}`;
  }

  if (normalizedKey === "FINAL" || matchRole === "FINAL") {
    return "FINAL";
  }

  const displayName = readString(rawDisplayName, matchKey);
  const roundMatchByName = displayName.match(/^ROUND\s*(\d+)\s*MATCH\s*(\d+)$/i);

  if (roundMatchByName) {
    return `ROUND${roundMatchByName[1]} MATCH ${roundMatchByName[2]}`;
  }

  return displayName;
}

function resolveMatchDisplayName(
  matchKey: string,
  matchRole: TournamentMatchRole,
  groupCode: TournamentGroupCode,
  rawDisplayName: unknown,
) {
  const isSingleMatch =
    groupCode === "MAIN" ||
    matchRole === "ROUND" ||
    matchRole === "FINAL" ||
    /^R\d+M\d+$/i.test(matchKey) ||
    matchKey.toUpperCase() === "FINAL";

  return isSingleMatch
    ? formatSingleEliminationMatchName(matchKey, matchRole, rawDisplayName)
    : readString(rawDisplayName, matchKey);
}

function normalizeMatchSlot(
  value: unknown,
  index: number,
  participantById: Map<string, TournamentParticipant>,
): TournamentMatchSlot {
  const raw = readObject(value);
  const isBye = readBoolean(raw.isBye);
  const participant =
    normalizeParticipant(raw.participant, participantById.size) ??
    participantById.get(readId(raw.participantId, ""));

  if (participant) {
    participantById.set(participant.id, participant);
  }

  return {
    slotNo: readNumber(raw.slotNo, index + 1),
    participant: participant ?? null,
    placeholderLabel: isBye
      ? "부전승"
      : readString(raw.placeholderLabel, `슬롯 ${index + 1}`),
    score:
      typeof raw.score === "number" && Number.isFinite(raw.score)
        ? raw.score
        : null,
    isWinner: readBoolean(raw.isWinner),
    isBye,
    sourceMatchId: raw.sourceMatchId
      ? readId(raw.sourceMatchId, "")
      : undefined,
    sourceOutcome: normalizeSourceOutcome(raw.sourceOutcome),
  };
}

function normalizeMatch(
  value: unknown,
  index: number,
  groupCode: TournamentGroupCode,
  participantById: Map<string, TournamentParticipant>,
): TournamentMatch {
  const raw = readObject(value);
  const matchRole = normalizeMatchRole(raw.matchRole);
  const matchKey = readString(raw.matchKey, `${groupCode}${index + 1}`);
  const layout = inferLayout(matchRole, matchKey, raw.layoutCol, raw.layoutRow);

  return {
    id: readId(raw.id, matchKey),
    matchKey: matchKey as TournamentMatchKey,
    matchRole,
    displayName: resolveMatchDisplayName(
      matchKey,
      matchRole,
      groupCode,
      raw.displayName,
    ),
    bestOf: readNumber(raw.bestOf, 3),
    status: normalizeMatchStatus(raw.status),
    mapId: readNullableNumber(raw.mapId),
    mapName: readStringOrNull(raw.mapName),
    scheduledAt: readStringOrNull(raw.scheduledAt),
    slots: readArray(raw.slots)
      .map((slot, slotIndex) =>
        normalizeMatchSlot(slot, slotIndex, participantById),
      )
      .sort((left, right) => left.slotNo - right.slotNo),
    displayOrder: readNumber(raw.displayOrder, index + 1),
    ...layout,
  };
}

function normalizeConnectorSegment(value: unknown): TournamentConnectorSegment | null {
  const raw = readObject(value);
  const orientation = raw.orientation === "VERTICAL" ? "VERTICAL" : "HORIZONTAL";
  const x = readNumber(raw.x, Number.NaN);
  const y = readNumber(raw.y, Number.NaN);
  const length = readNumber(raw.length, Number.NaN);

  if (![x, y, length].every(Number.isFinite)) {
    return null;
  }

  return { orientation, x, y, length };
}

function normalizeConnector(value: unknown): TournamentParticipantConnector | null {
  const raw = readObject(value);
  const participantId = readId(raw.participantId, "");
  const segments = readArray(raw.segments)
    .map(normalizeConnectorSegment)
    .filter((segment): segment is TournamentConnectorSegment => Boolean(segment));

  if (!participantId || segments.length === 0) {
    return null;
  }

  return { participantId, segments };
}

function normalizeResultSlot(
  value: unknown,
  index: number,
  groupCode: TournamentGroupCode,
  participantById: Map<string, TournamentParticipant>,
): TournamentResultSlot {
  const raw = readObject(value);
  const rankNo = readNumber(raw.rankNo, index + 1);
  const participant =
    normalizeParticipant(raw.participant, participantById.size) ??
    participantById.get(readId(raw.participantId, ""));
  const resultType = normalizeResultType(raw.resultType, rankNo);
  const explicitLabel = readString(raw.label);
  const resultKey = readString(raw.resultKey, `${groupCode}-${rankNo}`);
  const isSingleResult =
    groupCode === "MAIN" || resultKey === "CHAMPION" || resultKey === "RUNNER_UP";
  const fallbackLabel = isSingleResult
    ? `${rankNo}위`
    : `${groupCode}조 ${rankNo}위`;
  const shouldUseRankLabel = rankNo === 1 || rankNo === 2;

  return {
    resultKey,
    resultType,
    rankNo,
    label: shouldUseRankLabel ? fallbackLabel : explicitLabel || fallbackLabel,
    participant: participant ?? null,
  };
}

function ensureResultSlots(
  resultSlots: TournamentResultSlot[],
  groupCode: TournamentGroupCode,
) {
  const nextSlots = [...resultSlots];

  for (const rankNo of [1, 2]) {
    if (nextSlots.some((slot) => slot.rankNo === rankNo)) {
      continue;
    }

    const isSingleGroup = groupCode === "MAIN";
    nextSlots.push({
      resultKey: `${groupCode}-${rankNo}`,
      resultType: rankNo === 1 ? "GROUP_WINNER" : "GROUP_RUNNER_UP",
      rankNo,
      label: isSingleGroup ? `${rankNo}위` : `${groupCode}조 ${rankNo}위`,
      participant: null,
    });
  }

  return nextSlots.sort((left, right) => left.rankNo - right.rankNo);
}

function normalizeGroup(value: unknown, index: number): TournamentGroup {
  const raw = readObject(value);
  const fallbackGroupCode = index === 0 ? "A" : "B";
  const groupCode = normalizeGroupCode(raw.groupCode, fallbackGroupCode);
  const participantById = new Map<string, TournamentParticipant>();
  const participants = readArray(raw.participants)
    .map((participant, participantIndex) =>
      normalizeParticipant(participant, participantIndex),
    )
    .filter((participant): participant is TournamentParticipant =>
      Boolean(participant),
    );
  participants.forEach((participant) => {
    participantById.set(participant.id, participant);
  });
  const matches = readArray(raw.matches)
    .map((match, matchIndex) =>
      normalizeMatch(match, matchIndex, groupCode, participantById),
    )
    .sort(
      (left, right) =>
        left.layoutCol - right.layoutCol ||
        left.layoutRow - right.layoutRow ||
        left.matchKey.localeCompare(right.matchKey),
    );
  const resultSlots = ensureResultSlots(readArray(raw.resultSlots)
    .map((slot, slotIndex) =>
      normalizeResultSlot(slot, slotIndex, groupCode, participantById),
    )
    .sort((left, right) => left.rankNo - right.rankNo), groupCode);
  const connectors = readArray(raw.connectors)
    .map(normalizeConnector)
    .filter((connector): connector is TournamentParticipantConnector =>
      Boolean(connector),
    );

  return {
    id: readId(raw.id, `group-${groupCode.toLowerCase()}`),
    groupCode,
    groupName: readString(raw.groupName, `${groupCode}조`),
    description: readString(
      raw.description,
      groupCode === "A"
        ? "승자전 승자는 1위 진출, 최종전 승자는 2위 진출"
        : "최종전 승자는 2위 진출",
    ),
    participants,
    matches,
    resultSlots,
    connectors: connectors.length > 0 ? connectors : undefined,
  };
}

function normalizeTournament(value: unknown): Tournament {
  const raw = readObject(value);
  const stages = readArray(raw.stages);
  const stageGroups = readArray(raw.stages).flatMap((stage) =>
    readArray(readObject(stage).groups),
  );
  const groups = (readArray(raw.groups).length > 0
    ? readArray(raw.groups)
    : stageGroups
  ).map(normalizeGroup);
  const firstStage = readObject(stages[0]);
  const bracketType =
    normalizeBracketType(raw.bracketType) ??
    normalizeBracketType(firstStage.stageType);

  return {
    id: readId(raw.id, "current"),
    title: readString(raw.title, "듀얼 토너먼트 조별 대진표"),
    bracketType,
    status: normalizeTournamentStatus(raw.status),
    groups,
  };
}

function normalizeTournamentSummary(value: unknown): TournamentSummary {
  const raw = readObject(value);
  const stages = readArray(raw.stages);
  const firstStage = readObject(stages[0]);
  const groups = readArray(raw.groups);
  const stageGroups = stages.flatMap((stage) =>
    readArray(readObject(stage).groups),
  );
  const normalizedGroups = groups.length > 0 ? groups : stageGroups;
  const bracketType =
    normalizeBracketType(raw.bracketType) ??
    normalizeBracketType(firstStage.stageType);
  const participantCount =
    readNumber(raw.participantCount, 0) ||
    readArray(raw.participants).length ||
    normalizedGroups.reduce<number>((total, group) => {
      const groupObject = readObject(group);
      return total + readArray(groupObject.participants).length;
    }, 0);

  return {
    id: readId(raw.id, ""),
    title: readString(raw.title, "이름 없는 토너먼트"),
    bracketType,
    status: normalizeTournamentStatus(raw.status),
    groupCount: readNumber(raw.groupCount, normalizedGroups.length),
    participantCount,
    regDate:
      readString(raw.regDate) ||
      readString(raw.createdAt) ||
      null,
    updateDate:
      readString(raw.updateDate) ||
      readString(raw.updatedAt) ||
      null,
  };
}

function normalizeTournamentPage(
  value: unknown,
  params: ListTournamentsParams = {},
): TournamentPage {
  if (Array.isArray(value)) {
    const items = value
      .map(normalizeTournamentSummary)
      .filter((tournament) => tournament.id);

    return {
      items,
      page: params.page ?? 0,
      size: params.size ?? items.length,
      totalElements: items.length,
      totalPages: items.length > 0 ? 1 : 0,
      hasNext: false,
      hasPrevious: false,
    };
  }

  const raw = readObject(value);
  const rawItems = readArray(raw.items).length > 0
    ? readArray(raw.items)
    : readArray(raw.tournaments);
  const items = rawItems
    .map(normalizeTournamentSummary)
    .filter((tournament) => tournament.id);
  const page = readNumber(raw.page, params.page ?? 0);
  const size = readNumber(raw.size, params.size ?? items.length);
  const totalElements = readNumber(raw.totalElements, items.length);
  const totalPages = readNumber(
    raw.totalPages,
    size > 0 ? Math.ceil(totalElements / size) : 0,
  );

  return {
    items,
    page,
    size,
    totalElements,
    totalPages,
    hasNext: readBoolean(raw.hasNext),
    hasPrevious: readBoolean(raw.hasPrevious),
  };
}

function normalizeScoreSubmission(
  value: unknown,
): TournamentMatchScoreSubmission {
  const raw = readObject(value);
  const slot1Score = readNumber(raw.slot1Score, 0);
  const slot2Score = readNumber(raw.slot2Score, 0);
  const winnerSlotNo = readNumber(raw.winnerSlotNo, slot1Score >= slot2Score ? 1 : 2);

  return {
    id: readId(raw.id, readId(raw.submissionId, "")),
    matchId: readId(raw.matchId, ""),
    submittedByUserId: readNullableId(raw.submittedByUserId),
    submittedByParticipantId: readNullableId(raw.submittedByParticipantId),
    submitterLoginId: readStringOrNull(raw.submitterLoginId),
    submitterDisplayName: readStringOrNull(raw.submitterDisplayName),
    submitterRole: normalizeScoreSubmitterRole(raw.submitterRole),
    slot1Score,
    slot2Score,
    winnerSlotNo: winnerSlotNo === 2 ? 2 : 1,
    status: normalizeScoreSubmissionStatus(raw.status),
    adminNote: readString(raw.adminNote) || null,
    regDate: readString(raw.regDate) || null,
  };
}

function normalizeRaceSurvivalProgressSubmissionMatch(
  value: unknown,
  index: number,
): RaceSurvivalProgressSubmissionMatch {
  const raw = readObject(value);
  const slot1Participant = normalizeParticipant(raw.slot1Participant, index * 2);
  const slot2Participant = normalizeParticipant(raw.slot2Participant, index * 2 + 1);
  const winnerParticipant = normalizeParticipant(raw.winnerParticipant, index * 2);

  return {
    id: readId(raw.id, `match-${index + 1}`),
    matchOrder: readNumber(raw.matchOrder, index + 1),
    mapId: readNullableNumber(raw.mapId),
    mapName: readStringOrNull(raw.mapName),
    slot1ParticipantId: readId(raw.slot1ParticipantId, slot1Participant?.id ?? ""),
    slot1Participant,
    slot1Race: readStringOrNull(raw.slot1Race),
    slot2ParticipantId: readId(raw.slot2ParticipantId, slot2Participant?.id ?? ""),
    slot2Participant,
    slot2Race: readStringOrNull(raw.slot2Race),
    slot1Score: readNumber(raw.slot1Score, 0),
    slot2Score: readNumber(raw.slot2Score, 0),
    winnerParticipantId: readNullableId(raw.winnerParticipantId),
    winnerParticipant,
  };
}

function normalizeRaceSurvivalProgressSubmission(
  value: unknown,
): RaceSurvivalProgressSubmission {
  const raw = readObject(value);

  return {
    id: readId(raw.id, ""),
    tournamentId: readId(raw.tournamentId, ""),
    submittedByUserId: readNullableId(raw.submittedByUserId),
    submitterLoginId: readStringOrNull(raw.submitterLoginId),
    status: normalizeRaceSurvivalProgressSubmissionStatus(raw.status),
    reviewedByUserId: readNullableId(raw.reviewedByUserId),
    reviewerLoginId: readStringOrNull(raw.reviewerLoginId),
    adminNote: readStringOrNull(raw.adminNote),
    regDate: readStringOrNull(raw.regDate),
    reviewedAt: readStringOrNull(raw.reviewedAt),
    matches: readArray(raw.matches)
      .map(normalizeRaceSurvivalProgressSubmissionMatch)
      .sort((left, right) => left.matchOrder - right.matchOrder),
  };
}

function readErrorMessage(data: unknown, fallback: string) {
  const body = readObject(data);

  return (
    readString(body.message) ||
    readString(body.error) ||
    fallback
  );
}

async function unwrapPayload<T>(
  request: Promise<{
    config?: {
      data?: unknown;
      method?: string;
      params?: unknown;
      url?: string;
    };
    status: number;
    data: ApiEnvelope<T> | ErrorResponseBody | T;
  }>,
  fallback: string,
) {
  try {
    const response = await request;
    const bodyObject = readObject(response.data);
    const responseStatus =
      typeof bodyObject.status === "number" ? bodyObject.status : response.status;
    const responseMessage = readErrorMessage(response.data, fallback);

    if (response.status < 200 || response.status >= 300) {
      throw new Error(responseMessage);
    }

    if (responseStatus < 200 || responseStatus >= 300) {
      throw new Error(responseMessage);
    }

    if ("data" in bodyObject) {
      return bodyObject.data as T;
    }

    return response.data as T;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new Error(
        readErrorMessage(error.response?.data, error.message || fallback),
      );
    }

    if (error instanceof Error) {
      throw error;
    }

    throw new Error(fallback);
  }
}

async function unwrapResponse<T>(
  request: Promise<{
    config?: {
      data?: unknown;
      method?: string;
      params?: unknown;
      url?: string;
    };
    status: number;
    data: ApiEnvelope<T> | ErrorResponseBody;
  }>,
  fallback: string,
) {
  try {
    const response = await request;
    const body = response.data as ApiEnvelope<T>;
    const responseStatus =
      typeof body.status === "number" ? body.status : response.status;
    const responseMessage = readErrorMessage(response.data, fallback);

    if (response.status < 200 || response.status >= 300) {
      throw new Error(responseMessage);
    }

    if (
      responseStatus < 200 ||
      responseStatus >= 300 ||
      body.data === null ||
      body.data === undefined
    ) {
      throw new Error(responseMessage);
    }

    return body.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new Error(
        readErrorMessage(error.response?.data, error.message || fallback),
      );
    }

    if (error instanceof Error) {
      throw error;
    }

    throw new Error(fallback);
  }
}

export async function listTournaments(params: ListTournamentsParams = {}) {
  const keyword = params.keyword?.trim();
  const tournaments = await unwrapResponse(
    apiClient.get<ApiEnvelope<unknown>>(endpoint, {
      params: {
        page: params.page ?? 0,
        size: params.size ?? 10,
        ...(keyword ? { keyword } : {}),
      },
      skipAuth: true,
      validateStatus: () => true,
    }),
    "토너먼트 목록을 불러오지 못했습니다.",
  );
  return normalizeTournamentPage(tournaments, params);
}

export async function deleteTournaments(tournamentIds: Array<string | number>) {
  const normalizedIds = tournamentIds
    .map((tournamentId) => Number(tournamentId))
    .filter((tournamentId) => Number.isFinite(tournamentId));

  await unwrapPayload<unknown>(
    apiClient.post<ApiEnvelope<unknown> | unknown>(
      `${endpoint}/delete`,
      { tournamentIds: normalizedIds },
      {
        validateStatus: () => true,
      },
    ),
    "토너먼트를 삭제하지 못했습니다.",
  );
}

export async function getTournament(tournamentId: string) {
  const tournament = await unwrapResponse(
    apiClient.get<ApiEnvelope<unknown>>(`${endpoint}/${tournamentId}`, {
      skipAuth: true,
      validateStatus: () => true,
    }),
    "토너먼트 정보를 불러오지 못했습니다.",
  );

  return normalizeTournament(tournament);
}

export async function createTournament(payload: TournamentCreateRequest) {
  const tournament = await unwrapResponse(
    apiClient.post<ApiEnvelope<unknown>>(endpoint, payload, {
      validateStatus: () => true,
    }),
    "토너먼트를 등록하지 못했습니다.",
  );

  return normalizeTournament(tournament);
}

export async function updateTournamentMatchMap(
  tournamentId: string,
  matchId: string,
  mapId: number | null,
) {
  const tournament = await unwrapPayload<unknown>(
    apiClient.put<ApiEnvelope<unknown> | unknown>(
      `${endpoint}/${tournamentId}/matches/${matchId}/map`,
      { mapId },
      {
        validateStatus: () => true,
      },
    ),
    "경기 맵을 저장하지 못했습니다.",
  );

  return normalizeTournament(tournament);
}

export async function updateTournamentMatchParticipants(
  tournamentId: string,
  matchId: string,
  payload: {
    slot1ParticipantId: number | null;
    slot2ParticipantId: number | null;
  },
) {
  const tournament = await unwrapPayload<unknown>(
    apiClient.put<ApiEnvelope<unknown> | unknown>(
      `${endpoint}/${tournamentId}/matches/${matchId}/participants`,
      payload,
      {
        validateStatus: () => true,
      },
    ),
    "경기 선수를 저장하지 못했습니다.",
  );

  return normalizeTournament(tournament);
}

export async function submitRaceSurvivalProgressSubmission(
  tournamentId: string,
  payload: RaceSurvivalProgressSubmissionRequest,
) {
  const submission = await unwrapPayload<unknown>(
    apiClient.post<ApiEnvelope<unknown> | unknown>(
      `${endpoint}/${tournamentId}/race-survival-progress-submissions`,
      payload,
      {
        validateStatus: () => true,
      },
    ),
    "종족 최강전 진행안을 제출하지 못했습니다.",
  );

  return normalizeRaceSurvivalProgressSubmission(submission);
}

export async function listRaceSurvivalProgressSubmissions(
  tournamentId: string,
) {
  const submissions = await unwrapPayload<unknown>(
    apiClient.get<ApiEnvelope<unknown> | unknown>(
      `${endpoint}/${tournamentId}/race-survival-progress-submissions`,
      {
        validateStatus: () => true,
      },
    ),
    "종족 최강전 진행안 목록을 불러오지 못했습니다.",
  );

  return readArray(submissions).map(normalizeRaceSurvivalProgressSubmission);
}

export async function approveRaceSurvivalProgressSubmission(
  tournamentId: string,
  submissionId: string,
) {
  const tournament = await unwrapPayload<unknown>(
    apiClient.post<ApiEnvelope<unknown> | unknown>(
      `${endpoint}/${tournamentId}/race-survival-progress-submissions/${submissionId}/approve`,
      undefined,
      {
        validateStatus: () => true,
      },
    ),
    "종족 최강전 진행안을 최종 승인하지 못했습니다.",
  );

  return normalizeTournament(tournament);
}

export async function rejectRaceSurvivalProgressSubmission(
  tournamentId: string,
  submissionId: string,
  payload: TournamentRejectScoreSubmissionRequest,
) {
  const submission = await unwrapPayload<unknown>(
    apiClient.post<ApiEnvelope<unknown> | unknown>(
      `${endpoint}/${tournamentId}/race-survival-progress-submissions/${submissionId}/reject`,
      payload,
      {
        validateStatus: () => true,
      },
    ),
    "종족 최강전 진행안을 반려하지 못했습니다.",
  );

  return normalizeRaceSurvivalProgressSubmission(submission);
}

export async function submitTournamentMatchScore(
  tournamentId: string,
  matchId: string,
  payload: TournamentSubmitScoreRequest,
) {
  const submission = await unwrapPayload<unknown>(
    apiClient.post<ApiEnvelope<unknown> | unknown>(
      `${endpoint}/${tournamentId}/matches/${matchId}/score-submissions`,
      payload,
      {
        validateStatus: () => true,
      },
    ),
    "경기 점수를 제출하지 못했습니다.",
  );

  return normalizeScoreSubmission(submission);
}

export async function listTournamentMatchScoreSubmissions(
  tournamentId: string,
  matchId: string,
) {
  const submissions = await unwrapPayload<unknown>(
    apiClient.get<ApiEnvelope<unknown> | unknown>(
      `${endpoint}/${tournamentId}/matches/${matchId}/score-submissions`,
      {
        validateStatus: () => true,
      },
    ),
    "경기 점수 제출 내역을 불러오지 못했습니다.",
  );

  return readArray(submissions).map(normalizeScoreSubmission);
}

export async function approveTournamentMatchScoreSubmission(
  tournamentId: string,
  matchId: string,
  submissionId: string,
) {
  const tournament = await unwrapPayload<unknown>(
    apiClient.post<ApiEnvelope<unknown> | unknown>(
      `${endpoint}/${tournamentId}/matches/${matchId}/score-submissions/${submissionId}/approve`,
      undefined,
      {
        validateStatus: () => true,
      },
    ),
    "경기 점수 제출을 승인하지 못했습니다.",
  );

  return normalizeTournament(tournament);
}

export async function rejectTournamentMatchScoreSubmission(
  tournamentId: string,
  matchId: string,
  submissionId: string,
  payload: TournamentRejectScoreSubmissionRequest,
) {
  const submission = await unwrapPayload<unknown>(
    apiClient.post<ApiEnvelope<unknown> | unknown>(
      `${endpoint}/${tournamentId}/matches/${matchId}/score-submissions/${submissionId}/reject`,
      payload,
      {
        validateStatus: () => true,
      },
    ),
    "경기 점수 제출을 반려하지 못했습니다.",
  );

  return normalizeScoreSubmission(submission);
}
