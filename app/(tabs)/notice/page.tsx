import type { Metadata } from "next";
import { BoardListPage } from "@/components/board/board-list-page";
import type { BoardListQuery } from "@/components/board/board-shared";
import type { BoardSearchType } from "@/lib/api/boards";

export const metadata: Metadata = {
  title: "게시판",
};

type NoticePageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function readFirstValue(value?: string | string[]) {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

function parsePositiveInt(value: string | null, fallback: number) {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < 1) {
    return fallback;
  }

  return parsed;
}

function parseSearchType(value: string | null): BoardSearchType {
  switch (value) {
    case "TEXT":
    case "USER_ID":
      return value;
    default:
      return "TITLE";
  }
}

export default async function NoticePage({ searchParams }: NoticePageProps) {
  const resolvedSearchParams = await searchParams;

  const initialQuery: BoardListQuery = {
    keyword: readFirstValue(resolvedSearchParams.keyword)?.trim() ?? "",
    page: parsePositiveInt(readFirstValue(resolvedSearchParams.page), 1),
    searchType: parseSearchType(readFirstValue(resolvedSearchParams.searchType)),
    size: parsePositiveInt(readFirstValue(resolvedSearchParams.size), 10),
  };

  return (
    <BoardListPage
      key={`${initialQuery.page}:${initialQuery.size}:${initialQuery.searchType}:${initialQuery.keyword}`}
      initialQuery={initialQuery}
    />
  );
}
