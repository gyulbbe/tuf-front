import type { ComponentPropsWithoutRef } from "react";
import { cn } from "@/lib/utils";

type SurfaceCardProps = ComponentPropsWithoutRef<"div">;

export function SurfaceCard({ className, ...props }: SurfaceCardProps) {
  return (
    <div
      className={cn(
        "rounded-[30px] border border-line bg-surface p-6 shadow-[0_24px_60px_-48px_rgba(31,42,40,0.65)] backdrop-blur-xl sm:p-8",
        className,
      )}
      {...props}
    />
  );
}
