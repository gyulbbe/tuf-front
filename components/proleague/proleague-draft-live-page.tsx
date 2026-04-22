"use client";

import { DraftLiveDashboard } from "@/components/proleague/draft-live-dashboard";

export function ProleagueDraftLivePage({ sessionId }: { sessionId: number }) {
  return (
    <DraftLiveDashboard
      hideSessionPicker
      sessionId={sessionId}
      variant="proleague"
    />
  );
}
