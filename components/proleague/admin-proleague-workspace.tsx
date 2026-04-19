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
        <p className="text-sm font-semibold text-foreground">라이브 제어 보드</p>
        <p className="mt-2 text-sm leading-7 text-muted">
          아래 보드에는 start, pause, resume, extend, skip, finish와 실제 픽 진행이
          모여 있다. 위 관리자 콘솔은 준비/정리/보정 작업에 집중하고, 실시간 제어는
          여기서 처리하면 된다.
        </p>
      </SurfaceCard>
      <DraftLiveDashboard refreshSignal={refreshSignal} />
    </div>
  );
}
