import axios from "axios";
import { apiClient } from "@/lib/api/client";

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

export type HomeScheduleGroup =
  | "PROLEAGUE"
  | "PERSONAL_LEAGUE"
  | "NOTICE"
  | "BOT_BRIEFING"
  | "ETC";

export type HomeScheduleLinkType = "DIRECT" | "REDIRECT";

export type HomeScheduleStatus = "UPCOMING" | "EXPIRED";

export type HomeScheduleMatchFormat = "1V1" | "2V2" | "3V3" | "ACE" | "CUSTOM";

export type HomeSchedulePlayerSide = "A" | "B";

export type StarcraftRace = "ZERG" | "TERRAN" | "PROTOSS" | "RANDOM";

export type HomeScheduleMatchPlayer = {
  id: number;
  side: HomeSchedulePlayerSide;
  slotOrder: number;
  userId: number | null;
  playerName: string;
  playerRank: string | null;
  playerRace: StarcraftRace | null;
  note: string | null;
};

export type HomeScheduleMatch = {
  id: number;
  displayOrder: number;
  setLabel: string;
  matchFormat: HomeScheduleMatchFormat;
  teamAName: string | null;
  teamBName: string | null;
  mapId: number | null;
  mapName: string | null;
  note: string | null;
  sideAPlayers: HomeScheduleMatchPlayer[];
  sideBPlayers: HomeScheduleMatchPlayer[];
};

export type AdminHomeSchedule = {
  id: number;
  scheduleGroup: HomeScheduleGroup;
  title: string;
  description: string | null;
  scheduledAt: string;
  targetUrl: string | null;
  linkType: HomeScheduleLinkType;
  displayPriority: number;
  status: HomeScheduleStatus;
  regDate: string;
  updateDate: string;
  matches: HomeScheduleMatch[];
};

export type AdminHomeSchedulePage = {
  items: AdminHomeSchedule[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
};

export type HomeSchedule = {
  id: number;
  scheduleGroup: HomeScheduleGroup;
  timeLabel: string;
  title: string;
  description: string | null;
  scheduledAt: string;
  targetUrl: string | null;
  linkType: HomeScheduleLinkType;
  navigationUrl: string | null;
  matches: HomeScheduleMatch[];
};

export type AdminHomeScheduleListParams = {
  fromDate?: string | null;
  keyword?: string | null;
  page?: number;
  scheduleGroup?: HomeScheduleGroup | null;
  size?: number;
  toDate?: string | null;
};

export type AdminHomeScheduleRequest = {
  scheduleGroup: HomeScheduleGroup;
  title: string;
  description: string;
  scheduledAt: string;
  targetUrl: string | null;
  linkType: HomeScheduleLinkType;
  displayPriority: number;
  matches: AdminHomeScheduleMatchRequest[];
};

export type AdminHomeScheduleMatchPlayerRequest = {
  id?: number | null;
  side: HomeSchedulePlayerSide;
  slotOrder: number;
  userId: number | null;
  playerName: string | null;
  playerRank: string | null;
  playerRace: StarcraftRace | null;
  note: string | null;
};

export type AdminHomeScheduleMatchRequest = {
  id?: number | null;
  displayOrder: number;
  setLabel: string;
  matchFormat: HomeScheduleMatchFormat;
  teamAName: string | null;
  teamBName: string | null;
  mapId: number | null;
  note: string | null;
  players: AdminHomeScheduleMatchPlayerRequest[];
};

export type HomeScheduleUserSearchResult = {
  id: number;
  userId: string;
  tier: string | null;
  race: StarcraftRace | null;
};

export type HomeScheduleMapSearchResult = {
  id: number;
  mapName: string;
  image: string | null;
};

export type HomeScheduleProleagueTeamSearchResult = {
  teamId: number;
  teamName: string;
  leagueId: number;
  leagueName: string;
  seasonName: string | null;
};

const HOME_SCHEDULE_GROUPS = new Set<HomeScheduleGroup>([
  "PROLEAGUE",
  "PERSONAL_LEAGUE",
  "NOTICE",
  "BOT_BRIEFING",
  "ETC",
]);

const HOME_SCHEDULE_LINK_TYPES = new Set<HomeScheduleLinkType>([
  "DIRECT",
  "REDIRECT",
]);

const HOME_SCHEDULE_STATUSES = new Set<HomeScheduleStatus>([
  "UPCOMING",
  "EXPIRED",
]);

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
    config?: {
      method?: string;
      params?: unknown;
      url?: string;
    };
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

async function unwrapVoidResponse(
  request: Promise<{
    data: ApiEnvelope<null> | ErrorResponseBody | null;
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
  return typeof value === "string" ? value : fallback;
}

function readNullableString(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();

  return trimmed || null;
}

function readNumber(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function readNullableNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function readBoolean(value: unknown, fallback = false) {
  return typeof value === "boolean" ? value : fallback;
}

function readArray(value: unknown) {
  return Array.isArray(value) ? value : [];
}

function readGroup(value: unknown): HomeScheduleGroup {
  return typeof value === "string" && HOME_SCHEDULE_GROUPS.has(value as HomeScheduleGroup)
    ? (value as HomeScheduleGroup)
    : "ETC";
}

function readLinkType(value: unknown): HomeScheduleLinkType {
  return typeof value === "string" &&
    HOME_SCHEDULE_LINK_TYPES.has(value as HomeScheduleLinkType)
    ? (value as HomeScheduleLinkType)
    : "DIRECT";
}

function readStatus(value: unknown): HomeScheduleStatus {
  return typeof value === "string" &&
    HOME_SCHEDULE_STATUSES.has(value as HomeScheduleStatus)
    ? (value as HomeScheduleStatus)
    : "UPCOMING";
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

function normalizeMatchPlayer(value: unknown): HomeScheduleMatchPlayer {
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
      side: "A",
    })),
    sideBPlayers: readArray(raw.sideBPlayers).map((player) => ({
      ...normalizeMatchPlayer(player),
      side: "B",
    })),
  };
}

function normalizeUserSearchResult(value: unknown): HomeScheduleUserSearchResult {
  const raw = value && typeof value === "object" ? (value as Record<string, unknown>) : {};

  return {
    id: readNumber(raw.id),
    userId: readString(raw.userId),
    tier: readNullableString(raw.tier),
    race: readRace(raw.race),
  };
}

function normalizeMapSearchResult(value: unknown): HomeScheduleMapSearchResult {
  const raw = value && typeof value === "object" ? (value as Record<string, unknown>) : {};

  return {
    id: readNumber(raw.id),
    mapName: readString(raw.mapName, "맵"),
    image: readNullableString(raw.image),
  };
}

function normalizeProleagueTeamSearchResult(
  value: unknown,
): HomeScheduleProleagueTeamSearchResult {
  const raw = value && typeof value === "object" ? (value as Record<string, unknown>) : {};

  return {
    teamId: readNumber(raw.teamId),
    teamName: readString(raw.teamName, "팀"),
    leagueId: readNumber(raw.leagueId),
    leagueName: readString(raw.leagueName, "프로리그"),
    seasonName: readNullableString(raw.seasonName),
  };
}

function normalizeAdminHomeSchedule(value: unknown): AdminHomeSchedule {
  const raw = value && typeof value === "object" ? (value as Record<string, unknown>) : {};

  return {
    id: readNumber(raw.id),
    scheduleGroup: readGroup(raw.scheduleGroup),
    title: readString(raw.title, "일정"),
    description: readNullableString(raw.description),
    scheduledAt: readString(raw.scheduledAt),
    targetUrl: readNullableString(raw.targetUrl),
    linkType: readLinkType(raw.linkType),
    displayPriority: readNumber(raw.displayPriority),
    status: readStatus(raw.status),
    regDate: readString(raw.regDate),
    updateDate: readString(raw.updateDate),
    matches: readArray(raw.matches).map((item) => normalizeMatch(item)),
  };
}

function normalizeAdminHomeSchedulePage(value: unknown): AdminHomeSchedulePage {
  const raw = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const items = Array.isArray(raw.items) ? raw.items : [];

  return {
    items: items.map((item) => normalizeAdminHomeSchedule(item)),
    page: readNumber(raw.page),
    size: readNumber(raw.size, 20),
    totalElements: readNumber(raw.totalElements),
    totalPages: readNumber(raw.totalPages),
    hasNext: readBoolean(raw.hasNext),
    hasPrevious: readBoolean(raw.hasPrevious),
  };
}

function normalizeHomeSchedule(value: unknown): HomeSchedule {
  const raw = value && typeof value === "object" ? (value as Record<string, unknown>) : {};

  return {
    id: readNumber(raw.id),
    scheduleGroup: readGroup(raw.scheduleGroup),
    timeLabel: readString(raw.timeLabel),
    title: readString(raw.title, "일정"),
    description: readNullableString(raw.description),
    scheduledAt: readString(raw.scheduledAt),
    targetUrl: readNullableString(raw.targetUrl),
    linkType: readLinkType(raw.linkType),
    navigationUrl: readNullableString(raw.navigationUrl),
    matches: readArray(raw.matches).map((item) => normalizeMatch(item)),
  };
}

function normalizeHomeSchedules(value: unknown): HomeSchedule[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((item) => normalizeHomeSchedule(item));
}

export async function listAdminHomeSchedules(
  params: AdminHomeScheduleListParams = {},
) {
  const keyword = params.keyword?.trim();
  const fromDate = params.fromDate?.trim();
  const toDate = params.toDate?.trim();

  const data = await unwrapResponse<AdminHomeSchedulePage>(
    apiClient.get<ApiEnvelope<AdminHomeSchedulePage> | AdminHomeSchedulePage>(
      "/admin/home/schedules",
      {
        params: {
          page: params.page ?? 0,
          size: params.size ?? 20,
          keyword: keyword || undefined,
          fromDate: fromDate || undefined,
          toDate: toDate || undefined,
          scheduleGroup: params.scheduleGroup || undefined,
        },
        validateStatus: () => true,
      },
    ),
    "일정 목록을 불러오지 못했습니다.",
  );

  return normalizeAdminHomeSchedulePage(data);
}

export async function createAdminHomeSchedule(
  payload: AdminHomeScheduleRequest,
) {
  const data = await unwrapResponse<AdminHomeSchedule>(
    apiClient.post<ApiEnvelope<AdminHomeSchedule> | AdminHomeSchedule>(
      "/admin/home/schedules",
      payload,
      {
        validateStatus: () => true,
      },
    ),
    "일정을 등록하지 못했습니다.",
  );

  return normalizeAdminHomeSchedule(data);
}

export async function updateAdminHomeSchedule(
  scheduleId: number,
  payload: AdminHomeScheduleRequest,
) {
  const data = await unwrapResponse<AdminHomeSchedule>(
    apiClient.put<ApiEnvelope<AdminHomeSchedule> | AdminHomeSchedule>(
      `/admin/home/schedules/${scheduleId}`,
      payload,
      {
        validateStatus: () => true,
      },
    ),
    "일정을 수정하지 못했습니다.",
  );

  return normalizeAdminHomeSchedule(data);
}

export async function deleteAdminHomeSchedules(scheduleIds: number[]) {
  return unwrapVoidResponse(
    apiClient.post<ApiEnvelope<null> | null>(
      "/admin/home/schedules/delete",
      { scheduleIds },
      {
        validateStatus: () => true,
      },
    ),
    "일정을 삭제하지 못했습니다.",
  );
}

export async function listHomeSchedules(limit = 3) {
  const data = await unwrapResponse<HomeSchedule[]>(
    apiClient.get<ApiEnvelope<HomeSchedule[]> | HomeSchedule[]>("/home/schedules", {
      params: { limit },
      skipAuth: true,
      skipUnauthorizedHandler: true,
      validateStatus: () => true,
    }),
    "일정을 불러오지 못했습니다.",
  );

  return normalizeHomeSchedules(data);
}

export async function searchHomeScheduleUsers(keyword: string, limit = 8) {
  const data = await unwrapResponse<HomeScheduleUserSearchResult[]>(
    apiClient.get<ApiEnvelope<HomeScheduleUserSearchResult[]> | HomeScheduleUserSearchResult[]>(
      "/user/draft-search",
      {
        params: { keyword, limit },
        validateStatus: () => true,
      },
    ),
    "사용자 검색 결과를 불러오지 못했습니다.",
  );

  return readArray(data).map((item) => normalizeUserSearchResult(item));
}

export async function searchHomeScheduleMaps(keyword: string, limit = 8) {
  const data = await unwrapResponse<HomeScheduleMapSearchResult[]>(
    apiClient.get<
      ApiEnvelope<HomeScheduleMapSearchResult[]> | HomeScheduleMapSearchResult[]
    >("/admin/home/schedules/maps/search", {
      params: { keyword, limit },
      validateStatus: () => true,
    }),
    "맵 검색 결과를 불러오지 못했습니다.",
  );

  return readArray(data).map((item) => normalizeMapSearchResult(item));
}

export async function searchLiveProleagueTeams(keyword: string, limit = 8) {
  const data = await unwrapResponse<HomeScheduleProleagueTeamSearchResult[]>(
    apiClient.get<
      | ApiEnvelope<HomeScheduleProleagueTeamSearchResult[]>
      | HomeScheduleProleagueTeamSearchResult[]
    >("/admin/home/schedules/proleague-teams/search", {
      params: { keyword, limit },
      validateStatus: () => true,
    }),
    "프로리그 팀 검색 결과를 불러오지 못했습니다.",
  );

  return readArray(data).map((item) => normalizeProleagueTeamSearchResult(item));
}
