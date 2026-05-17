import { apiClient } from "@/lib/api/client";

type ApiEnvelope<T> = {
  status?: number;
  message?: string;
  data?: T | null;
};

export type DraftUserSearchResult = {
  id: number;
  userId: string;
  tier: string | null;
  race: string | null;
};

function readSearchResults(value: unknown): DraftUserSearchResult[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.reduce<DraftUserSearchResult[]>((results, item) => {
    if (!item || typeof item !== "object") {
      return results;
    }

    const candidate = item as Partial<DraftUserSearchResult>;

    if (typeof candidate.id !== "number" || typeof candidate.userId !== "string") {
      return results;
    }

    const userId = candidate.userId.trim();

    if (!userId) {
      return results;
    }

    results.push({
      id: candidate.id,
      userId,
      tier: typeof candidate.tier === "string" ? candidate.tier : null,
      race: typeof candidate.race === "string" ? candidate.race : null,
    });
    return results;
  }, []);
}

export async function searchDraftUsers(keyword: string, limit = 8) {
  const response = await apiClient.get<ApiEnvelope<DraftUserSearchResult[]>>(
    "/user/draft-search",
    {
      params: {
        keyword,
        limit,
      },
      validateStatus: () => true,
    },
  );
  const body = response.data;
  const envelopeStatus = typeof body.status === "number" ? body.status : response.status;

  if (response.status >= 200 && response.status < 300 && envelopeStatus < 400) {
    return readSearchResults(body.data);
  }

  throw new Error(body.message?.trim() || "유저 검색 결과를 불러오지 못했습니다.");
}
