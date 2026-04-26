import { apiClient } from "@/lib/api/client";

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

export type SiteMenuVisibilityItem = {
  menuKey: string;
  visible: boolean;
};

export type SiteMenuVisibilityData = {
  items: SiteMenuVisibilityItem[];
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

function normalizeVisibilityItem(value: Partial<SiteMenuVisibilityItem>) {
  if (typeof value.menuKey !== "string" || !value.menuKey.trim()) {
    return null;
  }

  return {
    menuKey: value.menuKey.trim(),
    visible: value.visible !== false,
  };
}

async function unwrapMenuVisibilityResponse(
  request: Promise<{
    status: number;
    data: ApiEnvelope<SiteMenuVisibilityData> | ErrorResponseBody;
  }>,
  fallback: string,
) {
  const response = await request;
  const responseStatus = readResponseStatus(response.data, response.status);
  const message = readErrorMessage(response.data, fallback);

  if (response.status < 200 || response.status >= 300 || responseStatus >= 400) {
    throw new Error(message);
  }

  const body = response.data as ApiEnvelope<SiteMenuVisibilityData>;
  const items = body.data?.items;

  if (!Array.isArray(items)) {
    throw new Error(message);
  }

  return {
    items: items
      .map((item) => normalizeVisibilityItem(item))
      .filter((item): item is SiteMenuVisibilityItem => item !== null),
  };
}

export function buildMenuVisibilityRecord(items: SiteMenuVisibilityItem[]) {
  return items.reduce<Record<string, boolean>>((record, item) => {
    record[item.menuKey] = item.visible;
    return record;
  }, {});
}

export async function getSiteMenuVisibility() {
  return unwrapMenuVisibilityResponse(
    apiClient.get<ApiEnvelope<SiteMenuVisibilityData> | ErrorResponseBody>(
      "/site/menu-visibility",
      {
        skipAuth: true,
        skipUnauthorizedHandler: true,
        validateStatus: () => true,
      },
    ),
    "메뉴 노출 설정을 불러오지 못했습니다.",
  );
}

export async function updateAdminMenuVisibility(
  items: SiteMenuVisibilityItem[],
) {
  return unwrapMenuVisibilityResponse(
    apiClient.put<ApiEnvelope<SiteMenuVisibilityData> | ErrorResponseBody>(
      "/admin/menu-visibility",
      { items },
      {
        validateStatus: () => true,
      },
    ),
    "메뉴 노출 설정을 저장하지 못했습니다.",
  );
}
