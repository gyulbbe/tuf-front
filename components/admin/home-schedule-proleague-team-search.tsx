"use client";

import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import {
  searchLiveProleagueTeams,
  type HomeScheduleProleagueTeamSearchResult,
} from "@/lib/api/home-schedule";

type HomeScheduleProleagueTeamSearchProps = {
  disabled?: boolean;
  onSelect: (team: HomeScheduleProleagueTeamSearchResult) => void;
  placeholder?: string;
};

function describeTeam(team: HomeScheduleProleagueTeamSearchResult) {
  return [team.leagueName, team.seasonName].filter(Boolean).join(" · ");
}

export function HomeScheduleProleagueTeamSearch({
  disabled = false,
  onSelect,
  placeholder = "진행 중인 프로리그 팀 검색",
}: HomeScheduleProleagueTeamSearchProps) {
  const [keyword, setKeyword] = useState("");
  const [results, setResults] = useState<HomeScheduleProleagueTeamSearchResult[]>(
    [],
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const selectedKeywordRef = useRef<string | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [open]);

  useEffect(() => {
    const trimmed = keyword.trim();

    if (disabled || !trimmed) {
      return;
    }

    if (selectedKeywordRef.current === trimmed) {
      return;
    }

    let cancelled = false;
    const timeoutId = window.setTimeout(async () => {
      setLoading(true);
      setError(null);

      try {
        const nextResults = await searchLiveProleagueTeams(trimmed, 8);

        if (!cancelled) {
          setResults(nextResults);
          setOpen(true);
          setError(nextResults.length === 0 ? "검색 결과가 없습니다." : null);
        }
      } catch (searchError) {
        if (!cancelled) {
          setResults([]);
          setOpen(true);
          setError(
            searchError instanceof Error
              ? searchError.message
              : "프로리그 팀 검색 중 오류가 발생했습니다.",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [disabled, keyword]);

  function selectTeam(team: HomeScheduleProleagueTeamSearchResult) {
    selectedKeywordRef.current = team.teamName;
    setKeyword(team.teamName);
    setOpen(false);
    setResults([]);
    setError(null);
    onSelect(team);
  }

  return (
    <div ref={rootRef} className={open ? "relative z-30" : "relative z-0"}>
      <Input
        value={keyword}
        disabled={disabled}
        placeholder={placeholder}
        onChange={(event) => {
          const nextKeyword = event.target.value;

          selectedKeywordRef.current = null;
          setKeyword(nextKeyword);

          if (!nextKeyword.trim()) {
            setResults([]);
            setLoading(false);
            setError(null);
            setOpen(false);
            return;
          }

          setOpen(true);
        }}
        onFocus={() => {
          if (keyword.trim() && (results.length > 0 || error)) {
            setOpen(true);
          }
        }}
      />

      {open ? (
        <div className="absolute left-0 right-0 top-full mt-2 max-h-72 overflow-y-auto rounded-lg border border-line bg-white p-2 shadow-[0_16px_50px_rgba(23,33,43,0.14)]">
          {loading ? (
            <p className="px-3 py-3 text-sm text-muted">검색 중입니다.</p>
          ) : error ? (
            <p className="px-3 py-3 text-sm text-muted">{error}</p>
          ) : (
            results.map((team) => (
              <button
                key={`${team.leagueId}-${team.teamId}`}
                type="button"
                className="block w-full rounded-lg px-3 py-3 text-left transition-colors hover:bg-accent-soft"
                onClick={() => selectTeam(team)}
              >
                <span className="block text-sm font-semibold text-foreground">
                  {team.teamName}
                </span>
                <span className="mt-1 block text-xs text-muted">
                  {describeTeam(team)}
                </span>
              </button>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}
