import { apiClient } from "@/lib/api/client";

export type RequestChatDto = {
  userId: string;
  text: string;
};

export type ResponseDtoString = {
  status?: number;
  message?: string;
  data?: string | null;
};

type ErrorResponseBody = {
  message?: string;
  error?: string;
};

function readChatErrorMessage(data: unknown, fallback: string) {
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

export async function requestTufBotChat(payload: RequestChatDto) {
  const response = await apiClient.post<ResponseDtoString>("/chat", payload, {
    validateStatus: () => true,
  });

  if (response.status < 200 || response.status >= 300) {
    throw new Error(
      readChatErrorMessage(
        response.data,
        "터프봇 응답을 가져오지 못했습니다. 잠시 후 다시 시도해 주세요.",
      ),
    );
  }

  const text = response.data?.data;

  return {
    status: response.data?.status ?? response.status,
    message: response.data?.message ?? "success",
    data:
      typeof text === "string" && text.trim()
        ? text
        : "지금은 답변을 만들지 못했어요. 잠시 후 다시 물어봐 주세요.",
  };
}
