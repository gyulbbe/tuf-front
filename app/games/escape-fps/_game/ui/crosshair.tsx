import type { ReactElement } from "react";

type CrosshairProps = {
  isAiming: boolean;
};

export function Crosshair({ isAiming }: CrosshairProps): ReactElement {
  const sizeClass = isAiming ? "h-6 w-6" : "h-8 w-8";

  return (
    <div
      className={`pointer-events-none absolute left-1/2 top-1/2 ${sizeClass} -translate-x-1/2 -translate-y-1/2`}
    >
      <span className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-white/80" />
      <span className="absolute left-0 top-1/2 h-px w-full -translate-y-1/2 bg-white/80" />
      <span className="absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/70 bg-black/30" />
    </div>
  );
}
