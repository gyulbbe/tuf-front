export const RPS_DRAFT_BASE_PATH = "/draft/rps";

export function rpsDraftListPath() {
  return RPS_DRAFT_BASE_PATH;
}

export function rpsDraftSessionPath(sessionId: number) {
  return `${RPS_DRAFT_BASE_PATH}/${sessionId}`;
}

export function rpsDraftLivePath(sessionId: number) {
  return `${rpsDraftSessionPath(sessionId)}/live`;
}
