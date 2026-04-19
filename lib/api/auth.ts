import type { AxiosResponseHeaders, RawAxiosResponseHeaders } from "axios";
import { apiClient } from "@/lib/api/client";
import type { AuthSession, LoginCredentials } from "@/lib/auth/auth-types";
import { buildAuthSession } from "@/lib/auth/jwt";

type ErrorResponseBody = {
  message?: string;
  error?: string;
};

function readAuthorizationHeader(
  headers: AxiosResponseHeaders | RawAxiosResponseHeaders,
) {
  const authorization = headers["authorization"];

  if (typeof authorization === "string") {
    return authorization;
  }

  if (Array.isArray(authorization) && typeof authorization[0] === "string") {
    return authorization[0];
  }

  return null;
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

export async function loginRequest(
  credentials: LoginCredentials,
): Promise<AuthSession> {
  const response = await apiClient.post("/login", credentials, {
    skipAuth: true,
    skipUnauthorizedHandler: true,
    validateStatus: () => true,
  });

  if (response.status === 401) {
    throw new Error(
      readErrorMessage(
        response.data,
        "아이디 또는 비밀번호를 다시 확인해 주세요.",
      ),
    );
  }

  if (response.status < 200 || response.status >= 300) {
    throw new Error(
      readErrorMessage(response.data, "로그인 처리 중 오류가 발생했습니다."),
    );
  }

  const authorization = readAuthorizationHeader(response.headers);

  if (!authorization) {
    throw new Error("로그인 응답 헤더에서 Authorization 토큰을 찾지 못했습니다.");
  }

  const session = buildAuthSession(authorization);

  if (!session) {
    throw new Error("JWT 정보를 해석하지 못했습니다.");
  }

  return session;
}
