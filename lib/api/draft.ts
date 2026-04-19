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
  status: string;
  teamCount: number;
  pickTimeSeconds: number;
  currentPickNo: number | null;
  currentDraftTeamId: number | null;
  deadlineAt: string | null;
  startedAt: string | null;
  endedAt: string | null;
};

export type DraftTeamOperator = {
  draftTeamId: number;
  operatorUserId: number;
  operatorName: string;
  role: string;
  isActive: string;
  canPick: string;
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
  operators: DraftTeamOperator[];
  roster: DraftLiveRosterItem[];
};

export type DraftCandidate = {
  draftSessionId: number;
  candidateUserId: number;
  candidateName: string;
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
};

export type DraftSessionDetail = {
  id: number;
  title: string;
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

export type DraftTeamOperatorRequest = {
  draftTeamId: number;
  operatorUserId: number;
  role: string;
  isActive: string;
};

export type DraftUserLookup = {
  id: number | null;
  userPk: number | null;
  resolvedUserPk: number | null;
  userId: string;
  name: string | null;
  tier: string | null;
  race: string | null;
  photo: string | null;
  battleTag: string | null;
  coin: number | null;
  win: number | null;
  lose: number | null;
};

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
  request: Promise<{ status: number; data: ApiEnvelope<T> | ErrorResponseBody }>,
  fallback: string,
) {
  const response = await request;

  if (response.status < 200 || response.status >= 300) {
    throw new Error(readErrorMessage(response.data, fallback));
  }

  const body = response.data as ApiEnvelope<T>;
  const responseStatus =
    typeof body.status === "number" ? body.status : response.status;

  if (responseStatus >= 400 || body.data === null || body.data === undefined) {
    throw new Error(
      typeof body.message === "string" && body.message.trim()
        ? body.message
        : fallback,
    );
  }

  return body.data;
}

function readNullableNumber(value: unknown) {
  return typeof value === "number" ? value : null;
}

function readNullableString(value: unknown) {
  return typeof value === "string" ? value : null;
}

function readUserLookupPayload(data: unknown): DraftUserLookup {
  if (!data || typeof data !== "object") {
    throw new Error("유저 검색 응답 형식이 올바르지 않습니다.");
  }

  const body = data as Record<string, unknown>;
  const userId = readNullableString(body.userId);

  if (!userId) {
    throw new Error("유저 아이디를 찾지 못했습니다.");
  }

  const resolvedUserPk =
    readNullableNumber(body.userPk) ?? readNullableNumber(body.id);

  return {
    id: readNullableNumber(body.id),
    userPk: readNullableNumber(body.userPk),
    resolvedUserPk,
    userId,
    name: readNullableString(body.name),
    tier: readNullableString(body.tier),
    race: readNullableString(body.race),
    photo: readNullableString(body.photo),
    battleTag: readNullableString(body.battleTag),
    coin: readNullableNumber(body.coin),
    win: readNullableNumber(body.win),
    lose: readNullableNumber(body.lose),
  };
}

export async function listDraftSessions() {
  return unwrapResponse(
    apiClient.get<ApiEnvelope<DraftSessionSummary[]>>("/draft/sessions", {
      validateStatus: () => true,
    }),
    "드래프트 세션 목록을 불러오지 못했습니다.",
  );
}

export async function getDraftSnapshot(sessionId: number) {
  return unwrapResponse(
    apiClient.get<ApiEnvelope<DraftLiveSnapshot>>(
      `/draft/live/sessions/${sessionId}/snapshot`,
      {
        validateStatus: () => true,
      },
    ),
    "드래프트 스냅샷을 불러오지 못했습니다.",
  );
}

export async function pickDraftCandidate(
  sessionId: number,
  candidateUserId: number,
) {
  return unwrapResponse(
    apiClient.post<ApiEnvelope<DraftLiveSnapshot>>(
      `/draft/live/sessions/${sessionId}/pick`,
      { candidateUserId },
      {
        validateStatus: () => true,
      },
    ),
    "후보를 지명하지 못했습니다.",
  );
}

export async function startDraftSession(sessionId: number) {
  return unwrapResponse(
    apiClient.post<ApiEnvelope<DraftLiveSnapshot>>(
      `/draft/admin/sessions/${sessionId}/start`,
      {},
      {
        validateStatus: () => true,
      },
    ),
    "드래프트를 시작하지 못했습니다.",
  );
}

export async function pauseDraftSession(sessionId: number) {
  return unwrapResponse(
    apiClient.post<ApiEnvelope<DraftLiveSnapshot>>(
      `/draft/admin/sessions/${sessionId}/pause`,
      {},
      {
        validateStatus: () => true,
      },
    ),
    "드래프트를 일시정지하지 못했습니다.",
  );
}

export async function resumeDraftSession(sessionId: number, seconds?: number) {
  return unwrapResponse(
    apiClient.post<ApiEnvelope<DraftLiveSnapshot>>(
      `/draft/admin/sessions/${sessionId}/resume`,
      typeof seconds === "number" ? { seconds } : {},
      {
        validateStatus: () => true,
      },
    ),
    "드래프트를 재개하지 못했습니다.",
  );
}

export async function extendDraftTurn(sessionId: number, seconds: number) {
  return unwrapResponse(
    apiClient.post<ApiEnvelope<DraftLiveSnapshot>>(
      `/draft/admin/sessions/${sessionId}/extend-time`,
      { seconds },
      {
        validateStatus: () => true,
      },
    ),
    "턴 시간을 연장하지 못했습니다.",
  );
}

export async function skipDraftTurn(sessionId: number, reason = "manual") {
  return unwrapResponse(
    apiClient.post<ApiEnvelope<DraftLiveSnapshot>>(
      `/draft/admin/sessions/${sessionId}/force-skip`,
      { reason },
      {
        validateStatus: () => true,
      },
    ),
    "현재 턴을 스킵하지 못했습니다.",
  );
}

export async function finishDraftSession(
  sessionId: number,
  reason = "manual-finish",
) {
  return unwrapResponse(
    apiClient.post<ApiEnvelope<DraftLiveSnapshot>>(
      `/draft/admin/sessions/${sessionId}/finish`,
      { reason },
      {
        validateStatus: () => true,
      },
    ),
    "드래프트를 종료하지 못했습니다.",
  );
}

export async function assignDraftPicker(teamId: number, operatorUserId: number) {
  return unwrapResponse(
    apiClient.post<ApiEnvelope<DraftTeamOperator>>(
      `/draft/admin/teams/${teamId}/picker`,
      { operatorUserId },
      {
        validateStatus: () => true,
      },
    ),
    "픽 권한자를 지정하지 못했습니다.",
  );
}

export async function getDraftSessionDetail(sessionId: number) {
  return unwrapResponse(
    apiClient.get<ApiEnvelope<DraftSessionDetail>>(`/draft/sessions/${sessionId}`, {
      validateStatus: () => true,
    }),
    "드래프트 세션 상세를 불러오지 못했습니다.",
  );
}

export async function createDraftSession(payload: DraftSessionRequest) {
  return unwrapResponse(
    apiClient.post<ApiEnvelope<DraftSessionSummary>>("/draft/sessions", payload, {
      validateStatus: () => true,
    }),
    "드래프트 세션을 생성하지 못했습니다.",
  );
}

export async function updateDraftSession(
  sessionId: number,
  payload: DraftSessionRequest,
) {
  return unwrapResponse(
    apiClient.put<ApiEnvelope<DraftSessionSummary>>(
      `/draft/sessions/${sessionId}`,
      payload,
      {
        validateStatus: () => true,
      },
    ),
    "드래프트 세션을 수정하지 못했습니다.",
  );
}

export async function createDraftTeamOperator(
  payload: DraftTeamOperatorRequest,
) {
  return unwrapResponse(
    apiClient.post<ApiEnvelope<DraftTeamOperator>>("/draft/team-operators", payload, {
      validateStatus: () => true,
    }),
    "팀 운영자를 추가하지 못했습니다.",
  );
}

export async function updateDraftTeamOperator(
  teamId: number,
  operatorUserId: number,
  payload: Partial<Pick<DraftTeamOperatorRequest, "role" | "isActive">>,
) {
  return unwrapResponse(
    apiClient.put<ApiEnvelope<DraftTeamOperator>>(
      `/draft/teams/${teamId}/operators/${operatorUserId}`,
      payload,
      {
        validateStatus: () => true,
      },
    ),
    "팀 운영자 정보를 수정하지 못했습니다.",
  );
}

export async function deleteDraftTeamOperator(
  teamId: number,
  operatorUserId: number,
) {
  return unwrapResponse(
    apiClient.delete<ApiEnvelope<null>>(
      `/draft/teams/${teamId}/operators/${operatorUserId}`,
      {
        validateStatus: () => true,
      },
    ),
    "팀 운영자를 삭제하지 못했습니다.",
  );
}

export async function searchDraftUserByLoginId(userId: string) {
  const response = await apiClient.get(
    `/user/get/${encodeURIComponent(userId)}`,
    {
      validateStatus: () => true,
    },
  );

  if (response.status < 200 || response.status >= 300) {
    throw new Error("아이디로 유저를 찾지 못했습니다.");
  }

  return readUserLookupPayload(response.data);
}

export function buildDraftWebSocketUrl() {
  const baseUrl =
    process.env.NEXT_PUBLIC_API_BASE_URL ??
    (typeof window !== "undefined" ? window.location.origin : "http://localhost:8080");
  const url = new URL(baseUrl);

  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.pathname = `${url.pathname.replace(/\/$/, "")}/ws`;
  url.search = "";
  url.hash = "";

  return url.toString();
}
