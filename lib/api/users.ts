import axios from "axios";
import { apiClient } from "@/lib/api/client";

type ApiEnvelope<T> = {
  status?: number;
  message?: string;
  data?: T | null;
};

type ErrorResponseBody = {
  error?: string;
  message?: string;
};

export type UserSearchResult = {
  id: number;
  userId: string;
  name: string | null;
  tier: string | null;
  race: string | null;
  photo: string | null;
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
  request: Promise<{
    data: ApiEnvelope<T> | ErrorResponseBody;
    status: number;
  }>,
  fallback: string,
) {
  try {
    const response = await request;
    const body = response.data as ApiEnvelope<T>;
    const responseStatus =
      typeof body.status === "number" ? body.status : response.status;

    if (
      response.status < 200 ||
      response.status >= 300 ||
      responseStatus !== 200 ||
      body.data === null ||
      body.data === undefined
    ) {
      throw new Error(readErrorMessage(response.data, fallback));
    }

    return body.data;
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

export async function searchUsers(keyword: string, limit = 10) {
  const trimmedKeyword = keyword.trim();

  if (!trimmedKeyword) {
    return [];
  }

  return unwrapResponse(
    apiClient.get<ApiEnvelope<UserSearchResult[]>>("/user/search", {
      params: {
        keyword: trimmedKeyword,
        limit,
      },
      validateStatus: () => true,
    }),
    "사용자 검색 결과를 불러오지 못했습니다.",
  );
}
