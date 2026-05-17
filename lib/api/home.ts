import axios from "axios";
import { apiClient } from "@/lib/api/client";
import type {
  HomeScheduleMatch,
  HomeScheduleMatchFormat,
  HomeSchedulePlayerSide,
  StarcraftRace,
} from "@/lib/api/home-schedule";

type ApiEnvelope<T> = {
  status?: number;
  message?: string;
  data?: T | null;
  error?: string;
};

type ErrorResponseBody = {
  status?: number;
  message?: string;
  error?: string;
};

export type HomeMainOngoingType = "DRAFT" | "TOURNAMENT" | (string & {});

export type HomeMainOngoingItem = {
  type: HomeMainOngoingType;
  id: number;
  title: string;
  status: string;
  primaryText: string | null;
  secondaryText: string | null;
  updatedAt: string | null;
};

export type HomeMainBotAlert = {
  type: string;
  message: string;
  sourceId: number | null;
};

export type HomeMainGalleryPost = {
  id: number;
  title: string;
  summaryText: string | null;
  authorUserId: string | null;
  regDate: string | null;
};

export type HomeMainScheduleLinkType = "DIRECT" | "REDIRECT" | (string & {});

export type HomeMainSchedule = {
  id: number;
  scheduleGroup: string;
  title: string;
  description: string | null;
  scheduledAt: string | null;
  timeLabel: string | null;
  targetUrl: string | null;
  linkType: HomeMainScheduleLinkType;
  navigationUrl: string | null;
  matches: HomeScheduleMatch[];
};

export type HomeMainResponse = {
  ongoing: HomeMainOngoingItem[];
  botAlerts: HomeMainBotAlert[];
  galleryPosts: HomeMainGalleryPost[];
  notice: HomeMainSchedule | null;
  proleagueSchedules: HomeMainSchedule[];
  personalLeagueSchedules: HomeMainSchedule[];
  schedules: HomeMainSchedule[];
};

const HOME_SCHEDULE_MATCH_FORMATS = new Set<HomeScheduleMatchFormat>([
  "1V1",
  "2V2",
  "3V3",
  "ACE",
  "CUSTOM",
]);

const HOME_SCHEDULE_PLAYER_SIDES = new Set<HomeSchedulePlayerSide>(["A", "B"]);

const STARCRAFT_RACES = new Set<StarcraftRace>([
  "ZERG",
  "TERRAN",
  "PROTOSS",
  "RANDOM",
]);

function readErrorMessage(data: unknown, fallback: string) {
  if (!data || typeof data !== "object") {
    return fallback;
  }

  const body = data as ErrorResponseBody;

  if (typeof body.message === "string" && body.message.trim()) {
    return body.message;
  }

  if (typeof body.error === "string" && body.error.trim()) {
    return body.error;
  }

  return fallback;
}

function readResponseStatus(data: unknown, fallback: number) {
  if (!data || typeof data !== "object") {
    return fallback;
  }

  const status = (data as { status?: unknown }).status;

  return typeof status === "number" ? status : fallback;
}

async function unwrapResponse<T>(
  request: Promise<{
    data: ApiEnvelope<T> | ErrorResponseBody | T;
    status: number;
  }>,
  fallback: string,
) {
  try {
    const response = await request;
    const responseStatus = readResponseStatus(response.data, response.status);
    const message = readErrorMessage(response.data, fallback);

    if (response.status < 200 || response.status >= 300 || responseStatus >= 400) {
      throw new Error(message);
    }

    const body = response.data as ApiEnvelope<T>;

    if ("data" in body) {
      if (body.data === null || body.data === undefined) {
        throw new Error(message);
      }

      return body.data;
    }

    return response.data as T;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new Error(readErrorMessage(error.response?.data, error.message || fallback));
    }

    if (error instanceof Error) {
      throw error;
    }

    throw new Error(fallback);
  }
}

function readString(value: unknown, fallback = "") {
  if (typeof value !== "string") {
    return fallback;
  }

  const trimmed = value.trim();

  return trimmed || fallback;
}

function readNullableString(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();

  return trimmed || null;
}

function readNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function readNullableNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function readArray(value: unknown) {
  return Array.isArray(value) ? value : [];
}

function hasOwn(raw: Record<string, unknown>, key: string) {
  return Object.prototype.hasOwnProperty.call(raw, key);
}

function readMatchFormat(value: unknown): HomeScheduleMatchFormat {
  return typeof value === "string" &&
    HOME_SCHEDULE_MATCH_FORMATS.has(value as HomeScheduleMatchFormat)
    ? (value as HomeScheduleMatchFormat)
    : "1V1";
}

function readPlayerSide(value: unknown): HomeSchedulePlayerSide {
  return typeof value === "string" &&
    HOME_SCHEDULE_PLAYER_SIDES.has(value as HomeSchedulePlayerSide)
    ? (value as HomeSchedulePlayerSide)
    : "A";
}

function readRace(value: unknown): StarcraftRace | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().toUpperCase();

  return STARCRAFT_RACES.has(normalized as StarcraftRace)
    ? (normalized as StarcraftRace)
    : null;
}

function normalizeOngoingItem(value: unknown): HomeMainOngoingItem {
  const raw = value && typeof value === "object" ? (value as Record<string, unknown>) : {};

  return {
    type: readString(raw.type, "UNKNOWN"),
    id: readNumber(raw.id),
    title: readString(raw.title, "진행 항목"),
    status: readString(raw.status, "UNKNOWN"),
    primaryText: readNullableString(raw.primaryText),
    secondaryText: readNullableString(raw.secondaryText),
    updatedAt: readNullableString(raw.updatedAt),
  };
}

function normalizeBotAlert(value: unknown): HomeMainBotAlert {
  const raw = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const sourceId = raw.sourceId;

  return {
    type: readString(raw.type, "NOTICE"),
    message: readString(raw.message, "알림을 확인해 주세요."),
    sourceId:
      typeof sourceId === "number" && Number.isFinite(sourceId) ? sourceId : null,
  };
}

function normalizeGalleryPost(value: unknown): HomeMainGalleryPost {
  const raw = value && typeof value === "object" ? (value as Record<string, unknown>) : {};

  return {
    id: readNumber(raw.id),
    title: readString(raw.title, "갤러리 글"),
    summaryText: readNullableString(raw.summaryText),
    authorUserId: readNullableString(raw.authorUserId),
    regDate: readNullableString(raw.regDate),
  };
}

function normalizeMatchPlayer(value: unknown) {
  const raw = value && typeof value === "object" ? (value as Record<string, unknown>) : {};

  return {
    id: readNumber(raw.id),
    side: readPlayerSide(raw.side),
    slotOrder: readNumber(raw.slotOrder),
    userId: readNullableNumber(raw.userId),
    playerName: readString(raw.playerName, "미정"),
    playerRank: readNullableString(raw.playerRank),
    playerRace: readRace(raw.playerRace),
    note: readNullableString(raw.note),
  };
}

function normalizeMatch(value: unknown): HomeScheduleMatch {
  const raw = value && typeof value === "object" ? (value as Record<string, unknown>) : {};

  return {
    id: readNumber(raw.id),
    displayOrder: readNumber(raw.displayOrder),
    setLabel: readString(raw.setLabel, "SET"),
    matchFormat: readMatchFormat(raw.matchFormat),
    teamAName: readNullableString(raw.teamAName),
    teamBName: readNullableString(raw.teamBName),
    mapId: readNullableNumber(raw.mapId),
    mapName: readNullableString(raw.mapName),
    note: readNullableString(raw.note),
    sideAPlayers: readArray(raw.sideAPlayers).map((player) => ({
      ...normalizeMatchPlayer(player),
      side: "A" as const,
    })),
    sideBPlayers: readArray(raw.sideBPlayers).map((player) => ({
      ...normalizeMatchPlayer(player),
      side: "B" as const,
    })),
  };
}

function normalizeSchedule(value: unknown): HomeMainSchedule {
  const raw = value && typeof value === "object" ? (value as Record<string, unknown>) : {};

  return {
    id: readNumber(raw.id),
    scheduleGroup: readString(raw.scheduleGroup, "ETC"),
    title: readString(raw.title, "일정"),
    description: readNullableString(raw.description),
    scheduledAt: readNullableString(raw.scheduledAt),
    timeLabel: readNullableString(raw.timeLabel),
    targetUrl: readNullableString(raw.targetUrl),
    linkType: readString(raw.linkType, "DIRECT"),
    navigationUrl: readNullableString(raw.navigationUrl),
    matches: readArray(raw.matches).map((item) => normalizeMatch(item)),
  };
}

function normalizeHomeMain(value: unknown): HomeMainResponse {
  const raw = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const schedules = readArray(raw.schedules).map(normalizeSchedule);
  const fallbackNotice =
    schedules.find((schedule) => schedule.scheduleGroup === "NOTICE") ?? null;
  const notice =
    hasOwn(raw, "notice") && raw.notice
      ? normalizeSchedule(raw.notice)
      : hasOwn(raw, "notice")
        ? null
        : fallbackNotice;
  const fallbackProleagueSchedules = schedules.filter(
    (schedule) => schedule.scheduleGroup === "PROLEAGUE",
  );
  const explicitProleagueSchedules = hasOwn(raw, "proleagueSchedules")
    ? readArray(raw.proleagueSchedules).map(normalizeSchedule)
    : [];
  const proleagueSchedules =
    explicitProleagueSchedules.length > 0
      ? explicitProleagueSchedules
      : fallbackProleagueSchedules;
  const fallbackPersonalLeagueSchedules = schedules.filter(
    (schedule) =>
      schedule.scheduleGroup === "PERSONAL" ||
      schedule.scheduleGroup === "PERSONAL_LEAGUE",
  );
  const explicitPersonalLeagueSchedules = hasOwn(raw, "personalLeagueSchedules")
    ? readArray(raw.personalLeagueSchedules).map(normalizeSchedule)
    : [];
  const personalLeagueSchedules =
    explicitPersonalLeagueSchedules.length > 0
      ? explicitPersonalLeagueSchedules
      : fallbackPersonalLeagueSchedules;

  return {
    ongoing: readArray(raw.ongoing).map(normalizeOngoingItem),
    botAlerts: readArray(raw.botAlerts).map(normalizeBotAlert),
    galleryPosts: readArray(raw.galleryPosts).map(normalizeGalleryPost),
    notice,
    proleagueSchedules,
    personalLeagueSchedules,
    schedules,
  };
}

export function createEmptyHomeMain(): HomeMainResponse {
  return {
    ongoing: [],
    botAlerts: [],
    galleryPosts: [],
    notice: null,
    proleagueSchedules: [],
    personalLeagueSchedules: [],
    schedules: [],
  };
}

export async function getHomeMain() {
  const data = await unwrapResponse<HomeMainResponse>(
    apiClient.get<ApiEnvelope<HomeMainResponse> | HomeMainResponse>("/home/main", {
      skipAuth: true,
      skipUnauthorizedHandler: true,
      validateStatus: () => true,
    }),
    "메인 정보를 불러오지 못했습니다.",
  );

  return normalizeHomeMain(data);
}
