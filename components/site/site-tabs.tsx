"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import type { SiteSubTab, SiteTab } from "@/content/site";
import { isAdminRole } from "@/lib/auth/roles";
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

function findBestMatchingSubTab(
  pathname: string,
  items: SiteSubTab[] | undefined,
) {
  if (!items?.length) {
    return null;
  }

  return items
    .filter((item) => !item.external && isPathActive(pathname, item.href))
    .sort((left, right) => (right.href?.length ?? 0) - (left.href?.length ?? 0))[0] ?? null;
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

function TabTrigger({
  label,
  description,
  className,
  isOpen,
  onClick,
}: {
  label: string;
  description: string;
  className: string;
  isOpen: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={description}
      aria-label={`${label} 메뉴`}
      aria-haspopup="menu"
      aria-expanded={isOpen}
      className={className}
      onClick={onClick}
    >
      {label}
    </button>
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
      href={item.href ?? "/gallery"}
      title={item.description}
      className={className}
      onClick={onClick}
    >
      {item.label}
    </Link>
  );
}

function filterVisibleTabs(tabs: SiteTab[], canSeeAdminTab: boolean) {
  return tabs
    .filter((tab) => !tab.requiresAdmin || canSeeAdminTab)
    .map((tab) => ({
      ...tab,
      items: tab.items?.filter((item) => !item.requiresAdmin || canSeeAdminTab),
    }));
}

export function SiteTabs({ tabs }: SiteTabsProps) {
  const pathname = usePathname();
  const { user } = useAuth();
  const [openMenuState, setOpenMenuState] = useState<{
    key: string | null;
    pathname: string | null;
  }>({ key: null, pathname: null });
  const navRef = useRef<HTMLElement | null>(null);
  const canSeeAdminTab = isAdminRole(user?.role);
  const visibleTabs = filterVisibleTabs(tabs, canSeeAdminTab);
  const openMenuKey =
    openMenuState.pathname === pathname ? openMenuState.key : null;

  useEffect(() => {
    if (!openMenuKey) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      if (navRef.current?.contains(event.target as Node)) {
        return;
      }

      setOpenMenuState({ key: null, pathname });
    }

    document.addEventListener("pointerdown", handlePointerDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [openMenuKey, pathname]);

  function updateOpenMenuKey(
    nextKeyOrUpdater: string | null | ((current: string | null) => string | null),
  ) {
    setOpenMenuState((current) => {
      const currentKey = current.pathname === pathname ? current.key : null;
      const nextKey =
        typeof nextKeyOrUpdater === "function"
          ? nextKeyOrUpdater(currentKey)
          : nextKeyOrUpdater;

      return {
        key: nextKey,
        pathname,
      };
    });
  }

  function closeMenus() {
    updateOpenMenuKey(null);
  }

  return (
    <nav ref={navRef} className="flex flex-wrap gap-2" aria-label="Primary tabs">
      {visibleTabs.map((tab) => {
        const menuKey = tab.href ?? tab.label;
        const hasItems = Boolean(tab.items?.length);
        const activeSubTab = findBestMatchingSubTab(pathname, tab.items);
        const isCurrentTabActive =
          !tab.external &&
          (isPathActive(pathname, tab.href) ||
            Boolean(activeSubTab));
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
            onMouseEnter={() => {
              if (hasItems) {
                updateOpenMenuKey(menuKey);
              }
            }}
            onMouseLeave={() => {
              if (hasItems) {
                updateOpenMenuKey((current) => (current === menuKey ? null : current));
              }
            }}
          >
            <div className="flex items-center gap-2">
              {tab.href ? (
                <TabLink
                  href={tab.href}
                  label={tab.label}
                  description={tab.description}
                  className={tabClassName}
                  onClick={closeMenus}
                />
              ) : (
                <TabTrigger
                  label={tab.label}
                  description={tab.description}
                  className={tabClassName}
                  isOpen={isMenuOpen}
                  onClick={() => {
                    updateOpenMenuKey((current) => (current === menuKey ? null : menuKey));
                  }}
                />
              )}

              {tab.href ? (
                <button
                  type="button"
                  aria-label={`${tab.label} 하위 메뉴`}
                  aria-expanded={isMenuOpen}
                  className={cn(
                    "rounded-full border border-line px-3 py-2 text-xs text-muted transition-colors hover:border-accent-soft hover:bg-surface-strong hover:text-foreground sm:hidden",
                    isMenuOpen && "border-accent bg-accent-soft text-accent-ink",
                  )}
                  onClick={() => {
                    updateOpenMenuKey((current) => (current === menuKey ? null : menuKey));
                  }}
                >
                  메뉴
                </button>
              ) : null}
            </div>

            <div
              className={cn(
                isMenuOpen ? "block pt-2" : "hidden pt-2",
                "sm:absolute sm:left-0 sm:top-full sm:z-30 sm:min-w-56",
              )}
            >
              <div className="rounded-[24px] border border-line bg-surface p-2 shadow-[0_24px_60px_-48px_rgba(31,42,40,0.65)] backdrop-blur-xl">
                <div className="space-y-1">
                  {tab.items?.map((item) => (
                    <SubTabItem
                      key={item.href ?? item.label}
                      item={item}
                      isActive={!item.external && activeSubTab?.href === item.href}
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
