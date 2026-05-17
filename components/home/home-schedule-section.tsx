"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  listHomeSchedules,
  type HomeSchedule,
  type HomeScheduleGroup,
  type HomeScheduleLinkType,
} from "@/lib/api/home-schedule";
import { SurfaceCard } from "@/components/site/surface-card";
import { cn } from "@/lib/utils";

const groupLabels: Record<HomeScheduleGroup, string> = {
  PROLEAGUE: "프로리그",
  PERSONAL_LEAGUE: "개인리그",
  NOTICE: "공지",
  BOT_BRIEFING: "터프봇 브리핑",
  ETC: "기타",
};

const linkTypeLabels: Record<HomeScheduleLinkType, string> = {
  DIRECT: "바로 이동",
  REDIRECT: "리다이렉트",
};

function formatDateTime(value: string | null | undefined) {
  if (!value) {
    return "-";
  }

  const timestamp = Date.parse(value);

  if (Number.isNaN(timestamp)) {
    return value.replace("T", " ").slice(0, 16);
  }

  return new Intl.DateTimeFormat("ko-KR", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(timestamp);
}

function getScheduleHref(schedule: HomeSchedule) {
  if (!schedule.targetUrl?.trim()) {
    return null;
  }

  return schedule.navigationUrl;
}

function isInternalDirectLink(schedule: HomeSchedule, href: string) {
  return (
    schedule.linkType === "DIRECT" &&
    href.startsWith("/")
  );
}

function ScheduleCard({ schedule }: { schedule: HomeSchedule }) {
  const href = getScheduleHref(schedule);
  const content = (
    <div
      className={cn(
        "h-full rounded-lg border border-line bg-surface-strong px-5 py-5 transition-colors",
        href
          ? "hover:border-accent hover:bg-white"
          : "cursor-default opacity-80",
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-accent-soft px-3 py-1 text-xs font-semibold text-accent-ink">
          {groupLabels[schedule.scheduleGroup]}
        </span>
        <span className="rounded-full bg-surface-muted px-3 py-1 text-xs font-semibold text-muted">
          {linkTypeLabels[schedule.linkType]}
        </span>
      </div>
      <p className="mt-4 text-sm font-semibold text-muted">
        {schedule.timeLabel || formatDateTime(schedule.scheduledAt)}
      </p>
      <p className="mt-2 truncate text-lg font-semibold text-foreground">
        {schedule.title}
      </p>
      {schedule.description ? (
        <p className="mt-2 overflow-hidden text-ellipsis text-sm leading-6 text-muted">
          {schedule.description}
        </p>
      ) : null}
    </div>
  );

  if (!href) {
    return content;
  }

  if (isInternalDirectLink(schedule, href)) {
    return <Link href={href}>{content}</Link>;
  }

  return <a href={href}>{content}</a>;
}

export function HomeScheduleSection() {
  const [schedules, setSchedules] = useState<HomeSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadSchedules() {
      setLoading(true);
      setError(null);

      try {
        const nextSchedules = await listHomeSchedules(3);

        if (!cancelled) {
          setSchedules(nextSchedules);
        }
      } catch {
        if (!cancelled) {
          setSchedules([]);
          setError("일정을 불러오지 못했습니다.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadSchedules();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <SurfaceCard className="p-6 sm:p-8">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-accent">
            Schedule
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            일정
          </h1>
        </div>
      </div>

      {loading ? (
        <p className="mt-6 rounded-lg bg-surface-muted px-4 py-5 text-sm text-muted">
          일정을 불러오는 중입니다.
        </p>
      ) : error ? (
        <p className="mt-6 rounded-lg border border-danger-ink/15 bg-danger-soft px-4 py-5 text-sm text-danger-ink">
          {error}
        </p>
      ) : schedules.length === 0 ? (
        <p className="mt-6 rounded-lg bg-surface-muted px-4 py-5 text-sm text-muted">
          등록된 일정이 없습니다.
        </p>
      ) : (
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {schedules.map((schedule) => (
            <ScheduleCard key={schedule.id} schedule={schedule} />
          ))}
        </div>
      )}
    </SurfaceCard>
  );
}
