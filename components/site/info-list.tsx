import type { ComponentPropsWithoutRef } from "react";
import { cn } from "@/lib/utils";

type InfoListProps = ComponentPropsWithoutRef<"ul"> & {
  items: readonly string[];
  itemClassName?: string;
};

export function InfoList({
  className,
  itemClassName,
  items,
  ...props
}: InfoListProps) {
  return (
    <ul
      className={cn("mt-4 space-y-3 text-sm leading-7 text-muted", className)}
      {...props}
    >
      {items.map((item) => (
        <li
          key={item}
          className={cn(
            "rounded-lg bg-surface-muted px-4 py-3 text-foreground",
            itemClassName,
          )}
        >
          {item}
        </li>
      ))}
    </ul>
  );
}
