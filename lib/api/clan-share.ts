type ClanShareResponseBody = {
  message?: string;
  ok?: boolean;
};

async function readMessage(response: Response) {
  const body = (await response.json().catch(() => null)) as
    | ClanShareResponseBody
    | null;

  return body?.message || "clan-share 전송에 실패했습니다.";
}

export async function submitClanShareTestPayload() {
  const response = await fetch("/api/clan-share", {
    method: "POST",
  });

  if (!response.ok) {
    throw new Error(await readMessage(response));
  }
}
