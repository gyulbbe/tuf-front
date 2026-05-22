import { apiClient } from "@/lib/api/client";

export type AiChatRoutingMode = "AUTO" | "CLOUDFLARE_ONLY" | "OLLAMA_ONLY";
export type AiChatTestProvider = "CLOUDFLARE" | "OLLAMA";

type ApiEnvelope<T> = {
  status?: number;
  message?: string;
  data?: T | null;
  errorCode?: string | null;
};

type ErrorResponseBody = {
  message?: string;
  error?: string;
};

export type AiChatSettings = {
  routingMode: AiChatRoutingMode;
  cloudflareModel: string;
  ollamaModel: string;
  updatedBy?: number | null;
  updatedAt?: string | null;
};

export type AiChatSettingsRequest = {
  routingMode: AiChatRoutingMode;
  cloudflareModel: string;
  ollamaModel: string;
};

export type AiChatTestRequest = {
  provider: AiChatTestProvider;
  message: string;
};

export type AiChatTestResponse = {
  provider: AiChatTestProvider;
  model: string;
  response: string;
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

function ensureSuccess<T>(
  response: {
    status: number;
    data: ApiEnvelope<T> | ErrorResponseBody;
  },
  fallback: string,
) {
  const responseStatus = readResponseStatus(response.data, response.status);
  const message = readErrorMessage(response.data, fallback);

  if (response.status < 200 || response.status >= 300 || responseStatus >= 400) {
    throw new Error(message);
  }

  const data = (response.data as ApiEnvelope<T>).data;

  if (!data) {
    throw new Error(message);
  }

  return data;
}

export async function getAdminAiSettings() {
  const response = await apiClient.get<
    ApiEnvelope<AiChatSettings> | ErrorResponseBody
  >("/admin/ai-settings", {
    validateStatus: () => true,
  });

  return ensureSuccess(response, "AI 모델 설정을 불러오지 못했습니다.");
}

export async function updateAdminAiSettings(payload: AiChatSettingsRequest) {
  const response = await apiClient.put<
    ApiEnvelope<AiChatSettings> | ErrorResponseBody
  >("/admin/ai-settings", payload, {
    validateStatus: () => true,
  });

  return ensureSuccess(response, "AI 모델 설정을 저장하지 못했습니다.");
}

export async function testAdminAiProvider(payload: AiChatTestRequest) {
  const response = await apiClient.post<
    ApiEnvelope<AiChatTestResponse> | ErrorResponseBody
  >("/admin/ai-settings/test", payload, {
    validateStatus: () => true,
  });

  return ensureSuccess(response, "AI 모델 테스트에 실패했습니다.");
}
