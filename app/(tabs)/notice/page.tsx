import { redirect } from "next/navigation";
import type { BoardListQuery } from "@/components/board/board-shared";
import type { BoardSearchType } from "@/lib/api/boards";

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

function buildGalleryHref(query: BoardListQuery) {
  const params = new URLSearchParams();

  params.set("page", String(query.page));
  params.set("size", String(query.size));

  if (query.keyword) {
    params.set("searchType", query.searchType);
    params.set("keyword", query.keyword);
  }

  const queryString = params.toString();
  return queryString ? `/gallery?${queryString}` : "/gallery";
}

export default async function NoticePage({ searchParams }: NoticePageProps) {
  const resolvedSearchParams = await searchParams;

  const query: BoardListQuery = {
    keyword: readFirstValue(resolvedSearchParams.keyword)?.trim() ?? "",
    page: parsePositiveInt(readFirstValue(resolvedSearchParams.page), 1),
    searchType: parseSearchType(readFirstValue(resolvedSearchParams.searchType)),
    size: parsePositiveInt(readFirstValue(resolvedSearchParams.size), 10),
  };

  redirect(buildGalleryHref(query));
}
