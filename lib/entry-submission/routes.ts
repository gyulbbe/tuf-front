export const ENTRY_SUBMISSION_BASE_PATH = "/draft/entry";

export function entrySubmissionSessionPath(sessionId: number) {
  return `${ENTRY_SUBMISSION_BASE_PATH}/${sessionId}`;
}
