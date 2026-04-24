import { apiClient } from "@/lib/api/client";

type ApiEnvelope<T> = {
  status?: number;
  message?: string;
  data?: T | null;
};

type ErrorResponseBody = {
  status?: number;
  message?: string;
  error?: string;
};

export type UserDetail = {
  userId: string;
  name: string | null;
  tier: string | null;
  race: string | null;
  photo: string | null;
  battleTag: string | null;
  coin: number | null;
  win: number;
  lose: number;
};

export type AdminUserStatus = "ACTIVE" | "INACTIVE";
export type AdminUserListStatus = AdminUserStatus | "ALL";
export type AdminUserRole =
  | "ROLE_USER"
  | "ROLE_MANAGER"
  | "ROLE_MASTER"
  | "ROLE_ADMIN";

export type AdminUserRecord = {
  id: number;
  userId: string;
  name: string | null;
  race: string | null;
  tier: string | null;
  status: AdminUserStatus;
  userType: AdminUserRole;
};

export type AdminUserCreateRequest = {
  userId: string;
  password: string;
  name: string;
  race: string;
  tier: string;
};

export type AdminUserUpdateRequest = {
  userId: string;
  name: string;
  race: string;
  tier: string;
};

export type AdminUserRoleUpdateRequest = {
  role: AdminUserRole;
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

function readResponseStatus(data: unknown, fallback: number) {
  if (!data || typeof data !== "object") {
    return fallback;
  }

  const status = (data as { status?: unknown }).status;

  return typeof status === "number" ? status : fallback;
}

async function unwrapEnvelopeResponse<T>(
  request: Promise<{
    status: number;
    data: ApiEnvelope<T> | ErrorResponseBody;
  }>,
  fallback: string,
) {
  const response = await request;
  const responseStatus = readResponseStatus(response.data, response.status);
  const message = readErrorMessage(response.data, fallback);

  if (response.status < 200 || response.status >= 300 || responseStatus >= 400) {
    throw new Error(message);
  }

  const body = response.data as ApiEnvelope<T>;

  if (body.data === null || body.data === undefined) {
    throw new Error(message);
  }

  return body.data;
}

function normalizeAdminUserStatus(value: unknown): AdminUserStatus {
  return value === "INACTIVE" ? "INACTIVE" : "ACTIVE";
}

function normalizeAdminUserRole(value: unknown): AdminUserRole {
  switch (value) {
    case "ROLE_MANAGER":
    case "ROLE_MASTER":
    case "ROLE_ADMIN":
      return value;
    default:
      return "ROLE_USER";
  }
}

function normalizeAdminUserRecord(
  value: Partial<AdminUserRecord>,
): AdminUserRecord {
  if (typeof value.id !== "number" || typeof value.userId !== "string") {
    throw new Error("사용자 정보를 불러오지 못했습니다.");
  }

  return {
    id: value.id,
    userId: value.userId.trim(),
    name: typeof value.name === "string" ? value.name : null,
    race: typeof value.race === "string" ? value.race : null,
    tier: typeof value.tier === "string" ? value.tier : null,
    status: normalizeAdminUserStatus(value.status),
    userType: normalizeAdminUserRole(value.userType),
  };
}

export async function getUserDetail(userId: string): Promise<UserDetail> {
  const response = await apiClient.get<UserDetail | ErrorResponseBody>(
    `/user/get/${encodeURIComponent(userId)}`,
    {
      validateStatus: () => true,
    },
  );

  if (response.status < 200 || response.status >= 300) {
    throw new Error(
      readErrorMessage(response.data, "계정 정보를 불러오지 못했습니다."),
    );
  }

  const data = response.data as Partial<UserDetail>;

  if (typeof data.userId !== "string" || !data.userId.trim()) {
    throw new Error("계정 정보를 불러오지 못했습니다.");
  }

  return {
    userId: data.userId,
    name: typeof data.name === "string" ? data.name : null,
    tier: typeof data.tier === "string" ? data.tier : null,
    race: typeof data.race === "string" ? data.race : null,
    photo: typeof data.photo === "string" ? data.photo : null,
    battleTag: typeof data.battleTag === "string" ? data.battleTag : null,
    coin: typeof data.coin === "number" ? data.coin : null,
    win: typeof data.win === "number" ? data.win : 0,
    lose: typeof data.lose === "number" ? data.lose : 0,
  };
}

export async function updateUserPassword(userPk: number, newPassword: string) {
  const response = await apiClient.patch<ApiEnvelope<null> | ErrorResponseBody>(
    `/user/password/${userPk}`,
    newPassword,
    {
      headers: {
        "Content-Type": "text/plain",
      },
      transformRequest: [(data) => data],
      validateStatus: () => true,
    },
  );

  const responseStatus = readResponseStatus(response.data, response.status);
  const message = readErrorMessage(response.data, "비밀번호를 변경하지 못했습니다.");

  if (response.status < 200 || response.status >= 300 || responseStatus >= 400) {
    throw new Error(message);
  }
}

export async function listAdminUsers(options?: {
  keyword?: string;
  status?: AdminUserListStatus;
}) {
  const users = await unwrapEnvelopeResponse(
    apiClient.get<ApiEnvelope<AdminUserRecord[]> | ErrorResponseBody>(
      "/user/admin/list",
      {
        params: {
          keyword: options?.keyword?.trim() ?? "",
          status: options?.status ?? "ALL",
        },
        validateStatus: () => true,
      },
    ),
    "사용자 목록을 불러오지 못했습니다.",
  );

  return Array.isArray(users)
    ? users.map((user) => normalizeAdminUserRecord(user))
    : [];
}

export async function createAdminUser(payload: AdminUserCreateRequest) {
  const user = await unwrapEnvelopeResponse(
    apiClient.post<ApiEnvelope<AdminUserRecord> | ErrorResponseBody>(
      "/user/admin",
      payload,
      {
        validateStatus: () => true,
      },
    ),
    "사용자를 등록하지 못했습니다.",
  );

  return normalizeAdminUserRecord(user);
}

export async function updateAdminUser(
  userId: number,
  payload: AdminUserUpdateRequest,
) {
  const user = await unwrapEnvelopeResponse(
    apiClient.put<ApiEnvelope<AdminUserRecord> | ErrorResponseBody>(
      `/user/admin/${userId}`,
      payload,
      {
        validateStatus: () => true,
      },
    ),
    "사용자 정보를 수정하지 못했습니다.",
  );

  return normalizeAdminUserRecord(user);
}

export async function updateAdminUserStatus(
  userId: number,
  status: AdminUserStatus,
) {
  const user = await unwrapEnvelopeResponse(
    apiClient.patch<ApiEnvelope<AdminUserRecord> | ErrorResponseBody>(
      `/user/admin/${userId}/status`,
      { status },
      {
        validateStatus: () => true,
      },
    ),
    "사용자 상태를 변경하지 못했습니다.",
  );

  return normalizeAdminUserRecord(user);
}

export async function updateAdminUserRole(
  userId: number,
  role: AdminUserRole,
) {
  const payload: AdminUserRoleUpdateRequest = { role };
  const user = await unwrapEnvelopeResponse(
    apiClient.patch<ApiEnvelope<AdminUserRecord> | ErrorResponseBody>(
      `/user/admin/${userId}/role`,
      payload,
      {
        validateStatus: () => true,
      },
    ),
    "사용자 권한을 변경하지 못했습니다.",
  );

  return normalizeAdminUserRecord(user);
}
