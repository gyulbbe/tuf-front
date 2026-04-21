"use client";

import type { BoardPagination as BoardPaginationType } from "@/lib/api/boards";
import { Button } from "@/components/ui/button";

type BoardPaginationProps = {
  disabled?: boolean;
  onNavigate: (page: number) => void;
  pagination: BoardPaginationType;
};

export function BoardPagination({
  disabled = false,
  onNavigate,
  pagination,
}: BoardPaginationProps) {
  if (pagination.totalPages === 0 || pagination.groupStartPage === 0) {
    return null;
  }

  const pages = Array.from(
    { length: pagination.groupEndPage - pagination.groupStartPage + 1 },
    (_, index) => pagination.groupStartPage + index,
  );

  return (
    <div className="flex flex-wrap items-center gap-2">
      {pagination.hasPreviousGroup && pagination.firstPage ? (
        <Button
          type="button"
          size="sm"
          disabled={disabled}
          onClick={() => onNavigate(pagination.firstPage!)}
        >
          {"<<"}
        </Button>
      ) : null}

      {pagination.hasPreviousGroup && pagination.previousGroupPage ? (
        <Button
          type="button"
          size="sm"
          disabled={disabled}
          onClick={() => onNavigate(pagination.previousGroupPage!)}
        >
          {"<"}
        </Button>
      ) : null}

      {pages.map((page) => (
        <Button
          key={page}
          type="button"
          size="sm"
          variant={page === pagination.page ? "accent" : "outline"}
          disabled={disabled}
          onClick={() => onNavigate(page)}
        >
          {page}
        </Button>
      ))}

      {pagination.hasNextGroup && pagination.nextGroupPage ? (
        <Button
          type="button"
          size="sm"
          disabled={disabled}
          onClick={() => onNavigate(pagination.nextGroupPage!)}
        >
          {">"}
        </Button>
      ) : null}

      {pagination.hasNextGroup && pagination.lastPage ? (
        <Button
          type="button"
          size="sm"
          disabled={disabled}
          onClick={() => onNavigate(pagination.lastPage!)}
        >
          {">>"}
        </Button>
      ) : null}

      <p className="ml-auto text-xs text-muted">
        총 {pagination.totalElements}개 · {pagination.page}/{pagination.totalPages} 페이지
      </p>
    </div>
  );
}
