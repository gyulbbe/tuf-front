"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  searchRpsDraftUsers,
  type RpsDraftUserSearchResult,
} from "@/lib/api/rps-draft";

type RpsDraftUserSearchProps = {
  description?: string;
  disabled?: boolean;
  emptyMessage?: string;
  label: string;
  onSelect: (user: RpsDraftUserSearchResult) => void;
  placeholder?: string;
  selectedUser?: RpsDraftUserSearchResult | null;
};

function describeUser(user: RpsDraftUserSearchResult) {
  const parts = [
    user.name || user.userId,
    `@${user.userId}`,
    `#${user.id}`,
    user.race ? user.race : null,
    user.tier ? user.tier : null,
  ].filter(Boolean);

  return parts.join(" · ");
}

export function RpsDraftUserSearch({
  description,
  disabled = false,
  emptyMessage = "검색 결과가 없습니다.",
  label,
  onSelect,
  placeholder = "user_id 또는 이름으로 검색",
  selectedUser,
}: RpsDraftUserSearchProps) {
  const [keyword, setKeyword] = useState("");
  const [results, setResults] = useState<RpsDraftUserSearchResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSearch() {
    const trimmedKeyword = keyword.trim();

    if (!trimmedKeyword) {
      setResults([]);
      setError("검색어를 먼저 입력해 주세요.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const nextResults = await searchRpsDraftUsers(trimmedKeyword, 8);
      setResults(nextResults);

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
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-[22px] border border-line bg-surface px-4 py-4">
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
            onChange={(event) => setKeyword(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void handleSearch();
              }
            }}
            disabled={disabled || loading}
            placeholder={placeholder}
          />
          <Button
            variant="outline"
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
            선택됨: {describeUser(selectedUser)}
          </div>
        ) : null}

        {error ? <p className="text-xs text-danger-ink">{error}</p> : null}

        {results.length > 0 ? (
          <div className="grid gap-2">
            {results.map((user) => {
              const isSelected = selectedUser?.id === user.id;

              return (
                <button
                  key={user.id}
                  type="button"
                  disabled={disabled}
                  onClick={() => onSelect(user)}
                  className="rounded-2xl border border-line bg-surface-strong px-4 py-3 text-left transition-colors hover:border-accent-soft hover:bg-white disabled:cursor-not-allowed disabled:opacity-70"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-foreground">
                      {user.name || user.userId}
                    </span>
                    {isSelected ? (
                      <span className="rounded-full bg-accent-soft px-2 py-1 text-[11px] font-semibold text-accent-ink">
                        선택됨
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 text-xs leading-6 text-muted">
                    {describeUser(user)}
                  </p>
                </button>
              );
            })}
          </div>
        ) : null}
      </div>
    </div>
  );
}
