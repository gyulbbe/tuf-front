type ClanShareResponseBody = {
  message?: string;
  ok?: boolean;
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

async function readMessage(response: Response) {
  const body = (await response.json().catch(() => null)) as
    | ClanShareResponseBody
    | null;

  return body?.message || "clan-share 전송에 실패했습니다.";
}

export async function submitClanShareMatches(matches: ClanShareMatchPayload[]) {
  const response = await fetch("/api/clan-share", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ matches }),
  });

  if (!response.ok) {
    throw new Error(await readMessage(response));
  }
}
