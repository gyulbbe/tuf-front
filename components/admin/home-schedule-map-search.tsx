"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  searchHomeScheduleMaps,
  type HomeScheduleMapSearchResult,
} from "@/lib/api/home-schedule";

type HomeScheduleMapSearchProps = {
  disabled?: boolean;
  mapName: string;
  onClear: () => void;
  onSelect: (map: HomeScheduleMapSearchResult) => void;
};

export function HomeScheduleMapSearch({
  disabled = false,
  mapName,
  onClear,
  onSelect,
}: HomeScheduleMapSearchProps) {
  const [keyword, setKeyword] = useState("");
  const [results, setResults] = useState<HomeScheduleMapSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const requestSeqRef = useRef(0);
  const selectedKeywordRef = useRef<string | null>(null);

  const closeResults = useCallback(() => {
    setOpen(false);
    setActiveIndex(-1);
  }, []);

  const performSearch = useCallback(
    async (searchKeyword: string, options: { focusInput?: boolean } = {}) => {
      if (disabled) {
        return;
      }

      const trimmed = searchKeyword.trim();

      if (selectedKeywordRef.current === trimmed) {
        closeResults();
        return;
      }

      if (!trimmed) {
        requestSeqRef.current += 1;
        setResults([]);
        setError("검색어를 입력해주세요.");
        closeResults();

        if (options.focusInput) {
          inputRef.current?.focus();
        }

        return;
      }

      const requestSeq = requestSeqRef.current + 1;
      requestSeqRef.current = requestSeq;
      setLoading(true);
      setError(null);

      try {
        const nextResults = await searchHomeScheduleMaps(trimmed, 8);

        if (requestSeq !== requestSeqRef.current) {
          return;
        }

        setResults(nextResults);
        setOpen(true);
        setActiveIndex(nextResults.length > 0 ? 0 : -1);
        setError(nextResults.length === 0 ? "검색 결과가 없습니다." : null);
      } catch (searchError) {
        if (requestSeq !== requestSeqRef.current) {
          return;
        }

        setResults([]);
        setOpen(true);
        setActiveIndex(-1);
        setError(
          searchError instanceof Error
            ? searchError.message
            : "맵 검색 중 오류가 발생했습니다.",
        );
      } finally {
        if (requestSeq === requestSeqRef.current) {
          setLoading(false);

          if (options.focusInput) {
            inputRef.current?.focus();
          }
        }
      }
    },
    [closeResults, disabled],
  );

  useEffect(() => {
    if (!open) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        closeResults();
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [closeResults, open]);

  useEffect(() => {
    if (!open || activeIndex < 0) {
      return;
    }

    itemRefs.current[activeIndex]?.scrollIntoView({
      block: "nearest",
    });
  }, [activeIndex, open, results]);

  useEffect(() => {
    const trimmed = keyword.trim();

    if (disabled || !trimmed) {
      return;
    }

    if (selectedKeywordRef.current === trimmed) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void performSearch(trimmed);
    }, 250);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [disabled, keyword, performSearch]);

  function selectMap(map: HomeScheduleMapSearchResult) {
    requestSeqRef.current += 1;
    selectedKeywordRef.current = map.mapName;
    setKeyword(map.mapName);
    setResults([]);
    setError(null);
    closeResults();
    onSelect(map);
    inputRef.current?.focus();
  }

  function clearMap() {
    requestSeqRef.current += 1;
    selectedKeywordRef.current = null;
    setKeyword("");
    setResults([]);
    setError(null);
    setLoading(false);
    closeResults();
    onClear();
    inputRef.current?.focus();
  }

  function handleKeywordChange(nextKeyword: string) {
    requestSeqRef.current += 1;
    selectedKeywordRef.current = null;
    setKeyword(nextKeyword);

    if (!nextKeyword.trim()) {
      setResults([]);
      setLoading(false);
      setError(null);
      closeResults();
      return;
    }

    setOpen(true);
    setActiveIndex(-1);
  }

  function moveActiveIndex(direction: 1 | -1) {
    if (results.length === 0) {
      return;
    }

    setOpen(true);
    setActiveIndex((current) => {
      if (current < 0) {
        return direction === 1 ? 0 : results.length - 1;
      }

      const clamped = Math.min(Math.max(current, 0), results.length - 1);
      return direction === 1
        ? Math.min(clamped + 1, results.length - 1)
        : Math.max(clamped - 1, 0);
    });
  }

  return (
    <div className="grid gap-2">
      {mapName ? (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-line bg-surface-muted px-3 py-2 text-xs font-semibold text-muted">
          <span className="text-foreground">{mapName}</span>
          <Button size="sm" disabled={disabled} onClick={clearMap}>
            해제
          </Button>
        </div>
      ) : null}

      <div ref={rootRef} className={open ? "relative z-30" : "relative z-0"}>
        <Input
          ref={inputRef}
          value={keyword}
          disabled={disabled}
          placeholder="맵 검색"
          onChange={(event) => handleKeywordChange(event.target.value)}
          onFocus={() => {
            if (keyword.trim() && (results.length > 0 || error)) {
              setOpen(true);
              setActiveIndex(results.length > 0 ? 0 : -1);
            }
          }}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") {
              event.preventDefault();
              moveActiveIndex(1);
              return;
            }

            if (event.key === "ArrowUp") {
              event.preventDefault();
              moveActiveIndex(-1);
              return;
            }

            if (event.key === "Enter") {
              event.preventDefault();

              if (loading) {
                return;
              }

              const activeMap =
                open && activeIndex >= 0 ? results[activeIndex] : null;

              if (activeMap) {
                selectMap(activeMap);
                return;
              }

              void performSearch(keyword, { focusInput: true });
              return;
            }

            if (event.key === "Escape") {
              closeResults();
            }
          }}
        />

        {open ? (
          <div className="absolute left-0 right-0 top-full z-40 mt-2 max-h-72 overflow-y-auto rounded-lg border border-line bg-white p-2 shadow-[0_16px_50px_rgba(23,33,43,0.14)]">
            {loading ? (
              <p className="px-3 py-3 text-sm text-muted">검색 중입니다.</p>
            ) : error ? (
              <p className="px-3 py-3 text-sm text-muted">{error}</p>
            ) : (
              results.map((map, index) => {
                const isActive = index === activeIndex;

                return (
                  <button
                    key={map.id}
                    ref={(node) => {
                      itemRefs.current[index] = node;
                    }}
                    type="button"
                    className={[
                      "block w-full rounded-lg px-3 py-3 text-left transition-colors",
                      isActive
                        ? "bg-accent-soft text-accent-ink"
                        : "hover:bg-accent-soft",
                    ].join(" ")}
                    onMouseMove={() => {
                      if (activeIndex !== index) {
                        setActiveIndex(index);
                      }
                    }}
                    onMouseDown={(event) => {
                      event.preventDefault();
                      selectMap(map);
                    }}
                  >
                    <span className="block text-sm font-semibold text-foreground">
                      {map.mapName}
                    </span>
                    {map.image ? (
                      <span className="mt-1 block truncate text-xs text-muted">
                        {map.image}
                      </span>
                    ) : null}
                  </button>
                );
              })
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
