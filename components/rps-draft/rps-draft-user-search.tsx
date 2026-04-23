"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  searchRpsDraftUsers,
  type RpsDraftUserSearchResult,
} from "@/lib/api/rps-draft";

type RpsDraftUserSearchProps = {
  description?: string;
  disabled?: boolean;
  disabledUserIds?: number[];
  disabledUserMessage?: string;
  emptyMessage?: string;
  label: string;
  onSelect: (user: RpsDraftUserSearchResult) => void;
  placeholder?: string;
  selectedUser?: RpsDraftUserSearchResult | null;
};

function describeUser(user: RpsDraftUserSearchResult) {
  const parts = [`@${user.userId}`, user.race, user.tier].filter(Boolean);
  return parts.join(" · ");
}

function findFirstSelectableUser(
  users: RpsDraftUserSearchResult[],
  disabledUserIds: readonly number[],
) {
  return users.find((user) => !disabledUserIds.includes(user.id)) ?? null;
}

export function RpsDraftUserSearch({
  description,
  disabled = false,
  disabledUserIds = [],
  disabledUserMessage = "이미 선택된 유저입니다.",
  emptyMessage = "검색 결과가 없습니다.",
  label,
  onSelect,
  placeholder = "아이디 검색",
  selectedUser,
}: RpsDraftUserSearchProps) {
  const [keyword, setKeyword] = useState("");
  const [results, setResults] = useState<RpsDraftUserSearchResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastSearchedKeyword, setLastSearchedKeyword] = useState("");
  const firstSelectableUser = useMemo(
    () => findFirstSelectableUser(results, disabledUserIds),
    [disabledUserIds, results],
  );

  async function handleSearch() {
    const trimmedKeyword = keyword.trim();

    if (!trimmedKeyword) {
      setResults([]);
      setError("검색어를 입력해 주세요.");
      setLastSearchedKeyword("");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const nextResults = await searchRpsDraftUsers(trimmedKeyword, 8);
      setResults(nextResults);
      setLastSearchedKeyword(trimmedKeyword);

      if (nextResults.length === 0) {
        setError(emptyMessage);
      }
    } catch (searchError) {
      setResults([]);
      setError(
        searchError instanceof Error
          ? searchError.message
          : "사용자 검색 중 오류가 발생했습니다.",
      );
      setLastSearchedKeyword(trimmedKeyword);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-[22px] border border-line bg-surface-strong px-4 py-4">
      <div className="flex flex-col gap-3">
        <div>
          <p className="text-sm font-semibold text-foreground">{label}</p>
          {description ? (
            <p className="mt-1 text-xs leading-6 text-muted">{description}</p>
          ) : null}
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            value={keyword}
            onChange={(event) => {
              setKeyword(event.target.value);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();

                const trimmedKeyword = keyword.trim();
                if (
                  !loading &&
                  trimmedKeyword &&
                  trimmedKeyword === lastSearchedKeyword &&
                  firstSelectableUser
                ) {
                  onSelect(firstSelectableUser);
                  return;
                }

                void handleSearch();
              }
            }}
            disabled={disabled || loading}
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
          <div className="rounded-2xl bg-surface-muted px-4 py-3 text-sm text-foreground">
            선택됨: {selectedUser.userId}
            <span className="mt-1 block text-xs text-muted">
              {describeUser(selectedUser)}
            </span>
          </div>
        ) : null}

        {error ? <p className="text-xs text-danger-ink">{error}</p> : null}

        {results.length > 0 ? (
          <div className="grid max-h-64 gap-2 overflow-y-auto pr-1">
            {results.map((user) => {
              const isSelected = selectedUser?.id === user.id;
              const isDisabledUser = disabledUserIds.includes(user.id);
              const isUnavailable = disabled || isDisabledUser;

              return (
                <button
                  key={user.id}
                  type="button"
                  disabled={isUnavailable}
                  onClick={() => onSelect(user)}
                  className="rounded-2xl border border-line bg-surface-strong px-4 py-3 text-left transition-colors hover:border-accent-soft hover:bg-white disabled:cursor-not-allowed disabled:opacity-70"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-foreground">
                      {user.userId}
                    </span>
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
