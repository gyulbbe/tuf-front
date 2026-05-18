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

export type PersonalLeagueBracketType = "SINGLE_ELIMINATION" | "DUAL_GROUP";

export type PersonalLeagueBestOf = number;

export type AdminPersonalLeaguePlayerRequest = {
  userId: string;
};

export type AdminPersonalLeagueTournamentRequest = {
  bracketType: PersonalLeagueBracketType;
  bestOf: PersonalLeagueBestOf;
};

export type AdminPersonalLeagueCreateRequest = {
  leagueName: string;
  seasonName: string;
  description: string;
  status: "READY" | "LIVE" | "FINISHED";
  leagueType: "PERSONAL";
  startDate: string | null;
  endDate: string | null;
  createTournament: boolean;
  players: AdminPersonalLeaguePlayerRequest[];
  tournament?: AdminPersonalLeagueTournamentRequest | null;
};

export type AdminPersonalLeagueUpdateRequest = AdminPersonalLeagueCreateRequest;

export type AdminPersonalLeaguePlayer = {
  userId: string | null;
  race: string | null;
  status: string | null;
};

export type AdminPersonalLeagueDetail = {
  id: number;
  leagueName: string;
  seasonName: string;
  description: string | null;
  status: "READY" | "LIVE" | "FINISHED";
  leagueType: string;
  startDate: string | null;
  endDate: string | null;
  tournamentId: number | null;
  tournamentBracketType: PersonalLeagueBracketType | null;
  tournamentBestOf: PersonalLeagueBestOf | null;
  canEditTournament: boolean;
  players: AdminPersonalLeaguePlayer[];
  regDate: string | null;
  updateDate: string | null;
};

const BRACKET_TYPES = new Set<PersonalLeagueBracketType>([
  "SINGLE_ELIMINATION",
  "DUAL_GROUP",
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

function readRequestErrorMessage(
  data: unknown,
  fallback: string,
  responseStatus: number,
) {
  if (responseStatus === 401 || responseStatus === 403) {
    return "관리자 권한이 필요합니다.";
  }

  return readErrorMessage(data, fallback);
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
    const message = readRequestErrorMessage(
      response.data,
      fallback,
      responseStatus,
    );

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
      const responseStatus = readResponseStatus(
        error.response?.data,
        error.response?.status ?? 0,
      );

      throw new Error(
        readRequestErrorMessage(
          error.response?.data,
          error.message || fallback,
          responseStatus,
        ),
      );
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

function readNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function readBoolean(value: unknown) {
  return typeof value === "boolean" ? value : false;
}

function readBracketType(value: unknown): PersonalLeagueBracketType | null {
  return typeof value === "string" &&
    BRACKET_TYPES.has(value as PersonalLeagueBracketType)
    ? (value as PersonalLeagueBracketType)
    : null;
}

function readBestOf(value: unknown): PersonalLeagueBestOf | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function normalizePlayer(value: unknown): AdminPersonalLeaguePlayer {
  const raw = value && typeof value === "object" ? (value as Record<string, unknown>) : {};

  return {
    userId: readNullableString(raw.userId),
    race: readNullableString(raw.race),
    status: readNullableString(raw.status),
  };
}

function normalizePersonalLeague(value: unknown): AdminPersonalLeagueDetail {
  const raw = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const id = readNumber(raw.id);

  if (id === null) {
    throw new Error("개인리그 응답을 확인하지 못했습니다.");
  }

  return {
    id,
    leagueName: readString(raw.leagueName, "개인리그"),
    seasonName: readString(raw.seasonName, ""),
    description: readNullableString(raw.description),
    status: readString(raw.status, "READY") as AdminPersonalLeagueDetail["status"],
    leagueType: readString(raw.leagueType, "PERSONAL"),
    startDate: readNullableString(raw.startDate),
    endDate: readNullableString(raw.endDate),
    tournamentId: readNumber(raw.tournamentId),
    tournamentBracketType: readBracketType(raw.tournamentBracketType),
    tournamentBestOf: readBestOf(raw.tournamentBestOf),
    canEditTournament: readBoolean(raw.canEditTournament),
    players: Array.isArray(raw.players) ? raw.players.map(normalizePlayer) : [],
    regDate: readNullableString(raw.regDate),
    updateDate: readNullableString(raw.updateDate),
  };
}

export async function createAdminPersonalLeague(
  payload: AdminPersonalLeagueCreateRequest,
) {
  const data = await unwrapResponse<AdminPersonalLeagueDetail>(
    apiClient.post<ApiEnvelope<AdminPersonalLeagueDetail> | AdminPersonalLeagueDetail>(
      "/admin/personal-leagues",
      payload,
      {
        validateStatus: () => true,
      },
    ),
    "개인리그 등록에 실패했습니다.",
  );

  return normalizePersonalLeague(data);
}

export async function getAdminPersonalLeague(personalLeagueId: number) {
  const data = await unwrapResponse<AdminPersonalLeagueDetail>(
    apiClient.get<ApiEnvelope<AdminPersonalLeagueDetail> | AdminPersonalLeagueDetail>(
      `/admin/personal-leagues/${personalLeagueId}`,
      {
        validateStatus: () => true,
      },
    ),
    "개인리그 정보를 불러오지 못했습니다.",
  );

  return normalizePersonalLeague(data);
}

export async function updateAdminPersonalLeague(
  personalLeagueId: number,
  payload: AdminPersonalLeagueUpdateRequest,
) {
  const data = await unwrapResponse<AdminPersonalLeagueDetail>(
    apiClient.put<ApiEnvelope<AdminPersonalLeagueDetail> | AdminPersonalLeagueDetail>(
      `/admin/personal-leagues/${personalLeagueId}`,
      payload,
      {
        validateStatus: () => true,
      },
    ),
    "개인리그 정보를 수정하지 못했습니다.",
  );

  return normalizePersonalLeague(data);
}
