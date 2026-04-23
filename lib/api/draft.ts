import axios from "axios";
import { apiClient } from "@/lib/api/client";

type ApiEnvelope<T> = {
  status?: number;
  message?: string;
  data?: T | null;
};

type ErrorResponseBody = {
  message?: string;
  error?: string;
};

export type DraftSessionSummary = {
  id: number;
  title: string;
  ownerUserId: number;
  ownerName: string | null;
  status: string;
  teamCount: number;
  pickTimeSeconds: number;
  currentPickNo: number | null;
  currentDraftTeamId: number | null;
  deadlineAt: string | null;
  startedAt: string | null;
  endedAt: string | null;
};

export type DraftLiveRosterItem = {
  pickNo: number;
  roundNo: number;
  candidateUserId: number;
  candidateName: string;
  pickedByUserId: number;
  pickedByUserName: string;
  pickedAt: string | null;
};

export type DraftLiveTeam = {
  id: number;
  draftSessionId: number;
  teamName: string;
  displayOrder: number;
  pickerUserId?: number | null;
  pickerName?: string | null;
  roster: DraftLiveRosterItem[];
};

export type DraftCandidate = {
  draftSessionId: number;
  candidateUserId: number;
  candidateName: string;
  tier?: string | null;
  race: string | null;
  status: string;
  pickedDraftTeamId: number | null;
  pickedDraftTeamName: string | null;
  pickedAt: string | null;
};

export type DraftPick = {
  draftSessionId: number;
  roundNo: number;
  pickNo: number;
  draftTeamId: number;
  draftTeamName: string;
  candidateUserId: number;
  candidateName: string;
  pickedByUserId: number;
  pickedByUserName: string;
  pickedAt: string | null;
};

export type DraftOrder = {
  draftSessionId: number;
  roundNo: number;
  pickNo: number;
  draftTeamId: number;
  draftTeamName: string;
};

export type DraftLiveSessionInfo = {
  id: number;
  title: string;
  ownerUserId: number;
  ownerName: string | null;
  status: string;
  teamCount: number;
  pickTimeSeconds: number;
  currentPickNo: number | null;
  currentDraftTeamId: number | null;
  deadlineAt: string | null;
  startedAt: string | null;
  endedAt: string | null;
  serverNow: string | null;
};

export type DraftLiveCurrentTurn = {
  pickNo: number;
  roundNo: number;
  teamId: number;
  teamName: string;
  remainingSeconds: number;
};

export type DraftLivePermissions = {
  canControl: boolean;
  canPick: boolean;
  myTeamId: number | null;
  myRole: string | null;
};

export type DraftLivePreviewPhase = "START" | "MOVE" | "END";

export type DraftLivePreviewEndReason =
  | "RELEASED"
  | "CURSOR_LEFT"
  | "TURN_CHANGED"
  | "SESSION_PAUSED"
  | "SESSION_FINISHED"
  | "DISCONNECTED";

export type DraftLiveNormalizedPosition = {
  x: number;
  y: number;
};

export type DraftLivePreviewPayload = {
  candidateUserId: number;
  phase: DraftLivePreviewPhase;
  endReason?: DraftLivePreviewEndReason | null;
  cursorPosition: DraftLiveNormalizedPosition | null;
  cardPosition: DraftLiveNormalizedPosition | null;
};

export type DraftLiveSnapshot = {
  session: DraftLiveSessionInfo;
  currentTurn: DraftLiveCurrentTurn | null;
  teams: DraftLiveTeam[];
  availableCandidates: DraftCandidate[];
  pickedCandidates: DraftCandidate[];
  recentPicks: DraftPick[];
  permissions: DraftLivePermissions | null;
};

export type DraftLiveEvent = {
  type: string;
  sessionId: number;
  occurredAt: string | null;
  serverNow: string | null;
  actorUserId: number | null;
  message: string | null;
  snapshot: DraftLiveSnapshot | null;
  preview?: DraftLivePreviewPayload | null;
};

export type DraftSessionDetail = {
  id: number;
  title: string;
  ownerUserId: number;
  ownerName: string | null;
  status: string;
  teamCount: number;
  pickTimeSeconds: number;
  currentPickNo: number | null;
  currentDraftTeamId: number | null;
  deadlineAt: string | null;
  startedAt: string | null;
  endedAt: string | null;
  teams: DraftLiveTeam[];
  candidates: DraftCandidate[];
  orders: DraftOrder[];
  picks: DraftPick[];
};

export type DraftSessionRequest = {
  title?: string;
  status?: string;
  teamCount?: number;
  pickTimeSeconds?: number;
  currentPickNo?: number | null;
  currentDraftTeamId?: number | null;
  deadlineAt?: string | null;
  startedAt?: string | null;
  endedAt?: string | null;
};

export type DraftTeamRecord = {
  id: number;
  draftSessionId: number;
  teamName: string;
  displayOrder: number;
  pickerUserId?: number | null;
  pickerName?: string | null;
};

export type DraftTeamRequest = {
  draftSessionId: number;
  teamName: string;
  displayOrder: number;
};

export type DraftCandidateRequest = {
  draftSessionId: number;
  candidateUserId: number;
  candidateName: string;
  race: string;
  status: string;
  pickedDraftTeamId?: number | null;
  pickedAt?: string | null;
};

export type DraftOrderRequest = {
  draftSessionId: number;
  roundNo: number;
  pickNo: number;
  draftTeamId: number;
};

export type DraftPickRequest = {
  draftSessionId: number;
  roundNo: number;
  pickNo: number;
  draftTeamId: number;
  candidateUserId: number;
  pickedByUserId: number;
  pickedAt?: string | null;
};

export type DraftUserSearchResult = {
  id: number;
  userId: string;
  name: string | null;
  tier: string | null;
  race: string | null;
  photo: string | null;
};

export type DraftPickerResponse = {
  draftTeamId: number;
  pickerUserId: number | null;
  pickerName: string | null;
};

export type DraftApiErrorInfo = {
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

export class DraftApiError extends Error {
  info: DraftApiErrorInfo;

  constructor(message: string, info: DraftApiErrorInfo) {
    super(message);
    this.name = "DraftApiError";
    this.info = info;
  }
}

export function isDraftApiError(error: unknown): error is DraftApiError {
  return error instanceof DraftApiError;
}

export function getDraftErrorDebugInfo(error: unknown) {
  if (isDraftApiError(error)) {
    return {
      name: error.name,
      message: error.message,
      ...error.info,
    };
  }

  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }

  return {
    error,
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

function createDraftApiError(
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

  return new DraftApiError(responseMessage, {
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

function readArray<T>(value: unknown, fallback: T[] = []) {
  return Array.isArray(value) ? (value as T[]) : fallback;
}

function normalizeOwnerName(value: string | null | undefined) {
  return typeof value === "string" && value.trim() ? value : null;
}

function normalizeDraftSessionSummary(
  value: DraftSessionSummary,
): DraftSessionSummary {
  return {
    ...value,
    ownerName: normalizeOwnerName(value.ownerName),
  };
}

function normalizeDraftTeam(value: DraftLiveTeam | DraftTeamRecord): DraftLiveTeam {
  return {
    id: value.id,
    draftSessionId: value.draftSessionId,
    teamName: value.teamName,
    displayOrder: value.displayOrder,
    pickerUserId:
      typeof value.pickerUserId === "number" ? value.pickerUserId : null,
    pickerName:
      typeof value.pickerName === "string" && value.pickerName.trim()
        ? value.pickerName
        : null,
    roster: readArray<DraftLiveRosterItem>((value as DraftLiveTeam).roster),
  };
}

function normalizeDraftSnapshot(value: DraftLiveSnapshot): DraftLiveSnapshot {
  return {
    ...value,
    session: {
      ...value.session,
      ownerName: normalizeOwnerName(value.session.ownerName),
    },
    teams: readArray<DraftLiveTeam>(value.teams).map((team) =>
      normalizeDraftTeam(team),
    ),
    availableCandidates: readArray<DraftCandidate>(value.availableCandidates),
    pickedCandidates: readArray<DraftCandidate>(value.pickedCandidates),
    recentPicks: readArray<DraftPick>(value.recentPicks),
    permissions: value.permissions ?? null,
  };
}

function normalizeDraftSessionDetail(value: DraftSessionDetail): DraftSessionDetail {
  return {
    ...value,
    ownerName: normalizeOwnerName(value.ownerName),
    teams: readArray<DraftLiveTeam>(value.teams).map((team) =>
      normalizeDraftTeam(team),
    ),
    candidates: readArray<DraftCandidate>(value.candidates),
    orders: readArray<DraftOrder>(value.orders),
    picks: readArray<DraftPick>(value.picks),
  };
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
      typeof body.status === "number" ? body.status ?? null : response.status;
    const normalizedResponseStatus = responseStatus ?? response.status;
    const responseMessage = readErrorMessage(response.data, fallback);

    if (response.status < 200 || response.status >= 300) {
      throw createDraftApiError(fallback, {
        config: response.config,
        httpStatus: response.status,
        message: responseMessage,
        responseData: response.data,
        responseStatus: normalizedResponseStatus,
      });
    }

    if (normalizedResponseStatus !== 200 || body.data === null || body.data === undefined) {
      throw createDraftApiError(fallback, {
        config: response.config,
        httpStatus: response.status,
        message: responseMessage,
        responseData: response.data,
        responseStatus: normalizedResponseStatus,
      });
    }

    return body.data;
  } catch (error) {
    if (isDraftApiError(error)) {
      throw error;
    }

    if (axios.isAxiosError(error)) {
      throw createDraftApiError(fallback, {
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
      throw createDraftApiError(fallback, {
        message: error.message,
      });
    }

    throw createDraftApiError(fallback, {});
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
      throw createDraftApiError(fallback, {
        config: response.config,
        httpStatus: response.status,
        message: responseMessage,
        responseData: response.data,
        responseStatus: normalizedResponseStatus,
      });
    }

    if (normalizedResponseStatus !== 200) {
      throw createDraftApiError(fallback, {
        config: response.config,
        httpStatus: response.status,
        message: responseMessage,
        responseData: response.data,
        responseStatus: normalizedResponseStatus,
      });
    }
  } catch (error) {
    if (isDraftApiError(error)) {
      throw error;
    }

    if (axios.isAxiosError(error)) {
      throw createDraftApiError(fallback, {
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
      throw createDraftApiError(fallback, {
        message: error.message,
      });
    }

    throw createDraftApiError(fallback, {});
  }
}

export async function listDraftSessions() {
  const sessions = await unwrapResponse(
    apiClient.get<ApiEnvelope<DraftSessionSummary[]>>("/draft/sessions", {
      validateStatus: () => true,
    }),
    "드래프트 세션 목록을 불러오지 못했습니다.",
  );

  return readArray<DraftSessionSummary>(sessions).map((session) =>
    normalizeDraftSessionSummary(session),
  );
}

export async function getDraftSnapshot(sessionId: number) {
  const snapshot = await unwrapResponse(
    apiClient.get<ApiEnvelope<DraftLiveSnapshot>>(
      `/draft/live/sessions/${sessionId}/snapshot`,
      {
        validateStatus: () => true,
      },
    ),
    "드래프트 스냅샷을 불러오지 못했습니다.",
  );

  return normalizeDraftSnapshot(snapshot);
}

export async function pickDraftCandidate(
  sessionId: number,
  candidateUserId: number,
) {
  const snapshot = await unwrapResponse(
    apiClient.post<ApiEnvelope<DraftLiveSnapshot>>(
      `/draft/live/sessions/${sessionId}/pick`,
      { candidateUserId },
      {
        validateStatus: () => true,
      },
    ),
    "드래프트 인원을 지명하지 못했습니다.",
  );

  return normalizeDraftSnapshot(snapshot);
}

export async function startDraftSession(sessionId: number) {
  const snapshot = await unwrapResponse(
    apiClient.post<ApiEnvelope<DraftLiveSnapshot>>(
      `/draft/admin/sessions/${sessionId}/start`,
      {},
      {
        validateStatus: () => true,
      },
    ),
    "드래프트를 시작하지 못했습니다.",
  );

  return normalizeDraftSnapshot(snapshot);
}

export async function pauseDraftSession(sessionId: number) {
  const snapshot = await unwrapResponse(
    apiClient.post<ApiEnvelope<DraftLiveSnapshot>>(
      `/draft/admin/sessions/${sessionId}/pause`,
      {},
      {
        validateStatus: () => true,
      },
    ),
    "드래프트를 일시정지하지 못했습니다.",
  );

  return normalizeDraftSnapshot(snapshot);
}

export async function resumeDraftSession(sessionId: number, seconds?: number) {
  const snapshot = await unwrapResponse(
    apiClient.post<ApiEnvelope<DraftLiveSnapshot>>(
      `/draft/admin/sessions/${sessionId}/resume`,
      typeof seconds === "number" ? { seconds } : {},
      {
        validateStatus: () => true,
      },
    ),
    "드래프트를 재개하지 못했습니다.",
  );

  return normalizeDraftSnapshot(snapshot);
}

export async function extendDraftTurn(sessionId: number, seconds: number) {
  const snapshot = await unwrapResponse(
    apiClient.post<ApiEnvelope<DraftLiveSnapshot>>(
      `/draft/admin/sessions/${sessionId}/extend-time`,
      { seconds },
      {
        validateStatus: () => true,
      },
    ),
    "현재 턴 시간을 연장하지 못했습니다.",
  );

  return normalizeDraftSnapshot(snapshot);
}

export async function skipDraftTurn(sessionId: number, reason = "manual") {
  const snapshot = await unwrapResponse(
    apiClient.post<ApiEnvelope<DraftLiveSnapshot>>(
      `/draft/admin/sessions/${sessionId}/force-skip`,
      { reason },
      {
        validateStatus: () => true,
      },
    ),
    "현재 턴을 스킵하지 못했습니다.",
  );

  return normalizeDraftSnapshot(snapshot);
}

export async function finishDraftSession(
  sessionId: number,
  reason = "manual-finish",
) {
  const snapshot = await unwrapResponse(
    apiClient.post<ApiEnvelope<DraftLiveSnapshot>>(
      `/draft/admin/sessions/${sessionId}/finish`,
      { reason },
      {
        validateStatus: () => true,
      },
    ),
    "드래프트를 종료하지 못했습니다.",
  );

  return normalizeDraftSnapshot(snapshot);
}

export async function assignDraftPicker(teamId: number, pickerUserId: number) {
  return unwrapResponse(
    apiClient.post<ApiEnvelope<DraftPickerResponse>>(
      `/draft/admin/teams/${teamId}/picker`,
      { pickerUserId },
      {
        validateStatus: () => true,
      },
    ),
    "픽커를 지정하지 못했습니다.",
  );
}

export async function getDraftSessionDetail(sessionId: number) {
  const detail = await unwrapResponse(
    apiClient.get<ApiEnvelope<DraftSessionDetail>>(`/draft/sessions/${sessionId}`, {
      validateStatus: () => true,
    }),
    "드래프트 세션 상세를 불러오지 못했습니다.",
  );

  return normalizeDraftSessionDetail(detail);
}

export async function createDraftSession(payload: DraftSessionRequest) {
  const session = await unwrapResponse(
    apiClient.post<ApiEnvelope<DraftSessionSummary>>("/draft/sessions", payload, {
      validateStatus: () => true,
    }),
    "드래프트 세션을 생성하지 못했습니다.",
  );

  return normalizeDraftSessionSummary(session);
}

export async function updateDraftSession(
  sessionId: number,
  payload: DraftSessionRequest,
) {
  const session = await unwrapResponse(
    apiClient.put<ApiEnvelope<DraftSessionSummary>>(
      `/draft/sessions/${sessionId}`,
      payload,
      {
        validateStatus: () => true,
      },
    ),
    "드래프트 세션을 수정하지 못했습니다.",
  );

  return normalizeDraftSessionSummary(session);
}

export async function deleteDraftSession(sessionId: number) {
  return unwrapVoidResponse(
    apiClient.delete<ApiEnvelope<null>>(`/draft/sessions/${sessionId}`, {
      validateStatus: () => true,
    }),
    "드래프트 세션을 삭제하지 못했습니다.",
  );
}

export async function createDraftTeam(payload: DraftTeamRequest) {
  return unwrapResponse(
    apiClient.post<ApiEnvelope<DraftTeamRecord>>("/draft/teams", payload, {
      validateStatus: () => true,
    }),
    "팀을 생성하지 못했습니다.",
  );
}

export async function createDefaultDraftTeams(sessionId: number, teamCount: number) {
  for (let displayOrder = 1; displayOrder <= teamCount; displayOrder += 1) {
    await createDraftTeam({
      draftSessionId: sessionId,
      teamName: `${displayOrder}팀`,
      displayOrder,
    });
  }
}

export async function updateDraftTeam(teamId: number, payload: DraftTeamRequest) {
  return unwrapResponse(
    apiClient.put<ApiEnvelope<DraftTeamRecord>>(`/draft/teams/${teamId}`, payload, {
      validateStatus: () => true,
    }),
    "팀을 수정하지 못했습니다.",
  );
}

export async function deleteDraftTeam(teamId: number) {
  return unwrapVoidResponse(
    apiClient.delete<ApiEnvelope<null>>(`/draft/teams/${teamId}`, {
      validateStatus: () => true,
    }),
    "팀을 삭제하지 못했습니다.",
  );
}

export async function createDraftCandidate(payload: DraftCandidateRequest) {
  return unwrapResponse(
    apiClient.post<ApiEnvelope<DraftCandidate>>("/draft/candidates", payload, {
      validateStatus: () => true,
    }),
    "드래프트 인원을 등록하지 못했습니다.",
  );
}

export async function updateDraftCandidate(
  sessionId: number,
  candidateUserId: number,
  payload: DraftCandidateRequest,
) {
  return unwrapResponse(
    apiClient.put<ApiEnvelope<DraftCandidate>>(
      `/draft/sessions/${sessionId}/candidates/${candidateUserId}`,
      payload,
      {
        validateStatus: () => true,
      },
    ),
    "드래프트 인원을 수정하지 못했습니다.",
  );
}

export async function deleteDraftCandidate(
  sessionId: number,
  candidateUserId: number,
) {
  return unwrapVoidResponse(
    apiClient.delete<ApiEnvelope<null>>(
      `/draft/sessions/${sessionId}/candidates/${candidateUserId}`,
      {
        validateStatus: () => true,
      },
    ),
    "드래프트 인원을 삭제하지 못했습니다.",
  );
}

export async function createDraftOrder(payload: DraftOrderRequest) {
  return unwrapResponse(
    apiClient.post<ApiEnvelope<DraftOrder>>("/draft/orders", payload, {
      validateStatus: () => true,
    }),
    "드래프트 순서를 등록하지 못했습니다.",
  );
}

export async function updateDraftOrder(
  sessionId: number,
  pickNo: number,
  payload: DraftOrderRequest,
) {
  return unwrapResponse(
    apiClient.put<ApiEnvelope<DraftOrder>>(
      `/draft/sessions/${sessionId}/orders/${pickNo}`,
      payload,
      {
        validateStatus: () => true,
      },
    ),
    "드래프트 순서를 수정하지 못했습니다.",
  );
}

export async function deleteDraftOrder(sessionId: number, pickNo: number) {
  return unwrapVoidResponse(
    apiClient.delete<ApiEnvelope<null>>(
      `/draft/sessions/${sessionId}/orders/${pickNo}`,
      {
        validateStatus: () => true,
      },
    ),
    "드래프트 순서를 삭제하지 못했습니다.",
  );
}

export async function updateDraftPick(
  sessionId: number,
  pickNo: number,
  payload: DraftPickRequest,
) {
  return unwrapResponse(
    apiClient.put<ApiEnvelope<DraftPick>>(
      `/draft/sessions/${sessionId}/picks/${pickNo}`,
      payload,
      {
        validateStatus: () => true,
      },
    ),
    "픽 기록을 수정하지 못했습니다.",
  );
}

export async function deleteDraftPick(sessionId: number, pickNo: number) {
  return unwrapVoidResponse(
    apiClient.delete<ApiEnvelope<null>>(
      `/draft/sessions/${sessionId}/picks/${pickNo}`,
      {
        validateStatus: () => true,
      },
    ),
    "픽 기록을 삭제하지 못했습니다.",
  );
}

export async function searchDraftUsers(keyword: string, limit = 8) {
  return unwrapResponse(
    apiClient.get<ApiEnvelope<DraftUserSearchResult[]>>("/user/search", {
      params: {
        keyword,
        limit,
      },
      validateStatus: () => true,
    }),
    "유저 검색 결과를 불러오지 못했습니다.",
  );
}

export function buildDraftWebSocketUrl() {
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
