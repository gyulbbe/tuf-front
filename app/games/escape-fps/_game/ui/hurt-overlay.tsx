import type { ReactElement } from "react";

type HurtOverlayProps = {
  alpha: number;
};

export function HurtOverlay({ alpha }: HurtOverlayProps): ReactElement | null {
  if (alpha <= 0) {
    return null;
  }

  return (
    <div
      className="pointer-events-none fixed inset-0"
      style={{
        background:
          "radial-gradient(circle at center, transparent 30%, rgba(180, 0, 0, 0.5) 100%)",
        opacity: alpha,
      }}
    />
  );
}
