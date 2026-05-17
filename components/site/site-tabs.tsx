"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import type { SiteSubTab, SiteTab } from "@/content/site";
import { isAdminRole } from "@/lib/auth/roles";
import {
  buildMenuVisibilityRecord,
  getSiteMenuVisibility,
} from "@/lib/api/menu-visibility";
import { cn } from "@/lib/utils";

type SiteTabsProps = {
  tabs: SiteTab[];
};

type MenuVisibilityRecord = Record<string, boolean>;
type TabTone = "primary" | "utility";

const ALWAYS_VISIBLE_MENU_KEYS = new Set(["admin", "admin.menuVisibility"]);
const MENU_VISIBILITY_CHANGED_EVENT = "site-menu-visibility-changed";
const HOME_TAB: SiteTab = {
  label: "홈",
  href: "/",
  description: "메인 화면으로 이동합니다.",
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

  return (
    items
      .filter((item) => !item.external && isPathActive(pathname, item.href))
      .sort(
        (left, right) => (right.href?.length ?? 0) - (left.href?.length ?? 0),
      )[0] ?? null
  );
}

function getDisplayLabel(label: string) {
  return label === "TuF 갤러리" ? "갤러리" : label;
}

function isUtilityTab(tab: SiteTab) {
  return tab.external || tab.menuKey === "game" || tab.menuKey === "admin";
}

function buildTabClassName(isActive: boolean, tone: TabTone) {
  return cn(
    "inline-flex min-h-9 items-center justify-center whitespace-nowrap rounded-full px-3.5 text-sm font-semibold transition-colors",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background",
    isActive
      ? "bg-foreground !text-white shadow-[0_8px_18px_rgba(23,33,43,0.16)]"
      : tone === "primary"
        ? "text-foreground hover:bg-white hover:text-accent-ink"
        : "border border-line bg-white text-foreground hover:border-accent hover:bg-accent-soft hover:text-accent-ink",
  );
}

function buildUnavailableClassName(tone: TabTone) {
  return cn(
    "inline-flex min-h-9 items-center justify-center whitespace-nowrap rounded-full border border-dashed border-line-strong px-3.5 text-sm font-semibold text-muted/80",
    tone === "primary" ? "bg-transparent" : "bg-white",
  );
}

function buildSubTabClassName(isActive: boolean) {
  return cn(
    "grid gap-1 rounded-lg border px-3 py-2.5 text-left transition-colors",
    isActive
      ? "border-accent bg-accent !text-white"
      : "border-transparent text-foreground hover:border-line hover:bg-surface-muted",
  );
}

function TabLink({
  href,
  label,
  description,
  className,
  unavailableClassName,
  onClick,
}: {
  href?: string;
  label: string;
  description: string;
  className: string;
  unavailableClassName: string;
  onClick?: () => void;
}) {
  if (!href) {
    return (
      <span title={`${description} URL 미연결`} className={unavailableClassName}>
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
  unavailableClassName,
  onClick,
}: {
  href?: string;
  label: string;
  description: string;
  className: string;
  unavailableClassName: string;
  onClick?: () => void;
}) {
  if (!href) {
    return (
      <span title={`${description} URL 미연결`} className={unavailableClassName}>
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
      onClick={onClick}
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
  onClick?: () => void;
}) {
  const className = buildSubTabClassName(isActive);
  const content = (
    <>
      <b className="text-sm font-semibold">{getDisplayLabel(item.label)}</b>
      <span
        className={cn(
          "text-xs leading-5",
          isActive ? "text-white/80" : "text-muted",
        )}
      >
        {item.description}
      </span>
    </>
  );

  if (item.external) {
    if (!item.href) {
      return (
        <span
          title={`${item.description} URL 미연결`}
          className="grid gap-1 rounded-lg border border-dashed border-line-strong bg-white px-3 py-2.5 text-left text-muted/80"
        >
          {content}
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
        {content}
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
      {content}
    </Link>
  );
}

function MegaMenuPanel({
  tab,
  activeSubTab,
  tone,
  onNavigate,
}: {
  tab: SiteTab;
  activeSubTab: SiteSubTab | null;
  tone: TabTone;
  onNavigate: () => void;
}) {
  return (
    <div
      role="menu"
      aria-label={`${getDisplayLabel(tab.label)} 하위 메뉴`}
      className={cn(
        "hidden pt-2 group-hover/menu:block group-focus-within/menu:block group-open/menu:block",
        "lg:absolute lg:top-full lg:z-[120] lg:w-[min(560px,calc(100vw-2rem))]",
        tone === "utility" ? "lg:right-0" : "lg:left-0",
      )}
    >
      <div className="rounded-lg border border-line bg-surface p-3 shadow-[0_18px_56px_rgba(23,33,43,0.12)]">
        <div className="mb-2 border-b border-line pb-3">
          <p className="text-sm font-bold text-foreground">
            {getDisplayLabel(tab.label)}
          </p>
          <p className="mt-1 text-xs leading-5 text-muted">{tab.description}</p>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {tab.items?.map((item) => (
            <SubTabItem
              key={item.href ?? item.label}
              item={item}
              isActive={!item.external && activeSubTab?.href === item.href}
              onClick={onNavigate}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function closeSiblingMenus(currentMenu: HTMLDetailsElement) {
  if (!currentMenu.open) {
    return;
  }

  currentMenu
    .closest("[data-site-menu-root]")
    ?.querySelectorAll<HTMLDetailsElement>("[data-site-menu]")
    .forEach((menu) => {
      if (menu !== currentMenu) {
        menu.open = false;
      }
    });
}

function closeMenus(root: HTMLElement | null) {
  root
    ?.querySelectorAll<HTMLDetailsElement>("[data-site-menu]")
    .forEach((menu) => {
      menu.open = false;
    });
}

function MenuTab({
  tab,
  tone,
  pathname,
  onNavigate,
}: {
  tab: SiteTab;
  tone: TabTone;
  pathname: string;
  onNavigate: () => void;
}) {
  const activeSubTab = findBestMatchingSubTab(pathname, tab.items);
  const isCurrentTabActive =
    !tab.external && (isPathActive(pathname, tab.href) || Boolean(activeSubTab));
  const label = getDisplayLabel(tab.label);
  const tabClassName = buildTabClassName(isCurrentTabActive, tone);

  return (
    <details
      className="group/menu relative z-30"
      data-site-menu
      onToggle={(event) => closeSiblingMenus(event.currentTarget)}
    >
      <summary
        title={tab.description}
        className={cn(
          tabClassName,
          "cursor-pointer list-none gap-2 group-open/menu:bg-foreground group-open/menu:!text-white [&::-webkit-details-marker]:hidden",
        )}
      >
        <span>{label}</span>
        <span aria-hidden="true" className="text-xs">
          ▾
        </span>
      </summary>
      <MegaMenuPanel
        tab={tab}
        activeSubTab={activeSubTab}
        tone={tone}
        onNavigate={onNavigate}
      />
    </details>
  );
}

function isMenuVisible(
  menuKey: string | undefined,
  menuVisibility: MenuVisibilityRecord,
) {
  if (!menuKey || ALWAYS_VISIBLE_MENU_KEYS.has(menuKey)) {
    return true;
  }

  return menuVisibility[menuKey] !== false;
}

function filterVisibleTabs(
  tabs: SiteTab[],
  canSeeAdminTab: boolean,
  menuVisibility: MenuVisibilityRecord,
) {
  return tabs
    .filter((tab) => !tab.requiresAdmin || canSeeAdminTab)
    .map((tab) => {
      const items = tab.items
        ?.filter((item) => !item.requiresAdmin || canSeeAdminTab)
        .filter((item) => isMenuVisible(item.menuKey, menuVisibility));

      return {
        ...tab,
        items,
      };
    })
    .filter((tab) => {
      if (!isMenuVisible(tab.menuKey, menuVisibility)) {
        return false;
      }

      if (tab.items) {
        return tab.items.length > 0;
      }

      return true;
    });
}

export function SiteTabs({ tabs }: SiteTabsProps) {
  const pathname = usePathname();
  const { user } = useAuth();
  const [menuVisibility, setMenuVisibility] = useState<MenuVisibilityRecord>({});
  const menuRootRef = useRef<HTMLDivElement | null>(null);
  const canSeeAdminTab = isAdminRole(user?.role);
  const visibleTabs = filterVisibleTabs(tabs, canSeeAdminTab, menuVisibility);
  const menuTabs = [HOME_TAB, ...visibleTabs];
  const primaryTabs = menuTabs.filter((tab) => !isUtilityTab(tab));
  const utilityTabs = menuTabs.filter(isUtilityTab);

  useEffect(() => {
    let cancelled = false;

    async function loadMenuVisibility() {
      try {
        const data = await getSiteMenuVisibility();

        if (!cancelled) {
          setMenuVisibility(buildMenuVisibilityRecord(data.items));
        }
      } catch {
        if (!cancelled) {
          setMenuVisibility({});
        }
      }
    }

    void loadMenuVisibility();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    function handleMenuVisibilityChanged(event: Event) {
      const detail = (event as CustomEvent<unknown>).detail;

      if (!Array.isArray(detail)) {
        return;
      }

      setMenuVisibility(buildMenuVisibilityRecord(detail));
    }

    window.addEventListener(
      MENU_VISIBILITY_CHANGED_EVENT,
      handleMenuVisibilityChanged,
    );
    return () => {
      window.removeEventListener(
        MENU_VISIBILITY_CHANGED_EVENT,
        handleMenuVisibilityChanged,
      );
    };
  }, []);

  useEffect(() => {
    closeMenus(menuRootRef.current);
  }, [pathname]);

  function handleNavigate() {
    closeMenus(menuRootRef.current);
  }

  function renderTab(tab: SiteTab, tone: TabTone) {
    const hasItems = Boolean(tab.items?.length);
    const activeSubTab = findBestMatchingSubTab(pathname, tab.items);
    const isCurrentTabActive =
      !tab.external &&
      (isPathActive(pathname, tab.href) || Boolean(activeSubTab));
    const label = getDisplayLabel(tab.label);
    const tabClassName = buildTabClassName(isCurrentTabActive, tone);
    const unavailableClassName = buildUnavailableClassName(tone);

    if (hasItems) {
      return (
        <MenuTab
          key={tab.href ?? tab.label}
          tab={tab}
          tone={tone}
          pathname={pathname}
          onNavigate={handleNavigate}
        />
      );
    }

    if (tab.external) {
      return (
        <ExternalTabLink
          key={tab.href ?? tab.label}
          href={tab.href}
          label={label}
          description={tab.description}
          className={tabClassName}
          unavailableClassName={unavailableClassName}
          onClick={handleNavigate}
        />
      );
    }

    return (
      <TabLink
        key={tab.href ?? tab.label}
        href={tab.href}
        label={label}
        description={tab.description}
        className={tabClassName}
        unavailableClassName={unavailableClassName}
        onClick={handleNavigate}
      />
    );
  }

  return (
    <div
      ref={menuRootRef}
      className="relative z-20 grid min-w-0 gap-2 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-start"
      data-site-menu-root
    >
      <nav
        className="relative z-20 min-w-0 rounded-lg border border-white/25 bg-white/75 p-1 shadow-[0_12px_34px_rgba(0,0,0,0.12)] backdrop-blur-md"
        aria-label="주요 메뉴"
      >
        <div className="flex flex-wrap items-center gap-1">
          {primaryTabs.map((tab) => renderTab(tab, "primary"))}
        </div>
      </nav>

      {utilityTabs.length > 0 ? (
        <nav className="relative z-20 min-w-0" aria-label="유틸 메뉴">
          <div className="flex flex-wrap items-center gap-1 xl:justify-end">
            {utilityTabs.map((tab) => renderTab(tab, "utility"))}
          </div>
        </nav>
      ) : null}
    </div>
  );
}
