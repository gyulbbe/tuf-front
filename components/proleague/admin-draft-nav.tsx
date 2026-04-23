"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const draftAdminTabs = [
  {
    href: "/admin/draft",
    label: "진행 관리",
    match: (pathname: string) => pathname === "/admin/draft",
  },
  {
    href: "/admin/draft/history",
    label: "종료 이력",
    match: (pathname: string) => pathname.startsWith("/admin/draft/history"),
  },
] as const;

function buildTabClassName(isActive: boolean) {
  return cn(
    "inline-flex items-center justify-center rounded-full px-4 py-2 text-sm font-medium transition-colors",
    isActive
      ? "bg-accent text-white"
      : "border border-line text-muted hover:border-accent-soft hover:bg-surface-strong hover:text-foreground",
  );
}

export function AdminDraftNav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-wrap gap-2" aria-label="관리자 드래프트 탭">
      {draftAdminTabs.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          className={buildTabClassName(tab.match(pathname))}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
