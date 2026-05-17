"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  searchDraftUsers,
  type DraftUserSearchResult,
} from "@/lib/api/draft-users";
import { cn } from "@/lib/utils";

export type DraftUserSearchProps = {
  clearOnSelect?: boolean;
  description?: string;
  disabled?: boolean;
  disabledUserIds?: number[];
  disabledUserMessage?: string;
  emptyMessage?: string;
  label: string;
  limit?: number;
  onSelect: (user: DraftUserSearchResult) => void;
  placeholder?: string;
  selectedUser?: DraftUserSearchResult | null;
};

function describeUser(user: DraftUserSearchResult) {
  return [`@${user.userId}`, user.race, user.tier].filter(Boolean).join(" · ");
}

function findFirstSelectableIndex(
  users: readonly DraftUserSearchResult[],
  disabledUserIds: readonly number[],
) {
  return users.findIndex((user) => !disabledUserIds.includes(user.id));
}

function findNextSelectableIndex(
  users: readonly DraftUserSearchResult[],
  disabledUserIds: readonly number[],
  currentIndex: number,
  direction: 1 | -1,
) {
  if (users.length === 0) {
    return -1;
  }

  const nextStart =
    currentIndex < 0
      ? direction > 0
        ? 0
        : users.length - 1
      : currentIndex + direction;

  for (
    let index = nextStart;
    index >= 0 && index < users.length;
    index += direction
  ) {
    if (!disabledUserIds.includes(users[index].id)) {
      return index;
    }
  }

  return currentIndex;
}

export function DraftUserSearch({
  clearOnSelect = false,
  description,
  disabled = false,
  disabledUserIds = [],
  disabledUserMessage = "이미 선택된 유저입니다.",
  emptyMessage = "검색 결과가 없습니다.",
  label,
  limit = 8,
  onSelect,
  placeholder = "아이디 검색",
  selectedUser,
}: DraftUserSearchProps) {
  const [keyword, setKeyword] = useState("");
  const [results, setResults] = useState<DraftUserSearchResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastSearchedKeyword, setLastSearchedKeyword] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const firstSelectableIndex = useMemo(
    () => findFirstSelectableIndex(results, disabledUserIds),
    [disabledUserIds, results],
  );
  const displayedActiveIndex =
    activeIndex >= 0 &&
    results[activeIndex] &&
    !disabledUserIds.includes(results[activeIndex].id)
      ? activeIndex
      : firstSelectableIndex;
  const activeUser =
    displayedActiveIndex >= 0 && results[displayedActiveIndex]
      ? results[displayedActiveIndex]
      : null;
  const trimmedKeyword = keyword.trim();
  const hasFreshResults =
    trimmedKeyword.length > 0 &&
    trimmedKeyword === lastSearchedKeyword &&
    results.length > 0;

  function closeResults() {
    setIsOpen(false);
    setActiveIndex(-1);
  }

  async function handleSearch() {
    if (disabled || loading) {
      return;
    }

    if (!trimmedKeyword) {
      setResults([]);
      setError("검색어를 입력해 주세요.");
      setLastSearchedKeyword("");
      closeResults();
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const nextResults = await searchDraftUsers(trimmedKeyword, limit);
      const nextActiveIndex = findFirstSelectableIndex(
        nextResults,
        disabledUserIds,
      );

      setResults(nextResults);
      setLastSearchedKeyword(trimmedKeyword);
      setActiveIndex(nextActiveIndex);
      setIsOpen(nextResults.length > 0);

      if (nextResults.length === 0) {
        setError(emptyMessage);
      }
    } catch (searchError) {
      setResults([]);
      setError(
        searchError instanceof Error
          ? searchError.message
          : "유저 검색 중 오류가 발생했습니다.",
      );
      setLastSearchedKeyword(trimmedKeyword);
      closeResults();
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }

  function selectUser(user: DraftUserSearchResult) {
    if (disabledUserIds.includes(user.id)) {
      return;
    }

    onSelect(user);
    if (clearOnSelect) {
      setKeyword("");
      setResults([]);
      setLastSearchedKeyword("");
      setError(null);
    }
    closeResults();
    inputRef.current?.focus();
  }

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
        setActiveIndex(-1);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || displayedActiveIndex < 0) {
      return;
    }

    itemRefs.current[displayedActiveIndex]?.scrollIntoView({
      block: "nearest",
    });
  }, [displayedActiveIndex, isOpen, results]);

  return (
    <div
      ref={rootRef}
      className="rounded-lg border border-line bg-surface-strong px-4 py-4"
    >
      <div className="flex flex-col gap-3">
        <div>
          <p className="text-sm font-semibold text-foreground">{label}</p>
          {description ? (
            <p className="mt-1 text-xs leading-6 text-muted">{description}</p>
          ) : null}
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            ref={inputRef}
            value={keyword}
            onChange={(event) => {
              setKeyword(event.target.value);
              setIsOpen(false);
              setActiveIndex(-1);
            }}
            onFocus={() => {
              if (hasFreshResults) {
                setIsOpen(true);
                setActiveIndex(firstSelectableIndex);
              }
            }}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown" && hasFreshResults) {
                event.preventDefault();
                setIsOpen(true);
                setActiveIndex((current) =>
                  findNextSelectableIndex(results, disabledUserIds, current, 1),
                );
                return;
              }

              if (event.key === "ArrowUp" && hasFreshResults) {
                event.preventDefault();
                setIsOpen(true);
                setActiveIndex((current) =>
                  findNextSelectableIndex(results, disabledUserIds, current, -1),
                );
                return;
              }

              if (event.key === "Enter") {
                event.preventDefault();

                if (loading) {
                  return;
                }

                if (isOpen && hasFreshResults && activeUser) {
                  selectUser(activeUser);
                  return;
                }

                void handleSearch();
              }

              if (event.key === "Escape") {
                closeResults();
              }
            }}
            disabled={disabled}
            readOnly={loading}
            placeholder={placeholder}
          />
          <Button
            variant="outline"
            className="shrink-0 whitespace-nowrap"
            onClick={() => {
              void handleSearch();
            }}
            disabled={disabled || loading}
          >
            {loading ? "검색 중..." : "검색"}
          </Button>
        </div>

        {selectedUser ? (
          <div className="rounded-lg bg-surface-muted px-4 py-3 text-sm text-foreground">
            선택됨: {selectedUser.userId}
            <span className="mt-1 block text-xs text-muted">
              {describeUser(selectedUser)}
            </span>
          </div>
        ) : null}

        {error ? <p className="text-xs text-danger-ink">{error}</p> : null}

        {isOpen && results.length > 0 ? (
          <div className="grid max-h-64 gap-2 overflow-y-auto pr-1">
            {results.map((user, index) => {
              const isSelected = selectedUser?.id === user.id;
              const isDisabledUser = disabledUserIds.includes(user.id);
              const isUnavailable = disabled || isDisabledUser;
              const isActive = index === displayedActiveIndex;

              return (
                <button
                  key={user.id}
                  type="button"
                  ref={(node) => {
                    itemRefs.current[index] = node;
                  }}
                  disabled={isUnavailable}
                  onMouseMove={() => {
                    if (!isDisabledUser && activeIndex !== index) {
                      setActiveIndex(index);
                    }
                  }}
                  onMouseDown={(event) => {
                    event.preventDefault();
                    selectUser(user);
                  }}
                  className={cn(
                    "rounded-lg border px-4 py-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-70",
                    isActive
                      ? "border-accent-soft bg-accent-soft/60 shadow-sm"
                      : "border-line bg-surface-strong hover:border-accent-soft hover:bg-white",
                  )}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={cn(
                        "text-sm font-semibold",
                        isActive ? "text-accent-ink" : "text-foreground",
                      )}
                    >
                      {user.userId}
                    </span>
                    {isActive ? (
                      <span className="rounded-full bg-white/90 px-2 py-1 text-[11px] font-semibold text-accent-ink">
                        현재
                      </span>
                    ) : null}
                    {isSelected ? (
                      <span className="rounded-full bg-accent-soft px-2 py-1 text-[11px] font-semibold text-accent-ink">
                        선택됨
                      </span>
                    ) : isDisabledUser ? (
                      <span className="rounded-full bg-surface-muted px-2 py-1 text-[11px] font-semibold text-muted">
                        중복 선택 불가
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 text-xs leading-6 text-muted">
                    {describeUser(user)}
                  </p>
                  {isDisabledUser ? (
                    <p className="mt-1 text-xs text-muted">{disabledUserMessage}</p>
                  ) : null}
                </button>
              );
            })}
          </div>
        ) : null}
      </div>
    </div>
  );
}
