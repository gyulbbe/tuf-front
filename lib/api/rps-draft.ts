import axios from "axios";
import { apiClient } from "@/lib/api/client";
import type { DraftUserSearchResult } from "@/lib/api/draft-users";

type ApiEnvelope<T> = {
  status?: number;
  message?: string;
  data?: T | null;
};

type ErrorResponseBody = {
  message?: string;
  error?: string;
};

export type RpsDraftStatus = "READY" | "RPS_PENDING" | "PICKING" | "FINISHED";
export type RpsChoice = "ROCK" | "PAPER" | "SCISSORS";
export type RpsRoundResult = "PENDING" | "TEAM1_WIN" | "TEAM2_WIN";
export type RpsLiveRoundResult = "DRAW" | "TEAM1_WIN" | "TEAM2_WIN";
export type RpsDraftMyRole = "VIEWER" | "OWNER" | "PICKER" | "OWNER_PICKER";

export type RpsDraftSessionSummary = {
  id: number;
  title: string;
  ownerUserId: number;
  ownerUserLoginId: string;
  ownerName: string | null;
  status: RpsDraftStatus | string;
  currentPickNo: number | null;
  currentDraftTeamId: number | null;
  pendingDraftTeamId: number | null;
  startedAt: string | null;
  endedAt: string | null;
};

export type RpsDraftTeam = {
  id: number;
  rpsDraftSessionId: number;
  teamName: string;
  displayOrder: 1 | 2 | number;
  pickerUserId: number | null;
  pickerUserLoginId: string | null;
  pickerName: string | null;
};

export type RpsDraftSessionDetail = {
  id: number;
  title: string;
  ownerUserId: number;
  ownerUserLoginId: string;
  ownerName: string | null;
  status: RpsDraftStatus | string;
  currentPickNo: number | null;
  currentDraftTeamId: number | null;
  pendingDraftTeamId: number | null;
  startedAt: string | null;
  endedAt: string | null;
  teams: RpsDraftTeam[];
  candidates: RpsDraftCandidate[];
};

export type RpsDraftCandidate = {
  rpsDraftSessionId: number;
  candidateUserId: number;
  candidateUserLoginId: string;
  candidateName: string;
  tier?: string | null;
  race: string | null;
  status: "WAITING" | "PICKED" | "EXCLUDED" | string;
  pickedRpsDraftTeamId: number | null;
  pickedRpsDraftTeamName: string | null;
  pickedAt: string | null;
};

export type RpsDraftRosterItem = {
  pickNo: number;
  candidateUserId: number;
  candidateUserLoginId: string;
  candidateName: string;
  tier?: string | null;
  race?: string | null;
  pickedByUserId: number;
  pickedByUserLoginId?: string | null;
  pickedByUserName: string | null;
  pickedAt: string | null;
};

export type RpsDraftLiveTeam = RpsDraftTeam & {
  roster: RpsDraftRosterItem[];
};

export type RpsDraftPick = {
  rpsDraftSessionId: number;
  pickNo: number;
  rpsDraftTeamId: number;
  rpsDraftTeamName: string;
  candidateUserId: number;
  candidateUserLoginId: string;
  candidateName: string;
  tier?: string | null;
  race?: string | null;
  pickedByUserId: number;
  pickedByUserLoginId?: string | null;
  pickedByUserName: string | null;
  pickedAt: string | null;
};

export type RpsDraftLiveSessionInfo = {
  id: number;
  title: string;
  ownerUserId: number;
  ownerUserLoginId: string;
  ownerName: string | null;
  status: RpsDraftStatus | string;
  currentPickNo: number | null;
  currentDraftTeamId: number | null;
  pendingDraftTeamId: number | null;
  startedAt: string | null;
  endedAt: string | null;
  serverNow: string | null;
};

export type RpsDraftLiveRpsState = {
  team1Submitted: boolean;
  team2Submitted: boolean;
  team1Choice: RpsChoice | null;
  team2Choice: RpsChoice | null;
  result: RpsRoundResult | string;
};

export type RpsDraftLivePermissions = {
  canControl: boolean;
  canSubmitRps: boolean;
  canPick: boolean;
  myTeamId: number | null;
  myRole: RpsDraftMyRole | string | null;
};

export type RpsDraftLiveSnapshot = {
  session: RpsDraftLiveSessionInfo;
  rps: RpsDraftLiveRpsState;
  teams: RpsDraftLiveTeam[];
  availableCandidates: RpsDraftCandidate[];
  pickedCandidates: RpsDraftCandidate[];
  recentPicks: RpsDraftPick[];
  permissions: RpsDraftLivePermissions | null;
};

export type RpsDraftLiveEventType =
  | "SESSION_STARTED"
  | "RPS_SUBMITTED"
  | "RPS_RESOLVED"
  | "TURN_CHANGED"
  | "PICK_COMPLETED"
  | "SESSION_FINISHED";

export type RpsDraftLiveEvent = {
  type: RpsDraftLiveEventType | string;
  sessionId: number;
  occurredAt: string | null;
  serverNow: string | null;
  actorUserId: number | null;
  message: string | null;
  roundResult: RpsLiveRoundResult | null;
  snapshot: RpsDraftLiveSnapshot | null;
};

export type RpsDraftSessionCreateRequest = {
  title: string;
  team1PickerUserId: number;
  team2PickerUserId: number;
  candidateUserIds: number[];
};

export type RpsDraftPickerAssignRequest = {
  pickerUserId: number;
};

export type RpsDraftCandidateRequest = {
  candidateUserId: number;
  race?: string;
};

export type RpsDraftRpsSubmitRequest = {
  choice: RpsChoice;
};

export type RpsDraftPickRequest = {
  candidateUserId: number;
};

export type RpsDraftUserSearchResult = DraftUserSearchResult;

export type RpsDraftApiErrorInfo = {
  fallback: string;
  httpStatus: number | null;
  method: string | null;
  params: unknown;
  requestData: unknown;
  responseData: unknown;
  responseMessage: string | null;
  responseStatus: number | null;
  url: string | null;
};

export class RpsDraftApiError extends Error {
  info: RpsDraftApiErrorInfo;

  constructor(message: string, info: RpsDraftApiErrorInfo) {
    super(message);
    this.name = "RpsDraftApiError";
    this.info = info;
  }
}

export function isRpsDraftApiError(error: unknown): error is RpsDraftApiError {
  return error instanceof RpsDraftApiError;
}

function readArray<T>(value: unknown, fallback: T[] = []) {
  return Array.isArray(value) ? (value as T[]) : fallback;
}

function sortTeams<T extends { displayOrder: number }>(teams: T[]) {
  return [...teams].sort((left, right) => left.displayOrder - right.displayOrder);
}

function normalizeTeam(team: RpsDraftTeam | RpsDraftLiveTeam): RpsDraftLiveTeam {
  return {
    ...team,
    pickerUserId:
      typeof team.pickerUserId === "number" ? team.pickerUserId : null,
    pickerUserLoginId:
      typeof team.pickerUserLoginId === "string" &&
      team.pickerUserLoginId.trim()
        ? team.pickerUserLoginId
        : null,
    pickerName:
      typeof team.pickerName === "string" && team.pickerName.trim()
        ? team.pickerName
        : null,
    roster: readArray<RpsDraftRosterItem>((team as RpsDraftLiveTeam).roster),
  };
}

function normalizeSessionDetail(
  detail: RpsDraftSessionDetail,
): RpsDraftSessionDetail {
  return {
    ...detail,
    ownerName:
      typeof detail.ownerName === "string" && detail.ownerName.trim()
        ? detail.ownerName
        : null,
    candidates: readArray<RpsDraftCandidate>(detail.candidates),
    teams: sortTeams(readArray<RpsDraftTeam>(detail.teams)).map((team) => ({
      ...normalizeTeam(team),
      roster: [],
    })),
  };
}

function normalizeSnapshot(snapshot: RpsDraftLiveSnapshot): RpsDraftLiveSnapshot {
  return {
    ...snapshot,
    teams: sortTeams(readArray<RpsDraftLiveTeam>(snapshot.teams)).map((team) =>
      normalizeTeam(team),
    ),
    availableCandidates: readArray<RpsDraftCandidate>(snapshot.availableCandidates),
    pickedCandidates: readArray<RpsDraftCandidate>(snapshot.pickedCandidates),
    recentPicks: readArray<RpsDraftPick>(snapshot.recentPicks),
    permissions: snapshot.permissions ?? null,
  };
}

function parseRequestData(value: unknown) {
  if (typeof value !== "string") {
    return value ?? null;
  }

  if (!value.trim()) {
    return null;
  }

  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

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

function createRpsDraftApiError(
  fallback: string,
  options: {
    config?: {
      data?: unknown;
      method?: string;
      params?: unknown;
      url?: string;
    } | null;
    httpStatus?: number | null;
    message?: string | null;
    responseData?: unknown;
    responseStatus?: number | null;
  },
) {
  const responseMessage =
    typeof options.message === "string" && options.message.trim()
      ? options.message
      : fallback;

  return new RpsDraftApiError(responseMessage, {
    fallback,
    httpStatus:
      typeof options.httpStatus === "number" ? options.httpStatus : null,
    method: options.config?.method?.toUpperCase() ?? null,
    params: options.config?.params ?? null,
    requestData: parseRequestData(options.config?.data),
    responseData: options.responseData ?? null,
    responseMessage,
    responseStatus:
      typeof options.responseStatus === "number" ? options.responseStatus : null,
    url: options.config?.url ?? null,
  });
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
      throw createRpsDraftApiError(fallback, {
        config: response.config,
        httpStatus: response.status,
        message: responseMessage,
        responseData: response.data,
        responseStatus,
      });
    }

    if (responseStatus !== 200 || body.data === null || body.data === undefined) {
      throw createRpsDraftApiError(fallback, {
        config: response.config,
        httpStatus: response.status,
        message: responseMessage,
        responseData: response.data,
        responseStatus,
      });
    }

    return body.data;
  } catch (error) {
    if (isRpsDraftApiError(error)) {
      throw error;
    }

    if (axios.isAxiosError(error)) {
      throw createRpsDraftApiError(fallback, {
        config: error.config,
        httpStatus: error.response?.status ?? null,
        message: readErrorMessage(error.response?.data, error.message || fallback),
        responseData: error.response?.data ?? null,
        responseStatus:
          typeof error.response?.data?.status === "number"
            ? error.response.data.status
            : null,
      });
    }

    if (error instanceof Error) {
      throw createRpsDraftApiError(fallback, {
        message: error.message,
      });
    }

    throw createRpsDraftApiError(fallback, {});
  }
}

async function unwrapVoidResponse(
  request: Promise<{
    config?: {
      data?: unknown;
      method?: string;
      params?: unknown;
      url?: string;
    };
    status: number;
    data: ApiEnvelope<null> | ErrorResponseBody;
  }>,
  fallback: string,
) {
  try {
    const response = await request;
    const body = response.data as ApiEnvelope<null>;
    const responseStatus =
      typeof body.status === "number" ? body.status ?? null : response.status;
    const normalizedResponseStatus = responseStatus ?? response.status;
    const responseMessage = readErrorMessage(response.data, fallback);

    if (response.status < 200 || response.status >= 300) {
      throw createRpsDraftApiError(fallback, {
        config: response.config,
        httpStatus: response.status,
        message: responseMessage,
        responseData: response.data,
        responseStatus: normalizedResponseStatus,
      });
    }

    if (normalizedResponseStatus !== 200) {
      throw createRpsDraftApiError(fallback, {
        config: response.config,
        httpStatus: response.status,
        message: responseMessage,
        responseData: response.data,
        responseStatus: normalizedResponseStatus,
      });
    }
  } catch (error) {
    if (isRpsDraftApiError(error)) {
      throw error;
    }

    if (axios.isAxiosError(error)) {
      throw createRpsDraftApiError(fallback, {
        config: error.config,
        httpStatus: error.response?.status ?? null,
        message: readErrorMessage(error.response?.data, error.message || fallback),
        responseData: error.response?.data ?? null,
        responseStatus:
          typeof error.response?.data?.status === "number"
            ? error.response.data.status
            : null,
      });
    }

    if (error instanceof Error) {
      throw createRpsDraftApiError(fallback, {
        message: error.message,
      });
    }

    throw createRpsDraftApiError(fallback, {});
  }
}

export async function listRpsDraftSessions() {
  return unwrapResponse(
    apiClient.get<ApiEnvelope<RpsDraftSessionSummary[]>>("/rps-drafts/sessions", {
      validateStatus: () => true,
    }),
    "가위바위보 드래프트 세션 목록을 불러오지 못했습니다.",
  );
}

export async function createRpsDraftSession(
  payload: RpsDraftSessionCreateRequest,
) {
  const detail = await unwrapResponse(
    apiClient.post<ApiEnvelope<RpsDraftSessionDetail>>(
      "/rps-drafts/sessions",
      payload,
      {
        validateStatus: () => true,
      },
    ),
    "가위바위보 드래프트 세션을 생성하지 못했습니다.",
  );

  return normalizeSessionDetail(detail);
}

export async function getRpsDraftSession(sessionId: number) {
  const detail = await unwrapResponse(
    apiClient.get<ApiEnvelope<RpsDraftSessionDetail>>(
      `/rps-drafts/sessions/${sessionId}`,
      {
        validateStatus: () => true,
      },
    ),
    "가위바위보 드래프트 세션 정보를 불러오지 못했습니다.",
  );

  return normalizeSessionDetail(detail);
}

export async function deleteRpsDraftSession(sessionId: number) {
  return unwrapVoidResponse(
    apiClient.delete<ApiEnvelope<null>>(`/rps-drafts/sessions/${sessionId}`, {
      validateStatus: () => true,
    }),
    "가위바위보 드래프트를 삭제하지 못했습니다.",
  );
}

export async function assignRpsDraftPicker(
  sessionId: number,
  teamId: number,
  payload: RpsDraftPickerAssignRequest,
) {
  const detail = await unwrapResponse(
    apiClient.post<ApiEnvelope<RpsDraftSessionDetail>>(
      `/rps-drafts/sessions/${sessionId}/teams/${teamId}/picker`,
      payload,
      {
        validateStatus: () => true,
      },
    ),
    "드래프트 진행자를 지정하지 못했습니다.",
  );

  return normalizeSessionDetail(detail);
}

export async function registerRpsDraftCandidate(
  sessionId: number,
  candidateUserId: number,
) {
  const payload: RpsDraftCandidateRequest = { candidateUserId };

  const detail = await unwrapResponse(
    apiClient.post<ApiEnvelope<RpsDraftSessionDetail>>(
      `/rps-drafts/sessions/${sessionId}/candidates`,
      payload,
      {
        validateStatus: () => true,
      },
    ),
    "후보를 등록하지 못했습니다.",
  );

  return normalizeSessionDetail(detail);
}

export async function getRpsDraftSnapshot(sessionId: number) {
  const snapshot = await unwrapResponse(
    apiClient.get<ApiEnvelope<RpsDraftLiveSnapshot>>(
      `/rps-drafts/live/sessions/${sessionId}/snapshot`,
      {
        validateStatus: () => true,
      },
    ),
    "라이브 스냅샷을 불러오지 못했습니다.",
  );

  return normalizeSnapshot(snapshot);
}

export async function startRpsDraftSession(sessionId: number) {
  const snapshot = await unwrapResponse(
    apiClient.post<ApiEnvelope<RpsDraftLiveSnapshot>>(
      `/rps-drafts/live/sessions/${sessionId}/start`,
      {},
      {
        validateStatus: () => true,
      },
    ),
    "세션을 시작하지 못했습니다.",
  );

  return normalizeSnapshot(snapshot);
}

export async function submitRpsDraftChoice(
  sessionId: number,
  payload: RpsDraftRpsSubmitRequest,
) {
  const snapshot = await unwrapResponse(
    apiClient.post<ApiEnvelope<RpsDraftLiveSnapshot>>(
      `/rps-drafts/live/sessions/${sessionId}/rps/submit`,
      payload,
      {
        validateStatus: () => true,
      },
    ),
    "가위바위보를 제출하지 못했습니다.",
  );

  return normalizeSnapshot(snapshot);
}

export async function pickRpsDraftCandidate(
  sessionId: number,
  payload: RpsDraftPickRequest,
) {
  const snapshot = await unwrapResponse(
    apiClient.post<ApiEnvelope<RpsDraftLiveSnapshot>>(
      `/rps-drafts/live/sessions/${sessionId}/pick`,
      payload,
      {
        validateStatus: () => true,
      },
    ),
    "후보를 지명하지 못했습니다.",
  );

  return normalizeSnapshot(snapshot);
}

export function buildRpsDraftWebSocketUrl() {
  const baseUrl =
    process.env.NEXT_PUBLIC_API_BASE_URL ??
    (typeof window !== "undefined"
      ? window.location.origin
      : "http://localhost:8080");
  const url = new URL(baseUrl);

  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.pathname = `${url.pathname.replace(/\/$/, "")}/ws`;
  url.search = "";
  url.hash = "";

  return url.toString();
}
