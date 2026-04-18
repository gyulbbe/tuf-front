import type { ReactNode } from "react";
import { SurfaceCard } from "@/components/site/surface-card";

type TabPageShellProps = {
  label: string;
  title: string;
  description: string;
  children: ReactNode;
  sidebar: ReactNode;
};

export function TabPageShell({
  label,
  title,
  description,
  children,
  sidebar,
}: TabPageShellProps) {
  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)]">
      <SurfaceCard className="flex min-h-[440px] flex-col p-7 sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-accent">
          {label}
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          {title}
        </h1>
        <p className="mt-4 max-w-3xl text-base leading-8 text-muted">
          {description}
        </p>
        <div className="mt-8 flex-1">{children}</div>
      </SurfaceCard>

      <div className="grid gap-4">{sidebar}</div>
    </div>
  );
}
