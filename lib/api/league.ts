import axios from "axios";
import { apiClient } from "@/lib/api/client";
import type {
  AdminProleagueDraftCreateRequest,
  AdminProleagueTeam,
  AdminProleagueTeamRequest,
} from "@/lib/api/proleague";
import type {
  AdminPersonalLeaguePlayer,
  AdminPersonalLeaguePlayerRequest,
  AdminPersonalLeagueTournamentRequest,
} from "@/lib/api/personal-league";

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

export type AdminLeagueType =
  | "PROLEAGUE"
  | "PERSONAL"
  | "ULTIMATE_BATTLE"
  | "RACE_SURVIVAL";

export type AdminLeagueStatus = "LIVE" | "FINISHED";

export type AdminLeagueLinkedFilter = "ALL" | "LINKED" | "UNLINKED";

export type AdminLeagueRaceTeamRequest = {
  race: "TERRAN" | "ZERG" | "PROTOSS";
  players: AdminPersonalLeaguePlayerRequest[];
};

export type AdminLeagueRaceTeam = {
  race: "TERRAN" | "ZERG" | "PROTOSS";
  players: AdminPersonalLeaguePlayer[];
};

export type AdminLeagueRequest = {
  leagueName: string;
  seasonName: string;
  description: string;
  status: AdminLeagueStatus;
  leagueType: AdminLeagueType;
  startDate: string | null;
  endDate: string | null;
  createDraft?: boolean;
  teams?: AdminProleagueTeamRequest[];
  draft?: AdminProleagueDraftCreateRequest | null;
  createTournament?: boolean;
  players?: AdminPersonalLeaguePlayerRequest[];
  tournament?: AdminPersonalLeagueTournamentRequest | null;
  totalGames?: number | null;
  raceTeams?: AdminLeagueRaceTeamRequest[];
};

export type AdminLeagueDetail = {
  id: number;
  leagueName: string;
  seasonName: string;
  description: string | null;
  status: AdminLeagueStatus;
  leagueType: AdminLeagueType;
  startDate: string | null;
  endDate: string | null;
  draftSessionId: number | null;
  tournamentId: number | null;
  tournamentBracketType: string | null;
  tournamentBestOf: number | null;
  canEditTournament: boolean;
  teams: AdminProleagueTeam[];
  players: AdminPersonalLeaguePlayer[];
  raceTeams: AdminLeagueRaceTeam[];
  regDate: string | null;
  updateDate: string | null;
};

export type AdminLeagueSummary = {
  id: number;
  leagueName: string;
  seasonName: string;
  status: AdminLeagueStatus;
  leagueType: AdminLeagueType;
  startDate: string | null;
  endDate: string | null;
  draftSessionId: number | null;
  tournamentId: number | null;
  linkedType: string | null;
  linkedLabel: string | null;
  teamCount: number | null;
  participantCount: number;
  canDelete: boolean;
  deleteBlockedReason: string | null;
  updateDate: string | null;
};

export type AdminLeaguePage = {
  items: AdminLeagueSummary[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
};

export type AdminLeagueListParams = {
  leagueType?: AdminLeagueType;
  keyword?: string;
  status?: "ALL" | AdminLeagueStatus;
  linked?: AdminLeagueLinkedFilter;
  page?: number;
  size?: number;
};

function readObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function readString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function readNullableString(value: unknown) {
  return typeof value === "string" && value.trim() ? value : null;
}

function readNumberOrNull(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function readArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function readErrorMessage(data: unknown, fallback: string) {
  const body = readObject(data);
  return readString(body.message, readString(body.error, fallback));
}

async function unwrapResponse<T>(
  request: Promise<{ data: ApiEnvelope<T> | ErrorResponseBody | T; status: number }>,
  fallback: string,
) {
  try {
    const response = await request;
    const body = readObject(response.data);
    const status = typeof body.status === "number" ? body.status : response.status;
    if (status >= 400) {
      throw new Error(readErrorMessage(response.data, fallback));
    }
    if ("data" in body) {
      return body.data as T;
    }
    return response.data as T;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new Error(readErrorMessage(error.response?.data, fallback));
    }
    throw error;
  }
}

function normalizePlayer(value: unknown): AdminPersonalLeaguePlayer {
  const raw = readObject(value);
  return {
    userId: readNullableString(raw.userId),
    race: readNullableString(raw.race),
    status: readNullableString(raw.status),
  };
}

function normalizeRaceTeam(value: unknown): AdminLeagueRaceTeam {
  const raw = readObject(value);
  const race = readString(raw.race, "TERRAN") as AdminLeagueRaceTeam["race"];
  return {
    race,
    players: readArray(raw.players).map(normalizePlayer),
  };
}

function normalizeLeague(value: unknown): AdminLeagueDetail {
  const raw = readObject(value);
  return {
    id: readNumberOrNull(raw.id) ?? 0,
    leagueName: readString(raw.leagueName),
    seasonName: readString(raw.seasonName),
    description: readNullableString(raw.description),
    status: readString(raw.status, "LIVE") === "FINISHED" ? "FINISHED" : "LIVE",
    leagueType: readString(raw.leagueType, "PERSONAL") as AdminLeagueType,
    startDate: readNullableString(raw.startDate),
    endDate: readNullableString(raw.endDate),
    draftSessionId: readNumberOrNull(raw.draftSessionId),
    tournamentId: readNumberOrNull(raw.tournamentId),
    tournamentBracketType: readNullableString(raw.tournamentBracketType),
    tournamentBestOf: readNumberOrNull(raw.tournamentBestOf),
    canEditTournament: raw.canEditTournament !== false,
    teams: readArray(raw.teams) as AdminProleagueTeam[],
    players: readArray(raw.players).map(normalizePlayer),
    raceTeams: readArray(raw.raceTeams).map(normalizeRaceTeam),
    regDate: readNullableString(raw.regDate),
    updateDate: readNullableString(raw.updateDate),
  };
}

function normalizeLeagueSummary(value: unknown): AdminLeagueSummary {
  const raw = readObject(value);
  return {
    id: readNumberOrNull(raw.id) ?? 0,
    leagueName: readString(raw.leagueName),
    seasonName: readString(raw.seasonName),
    status: readString(raw.status, "LIVE") === "FINISHED" ? "FINISHED" : "LIVE",
    leagueType: readString(raw.leagueType, "PERSONAL") as AdminLeagueType,
    startDate: readNullableString(raw.startDate),
    endDate: readNullableString(raw.endDate),
    draftSessionId: readNumberOrNull(raw.draftSessionId),
    tournamentId: readNumberOrNull(raw.tournamentId),
    linkedType: readNullableString(raw.linkedType),
    linkedLabel: readNullableString(raw.linkedLabel),
    teamCount: readNumberOrNull(raw.teamCount),
    participantCount: readNumberOrNull(raw.participantCount) ?? 0,
    canDelete: raw.canDelete === true,
    deleteBlockedReason: readNullableString(raw.deleteBlockedReason),
    updateDate: readNullableString(raw.updateDate),
  };
}

function normalizeLeaguePage(value: unknown): AdminLeaguePage {
  const raw = readObject(value);
  return {
    items: readArray(raw.items).map(normalizeLeagueSummary),
    page: readNumberOrNull(raw.page) ?? 0,
    size: readNumberOrNull(raw.size) ?? 20,
    totalElements: readNumberOrNull(raw.totalElements) ?? 0,
    totalPages: readNumberOrNull(raw.totalPages) ?? 0,
    hasNext: raw.hasNext === true,
    hasPrevious: raw.hasPrevious === true,
  };
}

export async function listAdminLeagues(params: AdminLeagueListParams) {
  const data = await unwrapResponse<AdminLeaguePage>(
    apiClient.get<ApiEnvelope<AdminLeaguePage> | AdminLeaguePage>(
      "/admin/leagues",
      {
        params: {
          leagueType: params.leagueType,
          keyword: params.keyword || undefined,
          status: params.status && params.status !== "ALL" ? params.status : undefined,
          linked: params.linked && params.linked !== "ALL" ? params.linked : undefined,
          page: params.page ?? 0,
          size: params.size ?? 20,
        },
      },
    ),
    "리그 목록을 불러오지 못했습니다.",
  );
  return normalizeLeaguePage(data);
}

export async function createAdminLeague(payload: AdminLeagueRequest) {
  const data = await unwrapResponse<AdminLeagueDetail>(
    apiClient.post<ApiEnvelope<AdminLeagueDetail> | AdminLeagueDetail>(
      "/admin/leagues",
      payload,
    ),
    "리그를 등록하지 못했습니다.",
  );
  return normalizeLeague(data);
}

export async function finishAdminLeague(leagueId: number) {
  const data = await unwrapResponse<AdminLeagueSummary>(
    apiClient.patch<ApiEnvelope<AdminLeagueSummary> | AdminLeagueSummary>(
      `/admin/leagues/${leagueId}/finish`,
    ),
    "리그를 종료 처리하지 못했습니다.",
  );
  return normalizeLeagueSummary(data);
}

export async function deleteAdminLeague(leagueId: number) {
  await unwrapResponse<{ deletedCount?: number }>(
    apiClient.delete<ApiEnvelope<{ deletedCount?: number }> | { deletedCount?: number }>(
      `/admin/leagues/${leagueId}`,
    ),
    "리그를 삭제하지 못했습니다.",
  );
}

export async function getAdminLeague(leagueId: number) {
  const data = await unwrapResponse<AdminLeagueDetail>(
    apiClient.get<ApiEnvelope<AdminLeagueDetail> | AdminLeagueDetail>(
      `/admin/leagues/${leagueId}`,
    ),
    "리그 정보를 불러오지 못했습니다.",
  );
  return normalizeLeague(data);
}

export async function updateAdminLeague(leagueId: number, payload: AdminLeagueRequest) {
  const data = await unwrapResponse<AdminLeagueDetail>(
    apiClient.put<ApiEnvelope<AdminLeagueDetail> | AdminLeagueDetail>(
      `/admin/leagues/${leagueId}`,
      payload,
    ),
    "리그를 수정하지 못했습니다.",
  );
  return normalizeLeague(data);
}
