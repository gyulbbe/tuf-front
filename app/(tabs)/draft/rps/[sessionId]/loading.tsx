import { SurfaceCard } from "@/components/site/surface-card";

export default function DraftRpsSessionLoading() {
  return (
    <div className="grid gap-4">
      <SurfaceCard className="p-6 sm:p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-4 w-20 rounded-full bg-surface-muted" />
          <div className="h-10 w-72 rounded-2xl bg-surface-muted" />
          <div className="h-5 w-full max-w-2xl rounded-2xl bg-surface-muted" />
          <div className="h-12 w-full max-w-sm rounded-full bg-surface-muted" />
        </div>
      </SurfaceCard>

      <div className="grid gap-4 lg:grid-cols-2">
        {Array.from({ length: 2 }).map((_, index) => (
          <SurfaceCard key={index} className="p-5 sm:p-6">
            <div className="animate-pulse space-y-4">
              <div className="h-6 w-28 rounded-full bg-surface-muted" />
              <div className="h-8 w-40 rounded-2xl bg-surface-muted" />
              <div className="h-5 w-full rounded-2xl bg-surface-muted" />
              <div className="h-20 w-full rounded-[22px] bg-surface-muted" />
            </div>
          </SurfaceCard>
        ))}
      </div>

      <SurfaceCard className="p-6 sm:p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-40 rounded-2xl bg-surface-muted" />
          <div className="h-5 w-full max-w-2xl rounded-2xl bg-surface-muted" />
          <div className="grid gap-3">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="h-20 rounded-[22px] bg-surface-muted" />
            ))}
          </div>
        </div>
      </SurfaceCard>
    </div>
  );
}
