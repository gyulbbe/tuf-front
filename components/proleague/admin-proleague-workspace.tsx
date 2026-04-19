"use client";

import { useState } from "react";
import { DraftAdminConsole } from "@/components/proleague/draft-admin-console";
import { DraftLiveDashboard } from "@/components/proleague/draft-live-dashboard";
import { SurfaceCard } from "@/components/site/surface-card";

export function AdminProleagueWorkspace() {
  const [refreshSignal, setRefreshSignal] = useState(0);

  return (
    <div className="space-y-4">
      <DraftAdminConsole
        onDataChanged={() => {
          setRefreshSignal((current) => current + 1);
        }}
      />
      <SurfaceCard className="p-6">
        <p className="text-sm font-semibold text-foreground">7. 라이브 픽 진행</p>
        <p className="mt-2 text-sm leading-7 text-muted">
          세션 시작 이후 현재 턴 관리와 실제 픽은 아래 라이브 보드에서 진행하면 된다.
        </p>
      </SurfaceCard>
      <DraftLiveDashboard refreshSignal={refreshSignal} />
    </div>
  );
}
