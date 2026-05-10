import type { ComponentPropsWithoutRef } from "react";
import { cn } from "@/lib/utils";

type SurfaceCardProps = ComponentPropsWithoutRef<"div">;

export function SurfaceCard({ className, ...props }: SurfaceCardProps) {
  return (
    <div
      className={cn(
        "rounded-lg border border-line bg-surface p-6 shadow-[0_16px_50px_rgba(23,33,43,0.08)] sm:p-8",
        className,
      )}
      {...props}
    />
  );
}
