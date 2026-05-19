import axios from "axios";
import { apiClient } from "@/lib/api/client";

type ApiEnvelope<T> = {
  status?: number;
  message?: string;
  data?: T | null;
  error?: string;
};

type ErrorResponseBody = {
  status?: number;
  message?: string;
  error?: string;
};

export type AdminMap = {
  id: number;
  mapName: string;
  image: string | null;
  regDate: string | null;
  updateDate: string | null;
};

export type AdminMapPage = {
  items: AdminMap[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
};

export type AdminMapRequest = {
  mapName: string;
  image: string | null;
};

export type AdminMapListParams = {
  keyword?: string | null;
  page?: number;
  size?: number;
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

async function unwrapResponse<T>(
  request: Promise<{
    data: ApiEnvelope<T> | ErrorResponseBody | T;
    status: number;
  }>,
  fallback: string,
) {
  try {
    const response = await request;
    const responseStatus = readResponseStatus(response.data, response.status);
    const message = readErrorMessage(response.data, fallback);

    if (response.status < 200 || response.status >= 300 || responseStatus >= 400) {
      throw new Error(message);
    }

    const body = response.data as ApiEnvelope<T>;

    if ("data" in body) {
      if (body.data === null || body.data === undefined) {
        throw new Error(message);
      }

      return body.data;
    }

    return response.data as T;
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

async function unwrapVoidResponse(
  request: Promise<{
    data: ApiEnvelope<null> | ErrorResponseBody | null;
    status: number;
  }>,
  fallback: string,
) {
  try {
    const response = await request;
    const responseStatus = readResponseStatus(response.data, response.status);
    const message = readErrorMessage(response.data, fallback);

    if (response.status < 200 || response.status >= 300 || responseStatus >= 400) {
      throw new Error(message);
    }
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

function readString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function readNullableString(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();

  return trimmed || null;
}

function readNumber(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function readBoolean(value: unknown, fallback = false) {
  return typeof value === "boolean" ? value : fallback;
}

function normalizeAdminMap(value: unknown): AdminMap {
  const raw = value && typeof value === "object" ? (value as Record<string, unknown>) : {};

  return {
    id: readNumber(raw.id),
    mapName: readString(raw.mapName, "맵"),
    image: readNullableString(raw.image),
    regDate: readNullableString(raw.regDate),
    updateDate: readNullableString(raw.updateDate),
  };
}

function normalizeAdminMapPage(value: unknown, fallbackPage = 0, fallbackSize = 20) {
  if (Array.isArray(value)) {
    const items = value.map((item) => normalizeAdminMap(item));

    return {
      items,
      page: fallbackPage,
      size: fallbackSize,
      totalElements: items.length,
      totalPages: items.length > 0 ? 1 : 0,
      hasNext: false,
      hasPrevious: fallbackPage > 0,
    };
  }

  const raw = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const rawItems = Array.isArray(raw.items)
    ? raw.items
    : Array.isArray(raw.content)
      ? raw.content
      : [];

  return {
    items: rawItems.map((item) => normalizeAdminMap(item)),
    page: readNumber(raw.page, fallbackPage),
    size: readNumber(raw.size, fallbackSize),
    totalElements: readNumber(raw.totalElements, rawItems.length),
    totalPages: readNumber(raw.totalPages, rawItems.length > 0 ? 1 : 0),
    hasNext: readBoolean(raw.hasNext),
    hasPrevious: readBoolean(raw.hasPrevious, fallbackPage > 0),
  };
}

export async function listAdminMaps(params: AdminMapListParams = {}) {
  const keyword = params.keyword?.trim();
  const page = params.page ?? 0;
  const size = params.size ?? 20;
  const data = await unwrapResponse<AdminMapPage | AdminMap[]>(
    apiClient.get<ApiEnvelope<AdminMapPage | AdminMap[]> | AdminMapPage | AdminMap[]>(
      "/admin/maps",
      {
        params: {
          keyword: keyword || undefined,
          page,
          size,
        },
        validateStatus: () => true,
      },
    ),
    "맵 목록을 불러오지 못했습니다.",
  );

  return normalizeAdminMapPage(data, page, size);
}

export async function createAdminMap(payload: AdminMapRequest) {
  const data = await unwrapResponse<AdminMap>(
    apiClient.post<ApiEnvelope<AdminMap> | AdminMap>("/admin/maps", payload, {
      validateStatus: () => true,
    }),
    "맵을 추가하지 못했습니다.",
  );

  return normalizeAdminMap(data);
}

export async function updateAdminMap(mapId: number, payload: AdminMapRequest) {
  const data = await unwrapResponse<AdminMap>(
    apiClient.put<ApiEnvelope<AdminMap> | AdminMap>(`/admin/maps/${mapId}`, payload, {
      validateStatus: () => true,
    }),
    "맵을 수정하지 못했습니다.",
  );

  return normalizeAdminMap(data);
}

export async function deleteAdminMap(mapId: number) {
  return unwrapVoidResponse(
    apiClient.delete<ApiEnvelope<null> | null>(`/admin/maps/${mapId}`, {
      validateStatus: () => true,
    }),
    "맵을 삭제하지 못했습니다.",
  );
}
