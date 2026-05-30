import { apiClient } from "@/lib/api/client";

type ApiEnvelope<T> = {
  status?: number;
  message?: string;
  data?: T | null;
};

export type EntrySubmissionStatus = "SUBMITTING" | "COMPLETED";
export type EntrySubmissionMyRole =
  | "VIEWER"
  | "OWNER"
  | "CAPTAIN"
  | "OWNER_CAPTAIN";

export type EntrySubmissionSessionSummary = {
  id: number;
  title: string;
  ownerUserId: number;
  ownerUserLoginId: string | null;
  status: EntrySubmissionStatus | string;
  setCount: number;
  completedAt: string | null;
  regDate: string | null;
  updateDate: string | null;
};

export type EntrySubmissionSessionInfo = EntrySubmissionSessionSummary & {
  serverNow: string | null;
};

export type EntrySubmissionTeam = {
  id: number;
  entrySubmissionSessionId: number;
  teamName: string;
  displayOrder: 1 | 2 | number;
  captainUserId: number;
  captainUserLoginId: string | null;
  submitted: boolean;
  submittedAt: string | null;
};

export type EntrySubmissionPlayer = {
  id: number;
  entrySubmissionSessionId: number;
  entrySubmissionTeamId: number;
  playerName: string;
  displayOrder: number;
  captain: boolean;
};

export type EntrySubmissionEntry = {
  entrySubmissionSessionId: number;
  entrySubmissionTeamId: number;
  setNo: number;
  playerId: number;
  playerName: string | null;
  submittedByUserId: number;
  submittedByUserLoginId: string | null;
  submittedAt: string | null;
};

export type EntrySubmissionMatch = {
  setNo: number;
  team1PlayerId: number | null;
  team1PlayerName: string | null;
  team2PlayerId: number | null;
  team2PlayerName: string | null;
};

export type EntrySubmissionPermissions = {
  canSubmit: boolean;
  canDelete: boolean;
  canRestart: boolean;
  myTeamId: number | null;
  myRole: EntrySubmissionMyRole | string | null;
};

export type EntrySubmissionSnapshot = {
  session: EntrySubmissionSessionInfo;
  teams: EntrySubmissionTeam[];
  players: EntrySubmissionPlayer[];
  entries: EntrySubmissionEntry[];
  matches: EntrySubmissionMatch[];
  permissions: EntrySubmissionPermissions | null;
};

export type EntrySubmissionEventType =
  | "TEAM_SUBMITTED"
  | "SESSION_COMPLETED"
  | "SESSION_RESTARTED";

export type EntrySubmissionEvent = {
  type: EntrySubmissionEventType | string;
  sessionId: number;
  occurredAt: string | null;
  serverNow: string | null;
  actorUserId: number | null;
  actorUserLoginId?: string | null;
  message: string | null;
  snapshot: EntrySubmissionSnapshot | null;
};

export type EntrySubmissionSessionCreateRequest = {
  title: string;
  team1CaptainUserId: number;
  team2CaptainUserId: number;
  team1PlayerNames: string[];
  team2PlayerNames: string[];
  setCount?: number | null;
};

export type EntrySubmissionSubmitRequest = {
  entries: Array<{
    setNo: number;
    playerId: number;
  }>;
};

function readArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function normalizeSnapshot(snapshot: EntrySubmissionSnapshot): EntrySubmissionSnapshot {
  return {
    ...snapshot,
    teams: readArray<EntrySubmissionTeam>(snapshot.teams).sort(
      (left, right) => left.displayOrder - right.displayOrder || left.id - right.id,
    ),
    players: readArray<EntrySubmissionPlayer>(snapshot.players).sort(
      (left, right) =>
        left.entrySubmissionTeamId - right.entrySubmissionTeamId ||
        left.displayOrder - right.displayOrder ||
        left.id - right.id,
    ),
    entries: readArray<EntrySubmissionEntry>(snapshot.entries).sort(
      (left, right) =>
        left.setNo - right.setNo ||
        left.entrySubmissionTeamId - right.entrySubmissionTeamId,
    ),
    matches: readArray<EntrySubmissionMatch>(snapshot.matches).sort(
      (left, right) => left.setNo - right.setNo,
    ),
  };
}

async function unwrapResponse<T>(request: Promise<{ data: ApiEnvelope<T>; status: number }>, fallback: string) {
  const response = await request;
  const body = response.data;

  if (response.status < 200 || response.status >= 300 || body.status !== 200) {
    throw new Error(body.message || fallback);
  }

  if (body.data === undefined || body.data === null) {
    throw new Error(fallback);
  }

  return body.data;
}

async function unwrapVoidResponse(request: Promise<{ data: ApiEnvelope<null>; status: number }>, fallback: string) {
  const response = await request;
  const body = response.data;

  if (response.status < 200 || response.status >= 300 || body.status !== 200) {
    throw new Error(body.message || fallback);
  }
}

export async function listEntrySubmissionSessions() {
  return unwrapResponse(
    apiClient.get<ApiEnvelope<EntrySubmissionSessionSummary[]>>(
      "/entry-submissions/sessions",
      { validateStatus: () => true },
    ),
    "엔트리 제출 목록을 불러오지 못했습니다.",
  );
}

export async function createEntrySubmissionSession(
  payload: EntrySubmissionSessionCreateRequest,
) {
  const snapshot = await unwrapResponse(
    apiClient.post<ApiEnvelope<EntrySubmissionSnapshot>>(
      "/entry-submissions/sessions",
      payload,
      { validateStatus: () => true },
    ),
    "엔트리 제출을 생성하지 못했습니다.",
  );

  return normalizeSnapshot(snapshot);
}

export async function getEntrySubmissionSnapshot(sessionId: number) {
  const snapshot = await unwrapResponse(
    apiClient.get<ApiEnvelope<EntrySubmissionSnapshot>>(
      `/entry-submissions/sessions/${sessionId}/snapshot`,
      { validateStatus: () => true },
    ),
    "엔트리 제출 정보를 불러오지 못했습니다.",
  );

  return normalizeSnapshot(snapshot);
}

export async function submitEntrySubmissionEntries(
  sessionId: number,
  payload: EntrySubmissionSubmitRequest,
) {
  const snapshot = await unwrapResponse(
    apiClient.post<ApiEnvelope<EntrySubmissionSnapshot>>(
      `/entry-submissions/sessions/${sessionId}/submit`,
      payload,
      { validateStatus: () => true },
    ),
    "엔트리를 제출하지 못했습니다.",
  );

  return normalizeSnapshot(snapshot);
}

export async function restartEntrySubmissionSession(sessionId: number) {
  const snapshot = await unwrapResponse(
    apiClient.post<ApiEnvelope<EntrySubmissionSnapshot>>(
      `/entry-submissions/sessions/${sessionId}/restart`,
      null,
      { validateStatus: () => true },
    ),
    "엔트리 제출을 다시 시작하지 못했습니다.",
  );

  return normalizeSnapshot(snapshot);
}

export async function deleteEntrySubmissionSession(sessionId: number) {
  return unwrapVoidResponse(
    apiClient.delete<ApiEnvelope<null>>(`/entry-submissions/sessions/${sessionId}`, {
      validateStatus: () => true,
    }),
    "엔트리 제출을 삭제하지 못했습니다.",
  );
}

export function buildEntrySubmissionWebSocketUrl() {
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
