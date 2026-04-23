const USER_ID_CACHE_KEY = "rps-draft:user-id-map";

function readCachedUserIdMap() {
  if (typeof window === "undefined") {
    return {} as Record<number, string>;
  }

  try {
    const raw = window.sessionStorage.getItem(USER_ID_CACHE_KEY);

    if (!raw) {
      return {};
    }

    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const next: Record<number, string> = {};

    for (const [userPk, userId] of Object.entries(parsed)) {
      if (typeof userId !== "string" || !userId.trim()) {
        continue;
      }

      next[Number(userPk)] = userId;
    }

    return next;
  } catch {
    return {};
  }
}

function writeCachedUserIdMap(map: Record<number, string>) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.sessionStorage.setItem(USER_ID_CACHE_KEY, JSON.stringify(map));
  } catch {
    // noop
  }
}

export function getCachedRpsDraftUserIdMap() {
  return readCachedUserIdMap();
}

export function rememberRpsDraftUserIds(incoming: Record<number, string>) {
  const current = readCachedUserIdMap();
  let hasChanges = false;
  const next = { ...current };

  for (const [userPk, userId] of Object.entries(incoming)) {
    const numericUserPk = Number(userPk);

    if (!userId?.trim() || next[numericUserPk] === userId) {
      continue;
    }

    next[numericUserPk] = userId;
    hasChanges = true;
  }

  if (hasChanges) {
    writeCachedUserIdMap(next);
  }

  return hasChanges ? next : current;
}

export function mergeRpsDraftUserIdMap(
  current: Record<number, string>,
  incoming: Record<number, string>,
) {
  const cached = readCachedUserIdMap();
  let hasChanges = false;
  const next = { ...cached, ...current };

  if (Object.keys(cached).some((key) => !(Number(key) in current))) {
    hasChanges = true;
  }

  for (const [userPk, resolvedUserId] of Object.entries(incoming)) {
    const numericUserPk = Number(userPk);

    if (!resolvedUserId || next[numericUserPk] === resolvedUserId) {
      continue;
    }

    next[numericUserPk] = resolvedUserId;
    hasChanges = true;
  }

  if (hasChanges) {
    writeCachedUserIdMap(next);
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

  return resolvedUserIds[userPk] ?? "아이디 확인 필요";
}
