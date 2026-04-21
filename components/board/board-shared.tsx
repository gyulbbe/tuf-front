import Link from "next/link";
import type { ReactNode } from "react";
import type { BoardComment, BoardSearchType } from "@/lib/api/boards";
import { cn } from "@/lib/utils";

export type BoardListQuery = {
  page: number;
  size: number;
  searchType: BoardSearchType;
  keyword: string;
};

export type NoticeTone = "error" | "neutral" | "success";

export type NoticeState = {
  tone: NoticeTone;
  text: string;
};

type ActionLinkVariant = "accent" | "danger" | "outline";
type ActionLinkSize = "md" | "sm";

const actionLinkVariantClassNames: Record<ActionLinkVariant, string> = {
  accent: "bg-accent text-white hover:bg-accent-ink",
  danger:
    "border border-danger-ink/20 bg-danger-soft text-danger-ink hover:border-danger-ink/40",
  outline:
    "border border-line text-muted hover:border-accent-soft hover:bg-surface-strong hover:text-foreground",
};

const actionLinkSizeClassNames: Record<ActionLinkSize, string> = {
  md: "px-5 py-3 text-sm",
  sm: "px-4 py-2 text-sm",
};

export const SEARCH_TYPE_OPTIONS: Array<{
  label: string;
  value: BoardSearchType;
}> = [
  { label: "제목", value: "TITLE" },
  { label: "본문", value: "TEXT" },
  { label: "작성자", value: "USER_ID" },
];

export const SELECT_CLASS_NAME =
  "w-full rounded-2xl border border-line bg-surface-strong px-4 py-3 text-sm text-foreground outline-none transition-colors focus:border-accent-soft focus:bg-white disabled:cursor-not-allowed disabled:opacity-70";

export function buildBoardActionLinkClassName(options?: {
  className?: string;
  fullWidth?: boolean;
  size?: ActionLinkSize;
  variant?: ActionLinkVariant;
}) {
  const size = options?.size ?? "md";
  const variant = options?.variant ?? "outline";

  return cn(
    "inline-flex items-center justify-center rounded-full font-medium transition-colors",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background",
    options?.fullWidth && "w-full",
    actionLinkSizeClassNames[size],
    actionLinkVariantClassNames[variant],
    options?.className,
  );
}

export function BoardLinkButton({
  children,
  className,
  fullWidth = false,
  href,
  size = "md",
  variant = "outline",
}: {
  children: ReactNode;
  className?: string;
  fullWidth?: boolean;
  href: string;
  size?: ActionLinkSize;
  variant?: ActionLinkVariant;
}) {
  return (
    <Link
      href={href}
      className={buildBoardActionLinkClassName({
        className,
        fullWidth,
        size,
        variant,
      })}
    >
      {children}
    </Link>
  );
}

function getNoticeClassName(tone: NoticeTone) {
  switch (tone) {
    case "error":
      return "border border-danger-ink/15 bg-danger-soft text-danger-ink";
    case "success":
      return "border border-success-ink/15 bg-success-soft text-success-ink";
    default:
      return "border border-line bg-surface-muted text-foreground";
  }
}

export function BoardNotice({
  className,
  notice,
}: {
  className?: string;
  notice: NoticeState;
}) {
  return (
    <p
      aria-live="polite"
      className={cn(
        "rounded-2xl px-4 py-3 text-sm leading-7",
        getNoticeClassName(notice.tone),
        className,
      )}
    >
      {notice.text}
    </p>
  );
}

export function BoardEmptyState({
  className,
  text,
}: {
  className?: string;
  text: string;
}) {
  return (
    <div
      className={cn(
        "rounded-[24px] border border-dashed border-line px-4 py-10 text-center text-sm text-muted",
        className,
      )}
    >
      {text}
    </div>
  );
}

export function readBoardErrorMessage(
  error: unknown,
  fallback = "요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.",
) {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return fallback;
}

export function alertBoardError(error: unknown, fallback?: string) {
  if (typeof window === "undefined") {
    return;
  }

  window.alert(readBoardErrorMessage(error, fallback));
}

function toTimestamp(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const timestamp = Date.parse(value);

  if (Number.isNaN(timestamp)) {
    return null;
  }

  return timestamp;
}

export function formatBoardDateTime(value: string | null | undefined) {
  const timestamp = toTimestamp(value);

  if (timestamp === null) {
    return "-";
  }

  return new Intl.DateTimeFormat("ko-KR", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(timestamp);
}

export function countBoardComments(comments: BoardComment[]): number {
  return comments.reduce(
    (total, comment) => total + 1 + countBoardComments(comment.children ?? []),
    0,
  );
}

export function buildBoardListHref(query: BoardListQuery) {
  const params = new URLSearchParams();
  const keyword = query.keyword.trim();

  params.set("page", String(query.page));
  params.set("size", String(query.size));

  if (keyword) {
    params.set("searchType", query.searchType);
    params.set("keyword", keyword);
  }

  return `/notice?${params.toString()}`;
}
