import type { ReactElement } from "react";

export function ScopeOverlay(): ReactElement {
  return (
    <div
      className="pointer-events-none absolute inset-0 text-white"
      style={{
        background:
          "radial-gradient(circle at center, transparent 0 23%, rgba(0,0,0,0.72) 23.4%, rgba(0,0,0,0.96) 100%)",
      }}
    >
      <span className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-white/75" />
      <span className="absolute left-0 top-1/2 h-px w-full -translate-y-1/2 bg-white/75" />
      <span className="absolute left-1/2 top-1/2 h-24 w-px -translate-x-1/2 -translate-y-1/2 bg-white" />
      <span className="absolute left-1/2 top-1/2 h-px w-24 -translate-x-1/2 -translate-y-1/2 bg-white" />
      <span className="absolute left-1/2 top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white" />
    </div>
  );
}
