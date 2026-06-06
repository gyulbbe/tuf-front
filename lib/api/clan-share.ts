type ClanShareResponseBody = {
  failureCount?: number;
  message?: string;
  ok?: boolean;
  successCount?: number;
  total?: number;
};

export type ClanShareMatchPayload = {
  player1: string;
  player2: string;
  winner: string;
  loser: string;
  map: string;
  matchType: "개인리그" | "끝장전" | "종족 최강전";
  matchName: string;
  playedDate: string;
};

export type ClanShareSubmitResult = {
  failureCount: number;
  ok: boolean;
  successCount: number;
  total: number;
};

async function readResponseBody(response: Response) {
  return (await response.json().catch(() => null)) as
    | ClanShareResponseBody
    | null;
}

function toSubmitResult(body: ClanShareResponseBody | null): ClanShareSubmitResult {
  return {
    failureCount: body?.failureCount ?? 0,
    ok: body?.ok ?? true,
    successCount: body?.successCount ?? 0,
    total: body?.total ?? 0,
  };
}

export async function submitClanShareMatches(matches: ClanShareMatchPayload[]) {
  const response = await fetch("/api/clan-share", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ matches }),
  });
  const body = await readResponseBody(response);

  if (!response.ok) {
    throw new Error(body?.message || "clan-share 전송에 실패했습니다.");
  }

  return toSubmitResult(body);
}
