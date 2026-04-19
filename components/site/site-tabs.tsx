"use client";

import type { FocusEvent } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import type { SiteSubTab, SiteTab } from "@/content/site";
import { cn } from "@/lib/utils";

type SiteTabsProps = {
  tabs: SiteTab[];
};

function isPathActive(pathname: string, href?: string) {
  if (!href) {
    return false;
  }

  if (pathname === href) {
    return true;
  }

  if (href === "/") {
    return pathname === href;
  }

  return pathname.startsWith(`${href}/`);
}

function buildTabClassName(isActive: boolean) {
  return cn(
    "rounded-full px-4 py-2 text-sm transition-colors",
    isActive
      ? "bg-accent text-white"
      : "border border-line text-muted hover:border-accent-soft hover:bg-surface-strong hover:text-foreground",
  );
}

function buildSubTabClassName(isActive: boolean) {
  return cn(
    "block rounded-[18px] px-4 py-3 text-sm transition-colors",
    isActive
      ? "bg-accent text-white"
      : "text-foreground hover:bg-surface-muted",
  );
}

function TabLink({
  href,
  label,
  description,
  className,
  onClick,
}: {
  href?: string;
  label: string;
  description: string;
  className: string;
  onClick?: () => void;
}) {
  if (!href) {
    return (
      <span
        title={`${description} URL 미연결`}
        className="rounded-full border border-dashed border-line px-4 py-2 text-sm text-muted/80"
      >
        {label}
      </span>
    );
  }

  return (
    <Link href={href} title={description} className={className} onClick={onClick}>
      {label}
    </Link>
  );
}

function ExternalTabLink({
  href,
  label,
  description,
  className,
}: {
  href?: string;
  label: string;
  description: string;
  className: string;
}) {
  if (!href) {
    return (
      <span
        title={`${description} URL 미연결`}
        className="rounded-full border border-dashed border-line px-4 py-2 text-sm text-muted/80"
      >
        {label}
      </span>
    );
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      title={description}
      className={className}
    >
      {label}
    </a>
  );
}

function SubTabItem({
  item,
  isActive,
  onClick,
}: {
  item: SiteSubTab;
  isActive: boolean;
  onClick: () => void;
}) {
  const className = buildSubTabClassName(isActive);

  if (item.external) {
    if (!item.href) {
      return (
        <span
          title={`${item.description} URL 미연결`}
          className="block rounded-[18px] border border-dashed border-line px-4 py-3 text-sm text-muted/80"
        >
          {item.label}
        </span>
      );
    }

    return (
      <a
        href={item.href}
        target="_blank"
        rel="noreferrer noopener"
        title={item.description}
        className={className}
        onClick={onClick}
      >
        {item.label}
      </a>
    );
  }

  return (
    <Link
      href={item.href ?? "/notice"}
      title={item.description}
      className={className}
      onClick={onClick}
    >
      {item.label}
    </Link>
  );
}

export function SiteTabs({ tabs }: SiteTabsProps) {
  const pathname = usePathname();
  const [openMenuKey, setOpenMenuKey] = useState<string | null>(null);

  function closeMenus() {
    setOpenMenuKey(null);
  }

  function handleTabBlur(
    event: FocusEvent<HTMLDivElement>,
    menuKey: string | null,
  ) {
    if (!menuKey) {
      return;
    }

    if (event.currentTarget.contains(event.relatedTarget)) {
      return;
    }

    setOpenMenuKey((current) => (current === menuKey ? null : current));
  }

  return (
    <nav className="flex flex-wrap gap-2" aria-label="Primary tabs">
      {tabs.map((tab) => {
        const menuKey = tab.href ?? tab.label;
        const hasItems = Boolean(tab.items?.length);
        const isCurrentTabActive =
          !tab.external &&
          (isPathActive(pathname, tab.href) ||
            Boolean(
              tab.items?.some(
                (item) => !item.external && isPathActive(pathname, item.href),
              ),
            ));
        const isMenuOpen = hasItems && openMenuKey === menuKey;
        const tabClassName = buildTabClassName(isCurrentTabActive);

        if (tab.external) {
          return (
            <ExternalTabLink
              key={tab.label}
              href={tab.href}
              label={tab.label}
              description={tab.description}
              className={tabClassName}
            />
          );
        }

        if (!hasItems) {
          return (
            <TabLink
              key={menuKey}
              href={tab.href}
              label={tab.label}
              description={tab.description}
              className={tabClassName}
              onClick={closeMenus}
            />
          );
        }

        return (
          <div
            key={menuKey}
            className="relative flex flex-col"
            onMouseEnter={() => setOpenMenuKey(menuKey)}
            onMouseLeave={() =>
              setOpenMenuKey((current) => (current === menuKey ? null : current))
            }
            onFocusCapture={() => setOpenMenuKey(menuKey)}
            onBlurCapture={(event) => handleTabBlur(event, menuKey)}
          >
            <div className="flex items-center gap-2">
              <TabLink
                href={tab.href}
                label={tab.label}
                description={tab.description}
                className={tabClassName}
                onClick={closeMenus}
              />

              <button
                type="button"
                aria-label={`${tab.label} 하위 메뉴`}
                aria-expanded={isMenuOpen}
                className={cn(
                  "rounded-full border border-line px-3 py-2 text-xs text-muted transition-colors hover:border-accent-soft hover:bg-surface-strong hover:text-foreground sm:hidden",
                  isMenuOpen && "border-accent bg-accent-soft text-accent-ink",
                )}
                onClick={() => {
                  setOpenMenuKey((current) => (current === menuKey ? null : menuKey));
                }}
              >
                메뉴
              </button>
            </div>

            <div
              className={cn(
                "hidden pt-2",
                isMenuOpen && "block",
                "sm:absolute sm:left-0 sm:top-full sm:z-30 sm:min-w-56",
              )}
            >
              <div className="rounded-[24px] border border-line bg-surface p-2 shadow-[0_24px_60px_-48px_rgba(31,42,40,0.65)] backdrop-blur-xl">
                <div className="space-y-1">
                  {tab.items?.map((item) => (
                    <SubTabItem
                      key={item.href ?? item.label}
                      item={item}
                      isActive={!item.external && isPathActive(pathname, item.href)}
                      onClick={closeMenus}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </nav>
  );
}
