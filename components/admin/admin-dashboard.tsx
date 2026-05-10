"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { SurfaceCard } from "@/components/site/surface-card";
import {
  buildMenuVisibilityRecord,
  getSiteMenuVisibility,
} from "@/lib/api/menu-visibility";

type MenuVisibilityRecord = Record<string, boolean>;

type AdminTool = {
  href: string;
  title: string;
  description: string;
  menuKey?: string;
  alwaysVisible?: boolean;
};

const adminTools: AdminTool[] = [
  {
    href: "/admin/draft/history",
    title: "드래프트 종료 이력",
    description: "종료된 드래프트 기록과 이력을 관리자 화면에서 확인합니다.",
    menuKey: "admin.draftHistory",
  },
  {
    href: "/admin/users",
    title: "사용자 관리",
    description: "사용자 목록 조회, 등록, 수정, 비활성화와 재활성화를 처리합니다.",
    menuKey: "admin.users",
  },
  {
    href: "/admin/menu-visibility",
    title: "메뉴 설정",
    description: "상단 메뉴와 관리자 메뉴의 노출 여부를 관리합니다.",
    alwaysVisible: true,
  },
];

function isToolVisible(tool: AdminTool, menuVisibility: MenuVisibilityRecord) {
  if (tool.alwaysVisible || !tool.menuKey) {
    return true;
  }

  return menuVisibility[tool.menuKey] !== false;
}

export function AdminDashboard() {
  const [menuVisibility, setMenuVisibility] = useState<MenuVisibilityRecord>({});

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

  const visibleTools = adminTools.filter((tool) =>
    isToolVisible(tool, menuVisibility),
  );

  return (
    <SurfaceCard className="p-7 sm:p-8">
      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-accent">
        Admin
      </p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
        관리자 작업 공간
      </h1>
      <p className="mt-4 max-w-2xl text-base leading-8 text-muted">
        드래프트 종료 이력, 사용자 관리, 메뉴 설정을 관리자 전용 화면에서 처리합니다.
      </p>

      <div className="mt-8 grid gap-4 md:grid-cols-2 xl:max-w-4xl">
        {visibleTools.map((tool) => (
          <Link
            key={tool.href}
            href={tool.href}
            className="rounded-lg border border-line bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(238,243,247,0.92)_100%)] px-6 py-6 shadow-[0_16px_50px_rgba(23,33,43,0.08)] transition-colors hover:border-accent-soft hover:bg-white"
          >
            <p className="text-lg font-semibold text-foreground">{tool.title}</p>
            <p className="mt-3 text-sm leading-7 text-muted">{tool.description}</p>
          </Link>
        ))}
      </div>
    </SurfaceCard>
  );
}
