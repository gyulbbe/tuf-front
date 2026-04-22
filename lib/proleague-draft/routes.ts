export const PROLEAGUE_DRAFT_BASE_PATH = "/proleague/draft";

export function proleagueDraftListPath() {
  return PROLEAGUE_DRAFT_BASE_PATH;
}

export function proleagueDraftSessionPath(sessionId: number) {
  return `${PROLEAGUE_DRAFT_BASE_PATH}/${sessionId}`;
}

export function proleagueDraftLivePath(sessionId: number) {
  return `${proleagueDraftSessionPath(sessionId)}/live`;
}
