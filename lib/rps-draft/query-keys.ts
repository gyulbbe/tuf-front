export const rpsDraftQueryKeys = {
  sessions: ["rpsDraft", "sessions"] as const,
  session: (sessionId: number) => ["rpsDraft", "session", sessionId] as const,
  teams: (sessionId: number) => ["rpsDraft", "teams", sessionId] as const,
  candidates: (sessionId: number) =>
    ["rpsDraft", "candidates", sessionId] as const,
  snapshot: (sessionId: number) =>
    ["rpsDraft", "snapshot", sessionId] as const,
  liveSubscription: (sessionId: number) =>
    `rps-draft-session-${sessionId.toString()}`,
};
