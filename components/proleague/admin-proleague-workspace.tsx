"use client";

import { useState } from "react";
import { DraftAdminConsole } from "@/components/proleague/draft-admin-console";
import { DraftLiveDashboard } from "@/components/proleague/draft-live-dashboard";

export function AdminProleagueWorkspace() {
  const [refreshSignal, setRefreshSignal] = useState(0);

  return (
    <div className="space-y-4">
      <DraftAdminConsole
        onDataChanged={() => {
          setRefreshSignal((current) => current + 1);
        }}
      />
      <DraftLiveDashboard refreshSignal={refreshSignal} />
    </div>
  );
}
