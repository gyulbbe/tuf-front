import type { RpsDraftUserSearchResult } from "@/lib/api/rps-draft";

export function resolveRpsDraftUserId(
  targetUserPk: number,
  fallbackText: string | null | undefined,
  users: RpsDraftUserSearchResult[],
) {
  const exactPkMatch = users.find((user) => user.id === targetUserPk);

  if (exactPkMatch) {
    return exactPkMatch.userId;
  }

  const normalizedFallbackText = fallbackText?.trim().toLowerCase();

  if (!normalizedFallbackText) {
    return null;
  }

  const exactTextMatch = users.find((user) => {
    const normalizedUserId = user.userId.trim().toLowerCase();
    const normalizedDisplayName = user.name?.trim().toLowerCase();

    return (
      normalizedUserId === normalizedFallbackText ||
      normalizedDisplayName === normalizedFallbackText
    );
  });

  return exactTextMatch?.userId ?? null;
}

export function mergeRpsDraftUserIdMap(
  current: Record<number, string>,
  incoming: Record<number, string>,
) {
  let hasChanges = false;
  const next = { ...current };

  for (const [userPk, resolvedUserId] of Object.entries(incoming)) {
    const numericUserPk = Number(userPk);

    if (!resolvedUserId || current[numericUserPk] === resolvedUserId) {
      continue;
    }

    next[numericUserPk] = resolvedUserId;
    hasChanges = true;
  }

  return hasChanges ? next : current;
}

export function formatRpsDraftUserId(
  userPk: number | null | undefined,
  resolvedUserIds: Record<number, string>,
  fallback = "지정 안 됨",
) {
  if (typeof userPk !== "number") {
    return fallback;
  }

  return resolvedUserIds[userPk] ?? `user_pk:${userPk}`;
}
