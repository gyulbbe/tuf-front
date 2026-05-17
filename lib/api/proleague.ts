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

export type AdminProleagueStatus = "READY" | "LIVE" | "FINISHED" | "CANCELLED";

export type AdminProleagueDraftOrderMode = "BASIC" | "SNAKE";

export type AdminProleagueDraftTeamRequest = {
  teamName: string;
  leaderUserId: string;
  viceLeaderUserId: string;
  displayOrder: number;
};

export type AdminProleagueDraftCandidateRequest = {
  userId: string;
};

export type AdminProleagueDraftCreateRequest = {
  teamCount: number;
  pickTimeSeconds: number;
  orderMode: AdminProleagueDraftOrderMode;
  teams: AdminProleagueDraftTeamRequest[];
  candidates: AdminProleagueDraftCandidateRequest[];
};

export type AdminProleagueCreateRequest = {
  leagueName: string;
  seasonName: string;
  description: string;
  status: "READY";
  startDate: string;
  endDate: string;
  createDraft: boolean;
  draft?: AdminProleagueDraftCreateRequest | null;
};

export type AdminProleagueUpdateRequest = AdminProleagueCreateRequest;

export type AdminProleagueDetail = {
  id: number;
  leagueName: string;
  seasonName: string;
  description: string | null;
  status: AdminProleagueStatus;
  startDate: string | null;
  endDate: string | null;
  draftSessionId: number | null;
  draftStatus: string | null;
  canEditDraft: boolean;
  teams: unknown[];
  candidates: unknown[];
  regDate: string | null;
  updateDate: string | null;
};

export type ProleagueHistorySummary = {
  id: number;
  leagueName: string;
  seasonName: string;
  status: AdminProleagueStatus;
  teamCount: number;
  participantCount: number;
  championTeamName: string | null;
  runnerUpTeamName: string | null;
  startDate: string | null;
  endDate: string | null;
  draftSessionId: number | null;
  draftStatus: string | null;
};

export type ProleagueHistoryTeam = {
  teamId: number | null;
  teamName: string;
  leaderUserId: string | null;
  viceLeaderUserId: string | null;
};

export type ProleagueHistoryDetail = ProleagueHistorySummary & {
  description: string | null;
  teams: ProleagueHistoryTeam[];
};

export type ProleagueHistoryPage = {
  items: ProleagueHistorySummary[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
};

const PROLEAGUE_STATUSES = new Set<AdminProleagueStatus>([
  "READY",
  "LIVE",
  "FINISHED",
  "CANCELLED",
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

function isAccessDeniedStatus(status: number) {
  return status === 401 || status === 403;
}

function readRequestErrorMessage(
  data: unknown,
  fallback: string,
  responseStatus: number,
) {
  if (isAccessDeniedStatus(responseStatus)) {
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
    const message = readRequestErrorMessage(
      response.data,
      fallback,
      responseStatus,
    );

    if (response.status < 200 || response.status >= 300 || responseStatus >= 400) {
      throw new Error(message);
    }
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

function readNumberWithFallback(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function readBoolean(value: unknown) {
  return typeof value === "boolean" ? value : false;
}

function readStatus(value: unknown): AdminProleagueStatus {
  return typeof value === "string" &&
    PROLEAGUE_STATUSES.has(value as AdminProleagueStatus)
    ? (value as AdminProleagueStatus)
    : "READY";
}

function normalizeAdminProleague(value: unknown): AdminProleagueDetail {
  const raw = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const id = readNumber(raw.id);

  if (id === null) {
    throw new Error("프로리그 응답을 확인하지 못했습니다.");
  }

  return {
    id,
    leagueName: readString(raw.leagueName, "프로리그"),
    seasonName: readString(raw.seasonName, "시즌"),
    description: readNullableString(raw.description),
    status: readStatus(raw.status),
    startDate: readNullableString(raw.startDate),
    endDate: readNullableString(raw.endDate),
    draftSessionId: readNumber(raw.draftSessionId),
    draftStatus: readNullableString(raw.draftStatus),
    canEditDraft: readBoolean(raw.canEditDraft),
    teams: Array.isArray(raw.teams) ? raw.teams : [],
    candidates: Array.isArray(raw.candidates) ? raw.candidates : [],
    regDate: readNullableString(raw.regDate),
    updateDate: readNullableString(raw.updateDate),
  };
}

function normalizeHistoryTeam(value: unknown): ProleagueHistoryTeam {
  const raw = value && typeof value === "object" ? (value as Record<string, unknown>) : {};

  return {
    teamId: readNumber(raw.teamId),
    teamName: readString(raw.teamName, "-"),
    leaderUserId: readNullableString(raw.leaderUserId),
    viceLeaderUserId: readNullableString(raw.viceLeaderUserId),
  };
}

function normalizeHistorySummary(value: unknown): ProleagueHistorySummary {
  const raw = value && typeof value === "object" ? (value as Record<string, unknown>) : {};

  return {
    id: readNumberWithFallback(raw.id, 0),
    leagueName: readString(raw.leagueName, "프로리그"),
    seasonName: readString(raw.seasonName, "시즌"),
    status: readStatus(raw.status),
    teamCount: readNumberWithFallback(raw.teamCount, 0),
    participantCount: readNumberWithFallback(raw.participantCount, 0),
    championTeamName: readNullableString(raw.championTeamName),
    runnerUpTeamName: readNullableString(raw.runnerUpTeamName),
    startDate: readNullableString(raw.startDate),
    endDate: readNullableString(raw.endDate),
    draftSessionId: readNumber(raw.draftSessionId),
    draftStatus: readNullableString(raw.draftStatus),
  };
}

function normalizeHistoryDetail(value: unknown): ProleagueHistoryDetail {
  const raw = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const summary = normalizeHistorySummary(raw);

  return {
    ...summary,
    description: readNullableString(raw.description),
    teams: Array.isArray(raw.teams) ? raw.teams.map(normalizeHistoryTeam) : [],
  };
}

function normalizeHistoryPage(value: unknown): ProleagueHistoryPage {
  const raw = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const items = Array.isArray(raw.items) ? raw.items.map(normalizeHistorySummary) : [];

  return {
    items,
    page: readNumberWithFallback(raw.page, 0),
    size: readNumberWithFallback(raw.size, items.length),
    totalElements: readNumberWithFallback(raw.totalElements, items.length),
    totalPages: readNumberWithFallback(raw.totalPages, items.length > 0 ? 1 : 0),
    hasNext: readBoolean(raw.hasNext),
    hasPrevious: readBoolean(raw.hasPrevious),
  };
}

export async function createAdminProleague(payload: AdminProleagueCreateRequest) {
  const data = await unwrapResponse<AdminProleagueDetail>(
    apiClient.post<ApiEnvelope<AdminProleagueDetail> | AdminProleagueDetail>(
      "/admin/proleagues",
      payload,
      {
        validateStatus: () => true,
      },
    ),
    "프로리그 등록에 실패했습니다.",
  );

  return normalizeAdminProleague(data);
}

export async function listProleagueHistory(params?: {
  fromDate?: string;
  keyword?: string;
  page?: number;
  size?: number;
  toDate?: string;
}) {
  const keyword = params?.keyword?.trim();
  const fromDate = params?.fromDate?.trim();
  const toDate = params?.toDate?.trim();
  const page = params?.page ?? 0;
  const size = params?.size ?? 10;
  const data = await unwrapResponse<ProleagueHistoryPage>(
    apiClient.get<ApiEnvelope<ProleagueHistoryPage> | ProleagueHistoryPage>(
      "/admin/proleagues/history",
      {
        params: {
          page,
          size,
          ...(keyword ? { keyword } : {}),
          ...(fromDate ? { fromDate } : {}),
          ...(toDate ? { toDate } : {}),
        },
        validateStatus: () => true,
      },
    ),
    "프로리그 이력을 불러오지 못했습니다.",
  );

  return normalizeHistoryPage(data);
}

export async function getProleagueHistoryDetail(leagueId: number) {
  const data = await unwrapResponse<ProleagueHistoryDetail>(
    apiClient.get<ApiEnvelope<ProleagueHistoryDetail> | ProleagueHistoryDetail>(
      `/admin/proleagues/history/${leagueId}`,
      {
        validateStatus: () => true,
      },
    ),
    "프로리그 상세를 불러오지 못했습니다.",
  );

  return normalizeHistoryDetail(data);
}

export async function deleteProleagueHistories(leagueIds: number[]) {
  return unwrapVoidResponse(
    apiClient.post<ApiEnvelope<null>>(
      "/admin/proleagues/history/delete",
      { leagueIds },
      {
        validateStatus: () => true,
      },
    ),
    "프로리그 이력 삭제에 실패했습니다.",
  );
}

export async function getAdminProleague(proleagueId: number) {
  const data = await unwrapResponse<AdminProleagueDetail>(
    apiClient.get<ApiEnvelope<AdminProleagueDetail> | AdminProleagueDetail>(
      `/admin/proleagues/${proleagueId}`,
      {
        validateStatus: () => true,
      },
    ),
    "프로리그 정보를 불러오지 못했습니다.",
  );

  return normalizeAdminProleague(data);
}

export async function updateAdminProleague(
  proleagueId: number,
  payload: AdminProleagueUpdateRequest,
) {
  const data = await unwrapResponse<AdminProleagueDetail>(
    apiClient.put<ApiEnvelope<AdminProleagueDetail> | AdminProleagueDetail>(
      `/admin/proleagues/${proleagueId}`,
      payload,
      {
        validateStatus: () => true,
      },
    ),
    "프로리그 정보를 수정하지 못했습니다.",
  );

  return normalizeAdminProleague(data);
}
