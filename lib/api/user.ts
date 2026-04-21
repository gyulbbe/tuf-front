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
