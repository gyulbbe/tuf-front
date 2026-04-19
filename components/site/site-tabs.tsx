"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { SiteTab } from "@/content/site";
import { cn } from "@/lib/utils";

type SiteTabsProps = {
  tabs: SiteTab[];
};

export function SiteTabs({ tabs }: SiteTabsProps) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-wrap gap-2" aria-label="Primary tabs">
      {tabs.map((tab) => {
        const isActive = !tab.external && pathname === tab.href;
        const tabClassName = cn(
          "rounded-full px-4 py-2 text-sm transition-colors",
          isActive
            ? "bg-accent text-white"
            : "border border-line text-muted hover:border-accent-soft hover:bg-surface-strong hover:text-foreground",
        );

        if (tab.external) {
          if (tab.href) {
            return (
              <a
                key={tab.label}
                href={tab.href}
                target="_blank"
                rel="noreferrer noopener"
                title={tab.description}
                className={tabClassName}
              >
                {tab.label}
              </a>
            );
          }

          return (
            <span
              key={tab.label}
              title={`${tab.description} URL 준비 후 연결됩니다.`}
              className="rounded-full border border-dashed border-line px-4 py-2 text-sm text-muted/80"
            >
              {tab.label}
            </span>
          );
        }

        return (
          <Link
            key={tab.href}
            href={tab.href ?? "/notice"}
            title={tab.description}
            className={tabClassName}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
