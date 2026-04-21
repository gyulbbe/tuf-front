import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function formatDateTime(value: string | null | undefined) {
  if (!value) {
    return "미정";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function formatRelativePickNo(value: number | null | undefined) {
  if (typeof value !== "number") {
    return "대기";
  }

  return `${value}픽`;
}

export function formatSessionStatus(status: string | null | undefined) {
  switch (status) {
    case "READY":
      return "준비";
    case "RPS_PENDING":
      return "RPS 대기";
    case "PICKING":
      return "지명 중";
    case "FINISHED":
      return "종료";
    case "WAITING":
      return "대기";
    case "PICKED":
      return "지명 완료";
    case "EXCLUDED":
      return "제외";
    default:
      return status || "알 수 없음";
  }
}

export function formatChoice(choice: string | null | undefined) {
  switch (choice) {
    case "ROCK":
      return "바위";
    case "PAPER":
      return "보";
    case "SCISSORS":
      return "가위";
    default:
      return "비공개";
  }
}

export function formatRace(race: string | null | undefined) {
  switch (race) {
    case "ZERG":
      return "저그";
    case "TERRAN":
      return "테란";
    case "PROTOSS":
      return "프로토스";
    case "RANDOM":
      return "랜덤";
    default:
      return race || "미지정";
  }
}

export function formatRole(role: string | null | undefined) {
  switch (role) {
    case "OWNER":
      return "오너";
    case "PICKER":
      return "픽커";
    case "OWNER_PICKER":
      return "오너 / 픽커";
    case "VIEWER":
      return "조회자";
    default:
      return role || "조회자";
  }
}

export function formatRoundResult(result: string | null | undefined) {
  switch (result) {
    case "TEAM1_WIN":
      return "1팀 승리";
    case "TEAM2_WIN":
      return "2팀 승리";
    case "DRAW":
      return "무승부";
    case "PENDING":
      return "판정 대기";
    default:
      return result || "대기";
  }
}

function buildBadgeClassName(status: string | null | undefined) {
  switch (status) {
    case "READY":
      return "border-line bg-surface-strong text-foreground";
    case "RPS_PENDING":
      return "border-accent/20 bg-accent-soft text-accent-ink";
    case "PICKING":
      return "border-amber-300/40 bg-amber-100 text-amber-900";
    case "FINISHED":
      return "border-emerald-300/40 bg-emerald-100 text-emerald-900";
    case "WAITING":
      return "border-line bg-surface-strong text-foreground";
    case "PICKED":
      return "border-emerald-300/40 bg-emerald-100 text-emerald-900";
    case "EXCLUDED":
      return "border-danger-ink/20 bg-danger-soft text-danger-ink";
    default:
      return "border-line bg-surface-strong text-foreground";
  }
}

export function StatusBadge({
  status,
  className,
}: {
  status: string | null | undefined;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full border px-3 py-1 text-xs font-semibold",
        buildBadgeClassName(status),
        className,
      )}
    >
      {formatSessionStatus(status)}
    </span>
  );
}

export function ValueBadge({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full border border-line bg-surface-muted px-3 py-1 text-xs font-medium text-foreground",
        className,
      )}
    >
      {children}
    </span>
  );
}
