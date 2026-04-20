"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const ADMIN_DRAFT_TABS = [
  {
    href: "/admin/draft",
    label: "드래프트 관리",
    description: "세션, 팀, 픽커, 드래프트 인원, 순서를 준비한다.",
  },
  {
    href: "/admin/draft/history",
    label: "드래프트 이력",
    description: "픽 기록을 정리하고 다시 맞춘다.",
  },
];

export function AdminDraftTabs() {
  const pathname = usePathname();

  return (
    <div className="grid gap-3 md:grid-cols-2">
      {ADMIN_DRAFT_TABS.map((tab) => {
        const isActive =
          pathname === tab.href ||
          (tab.href !== "/admin/draft" && pathname.startsWith(`${tab.href}/`));

        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "rounded-[24px] border px-5 py-4 transition-colors",
              isActive
                ? "border-accent-soft bg-white text-foreground shadow-[0_18px_50px_-40px_rgba(31,42,40,0.7)]"
                : "border-line bg-surface-strong text-muted hover:border-accent-soft hover:bg-white hover:text-foreground",
            )}
          >
            <p className="text-sm font-semibold">{tab.label}</p>
            <p className="mt-2 text-sm leading-6">{tab.description}</p>
          </Link>
        );
      })}
    </div>
  );
}
