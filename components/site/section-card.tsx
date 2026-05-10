import type { ComponentPropsWithoutRef } from "react";
import { cn } from "@/lib/utils";

type SectionCardProps = ComponentPropsWithoutRef<"article"> & {
  description: string;
  title: string;
};

export function SectionCard({
  className,
  description,
  title,
  ...props
}: SectionCardProps) {
  return (
    <article
      className={cn(
        "rounded-lg border border-line bg-surface-strong px-5 py-5",
        className,
      )}
      {...props}
    >
      <h2 className="text-lg font-semibold text-foreground">{title}</h2>
      <p className="mt-3 text-sm leading-7 text-muted">{description}</p>
    </article>
  );
}
