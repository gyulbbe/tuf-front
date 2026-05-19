"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { DraftUserSearch } from "@/components/draft/draft-user-search";
import { PersonalLeagueAdminRegistrationPage } from "@/components/personal-league/personal-league-admin-registration-page";
import { ProleagueAdminRegistrationPage } from "@/components/proleague/proleague-admin-registration-page";
import { SurfaceCard } from "@/components/site/surface-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  createAdminLeague,
  getAdminLeague,
  updateAdminLeague,
  type AdminLeagueDetail,
  type AdminLeagueRaceTeamRequest,
  type AdminLeagueType,
} from "@/lib/api/league";
import type { DraftUserSearchResult } from "@/lib/api/draft-users";
import { cn } from "@/lib/utils";

type LeagueAdminRegistrationPageProps = {
  initialType?: AdminLeagueType | null;
  leagueId?: number;
};

const leagueTypeOptions: Array<{
  value: AdminLeagueType;
  label: string;
  description: string;
}> = [
  {
    value: "PROLEAGUE",
    label: "프로리그",
    description: "팀, 팀장, 부팀장, 팀원과 드래프트를 관리합니다.",
  },
  {
    value: "PERSONAL",
    label: "개인리그",
    description: "선수 목록과 토너먼트를 관리합니다.",
  },
  {
    value: "ULTIMATE_BATTLE",
    label: "끝장전",
    description: "두 선수가 정해진 총 판수를 끝까지 진행합니다.",
  },
  {
    value: "RACE_SURVIVAL",
    label: "종족 최강전",
    description: "세 종족 대표가 승자연전으로 진행합니다.",
  },
];

const raceLabels: Record<AdminLeagueRaceTeamRequest["race"], string> = {
  TERRAN: "테란",
  ZERG: "저그",
  PROTOSS: "토스",
};

const raceOrder: AdminLeagueRaceTeamRequest["race"][] = [
  "TERRAN",
  "ZERG",
  "PROTOSS",
];

function todayString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function toPlayerRequest(user: DraftUserSearchResult) {
  return { userId: user.userId };
}

function userFromLoginId(userId: string | null | undefined): DraftUserSearchResult | null {
  if (!userId) {
    return null;
  }
  return {
    id: Number.NaN,
    userId,
    race: null,
    tier: null,
  };
}

function selectedUserIds(users: DraftUserSearchResult[]) {
  return users
    .map((user) => user.id)
    .filter((id) => Number.isFinite(id));
}

export function LeagueAdminRegistrationPage({
  initialType = null,
  leagueId,
}: LeagueAdminRegistrationPageProps) {
  const isEditMode = typeof leagueId === "number";
  const shouldUseDedicatedEditForm =
    isEditMode && (initialType === "PROLEAGUE" || initialType === "PERSONAL");
  const [leagueType, setLeagueType] = useState<AdminLeagueType | null>(
    initialType,
  );
  const [detail, setDetail] = useState<AdminLeagueDetail | null>(null);
  const [loading, setLoading] = useState(
    isEditMode && !shouldUseDedicatedEditForm,
  );
  const [loadError, setLoadError] = useState<string | null>(null);
  const [leagueName, setLeagueName] = useState("");
  const [seasonName, setSeasonName] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState(todayString());
  const [endDate, setEndDate] = useState("");
  const [createTournament, setCreateTournament] = useState(true);
  const [totalGames, setTotalGames] = useState(9);
  const [ultimatePlayers, setUltimatePlayers] = useState<DraftUserSearchResult[]>([]);
  const [racePlayers, setRacePlayers] = useState<
    Record<AdminLeagueRaceTeamRequest["race"], DraftUserSearchResult[]>
  >({
    TERRAN: [],
    ZERG: [],
    PROTOSS: [],
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [savedLeague, setSavedLeague] = useState<AdminLeagueDetail | null>(null);

  useEffect(() => {
    if (
      shouldUseDedicatedEditForm ||
      !isEditMode ||
      typeof leagueId !== "number"
    ) {
      return;
    }

    const targetLeagueId = leagueId;
    let cancelled = false;

    async function loadLeague() {
      setLoading(true);
      setLoadError(null);
      try {
        const nextDetail = await getAdminLeague(targetLeagueId);
        if (cancelled) {
          return;
        }
        setDetail(nextDetail);
        setLeagueType(nextDetail.leagueType);
        setLeagueName(nextDetail.leagueName);
        setSeasonName(nextDetail.seasonName);
        setDescription(nextDetail.description ?? "");
        setStartDate(nextDetail.startDate ?? "");
        setEndDate(nextDetail.endDate ?? "");
        setCreateTournament(Boolean(nextDetail.tournamentId));
        setTotalGames(nextDetail.tournamentBestOf ?? 9);
        setUltimatePlayers(
          nextDetail.players
            .map((player) => userFromLoginId(player.userId))
            .filter((user): user is DraftUserSearchResult => Boolean(user)),
        );
        const nextRacePlayers = { TERRAN: [], ZERG: [], PROTOSS: [] } as Record<
          AdminLeagueRaceTeamRequest["race"],
          DraftUserSearchResult[]
        >;
        nextDetail.raceTeams.forEach((team) => {
          nextRacePlayers[team.race] = team.players
            .map((player) => userFromLoginId(player.userId))
            .filter((user): user is DraftUserSearchResult => Boolean(user));
        });
        setRacePlayers(nextRacePlayers);
      } catch (error) {
        if (!cancelled) {
          setLoadError(
            error instanceof Error
              ? error.message
              : "리그 정보를 불러오지 못했습니다.",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadLeague();

    return () => {
      cancelled = true;
    };
  }, [isEditMode, leagueId, shouldUseDedicatedEditForm]);

  const allRacePlayers = useMemo(
    () => raceOrder.flatMap((race) => racePlayers[race]),
    [racePlayers],
  );
  const disabledUserIds = useMemo(
    () =>
      selectedUserIds(
        leagueType === "RACE_SURVIVAL" ? allRacePlayers : ultimatePlayers,
      ),
    [allRacePlayers, leagueType, ultimatePlayers],
  );

  if (leagueType === "PROLEAGUE") {
    return <ProleagueAdminRegistrationPage proleagueId={leagueId} />;
  }

  if (leagueType === "PERSONAL") {
    return <PersonalLeagueAdminRegistrationPage personalLeagueId={leagueId} />;
  }

  function chooseType(nextType: AdminLeagueType) {
    setLeagueType(nextType);
    setSubmitError(null);
  }

  function removeUltimatePlayer(userId: string) {
    setUltimatePlayers((current) =>
      current.filter((user) => user.userId !== userId),
    );
  }

  function addRacePlayer(
    race: AdminLeagueRaceTeamRequest["race"],
    user: DraftUserSearchResult,
  ) {
    setSubmitError(null);
    setRacePlayers((current) => {
      if (raceOrder.some((item) => current[item].some((player) => player.userId === user.userId))) {
        return current;
      }
      return { ...current, [race]: [...current[race], user] };
    });
  }

  function removeRacePlayer(
    race: AdminLeagueRaceTeamRequest["race"],
    userId: string,
  ) {
    setRacePlayers((current) => ({
      ...current,
      [race]: current[race].filter((user) => user.userId !== userId),
    }));
  }

  function validate() {
    if (!leagueType) {
      return "리그 타입을 선택해주세요.";
    }
    if (!leagueName.trim()) {
      return "리그명을 입력해주세요.";
    }
    if (leagueType === "ULTIMATE_BATTLE") {
      if (ultimatePlayers.length !== 2) {
        return "끝장전 선수는 정확히 2명이어야 합니다.";
      }
      if (!Number.isInteger(totalGames) || totalGames < 1 || totalGames % 2 === 0) {
        return "총 판수는 1 이상의 홀수여야 합니다.";
      }
    }
    if (leagueType === "RACE_SURVIVAL") {
      const missingRace = raceOrder.find((race) => racePlayers[race].length === 0);
      if (missingRace) {
        return `${raceLabels[missingRace]} 대표를 1명 이상 등록해주세요.`;
      }
    }
    return null;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validationMessage = validate();
    if (validationMessage || !leagueType) {
      setSubmitError(validationMessage);
      return;
    }

    setSubmitting(true);
    setSubmitError(null);
    try {
      const payload = {
        leagueName: leagueName.trim(),
        seasonName: seasonName.trim(),
        description: description.trim(),
        status: "LIVE" as const,
        leagueType,
        startDate: startDate || null,
        endDate: endDate || null,
        createTournament,
        players:
          leagueType === "ULTIMATE_BATTLE"
            ? ultimatePlayers.map(toPlayerRequest)
            : [],
        totalGames: leagueType === "ULTIMATE_BATTLE" ? totalGames : null,
        raceTeams:
          leagueType === "RACE_SURVIVAL"
            ? raceOrder.map((race) => ({
                race,
                players: racePlayers[race].map(toPlayerRequest),
              }))
            : [],
      };
      const saved =
        isEditMode && typeof leagueId === "number"
          ? await updateAdminLeague(leagueId, payload)
          : await createAdminLeague(payload);
      setSavedLeague(saved);
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : "리그를 저장하지 못했습니다.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      className="relative left-1/2 w-[calc(100vw-1.25rem)] max-w-[1400px] -translate-x-1/2 space-y-4 sm:w-[calc(100vw-2rem)]"
      onSubmit={handleSubmit}
    >
      <SurfaceCard className="p-6 sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-accent">
          Admin League
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          리그 등록
        </h1>
        <p className="mt-4 max-w-3xl text-base leading-8 text-muted">
          프로리그, 개인리그, 끝장전, 종족 최강전 등을 등록합니다.
        </p>
      </SurfaceCard>

      {loading ? (
        <SurfaceCard className="px-6 py-10 text-center text-sm text-muted">
          리그 정보를 불러오는 중입니다.
        </SurfaceCard>
      ) : null}

      {!loading && loadError ? (
        <SurfaceCard className="border-danger-ink/20 bg-danger-soft px-5 py-4">
          <p className="text-sm font-medium text-danger-ink">{loadError}</p>
        </SurfaceCard>
      ) : null}

      {!loading && !loadError && !leagueType ? (
        <SurfaceCard className="p-6 sm:p-8">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {leagueTypeOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                className="rounded-lg border border-line-strong bg-surface-strong px-5 py-6 text-left transition-colors hover:border-accent hover:bg-accent-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                onClick={() => chooseType(option.value)}
              >
                <span className="text-lg font-semibold text-foreground">
                  {option.label}
                </span>
                <span className="mt-2 block text-sm leading-6 text-muted">
                  {option.description}
                </span>
              </button>
            ))}
          </div>
        </SurfaceCard>
      ) : null}

      {!loading && !loadError && leagueType ? (
        <div className="grid gap-4 xl:grid-cols-[380px_minmax(0,1fr)] xl:items-start">
          <SurfaceCard className="space-y-5 p-5 sm:p-6">
            <div className="grid gap-2">
              <label className="text-sm font-semibold text-foreground" htmlFor="league-name">
                리그명
              </label>
              <Input
                id="league-name"
                value={leagueName}
                onChange={(event) => setLeagueName(event.target.value)}
                placeholder="예: 2026 끝장전"
                disabled={submitting}
              />
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-semibold text-foreground" htmlFor="season-name">
                시즌명
              </label>
              <Input
                id="season-name"
                value={seasonName}
                onChange={(event) => setSeasonName(event.target.value)}
                placeholder="예: 2026 시즌1"
                disabled={submitting}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
              <label className="grid gap-2 text-sm font-semibold text-foreground">
                시작일
                <Input
                  type="date"
                  value={startDate}
                  onChange={(event) => setStartDate(event.target.value)}
                  disabled={submitting}
                />
              </label>
              <label className="grid gap-2 text-sm font-semibold text-foreground">
                종료일
                <Input
                  type="date"
                  value={endDate}
                  onChange={(event) => setEndDate(event.target.value)}
                  disabled={submitting}
                />
              </label>
            </div>
            <label className="flex items-center justify-between gap-4 rounded-lg border border-line bg-surface-strong px-4 py-4 text-sm font-semibold text-foreground">
              토너먼트 함께 생성
              <input
                type="checkbox"
                checked={createTournament}
                onChange={(event) => setCreateTournament(event.target.checked)}
                disabled={submitting || (Boolean(detail?.tournamentId) && createTournament)}
                className="h-5 w-5 accent-sky-600"
              />
            </label>
            {leagueType === "ULTIMATE_BATTLE" ? (
              <label className="grid gap-2 text-sm font-semibold text-foreground">
                총 판수
                <Input
                  type="number"
                  min={1}
                  step={2}
                  value={totalGames}
                  onChange={(event) => setTotalGames(Number(event.target.value))}
                  disabled={submitting}
                />
              </label>
            ) : null}
            {submitError ? (
              <p className="rounded-lg border border-danger-ink/20 bg-danger-soft px-4 py-3 text-sm font-medium text-danger-ink">
                {submitError}
              </p>
            ) : null}
            {savedLeague ? (
              <div className="grid gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
                <p className="font-semibold">저장되었습니다.</p>
                <Link href={`/admin/league/${savedLeague.id}`} className="underline">
                  수정 화면 열기
                </Link>
                {savedLeague.tournamentId ? (
                  <Link
                    href={`/admin/tournament/${savedLeague.tournamentId}`}
                    className="underline"
                  >
                    토너먼트 진행 관리
                  </Link>
                ) : null}
              </div>
            ) : null}
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? "저장 중" : isEditMode ? "리그 수정" : "리그 등록"}
            </Button>
          </SurfaceCard>

          <SurfaceCard className="space-y-5 p-5 sm:p-6">
            {leagueType === "ULTIMATE_BATTLE" ? (
              <>
                <div>
                  <h2 className="text-xl font-semibold text-foreground">선수 설정</h2>
                  <p className="mt-2 text-sm text-muted">끝장전 선수 2명을 등록합니다.</p>
                </div>
                <DraftUserSearch
                  clearOnSelect
                  label="선수 ID 검색"
                  placeholder="선수 ID 검색"
                  disabled={submitting || ultimatePlayers.length >= 2}
                  disabledUserIds={disabledUserIds}
                  disabledUserMessage="이미 등록된 선수입니다."
                  onSelect={(user) => {
                    setSubmitError(null);
                    setUltimatePlayers((current) =>
                      current.some((player) => player.userId === user.userId) ||
                      current.length >= 2
                        ? current
                        : [...current, user],
                    );
                  }}
                />
                <div className="grid gap-3">
                  {ultimatePlayers.map((user, index) => (
                    <SelectedUserRow
                      key={user.userId}
                      label={`#${index + 1}`}
                      user={user}
                      onRemove={() => removeUltimatePlayer(user.userId)}
                    />
                  ))}
                </div>
              </>
            ) : null}

            {leagueType === "RACE_SURVIVAL" ? (
              <>
                <div>
                  <h2 className="text-xl font-semibold text-foreground">종족 대표 설정</h2>
                  <p className="mt-2 text-sm text-muted">
                    실제 유저 종족과 관계없이 테란, 저그, 토스 팀에 각각 1명 이상 등록합니다.
                  </p>
                </div>
                <div className="grid gap-4 lg:grid-cols-3">
                  {raceOrder.map((race) => (
                    <div key={race} className="rounded-lg border border-line bg-surface-strong p-4">
                      <h3 className="text-lg font-semibold text-foreground">
                        {raceLabels[race]}
                      </h3>
                      <p className="mt-1 text-xs text-muted">
                        {racePlayers[race].length}명
                      </p>
                      <div className="mt-4">
                        <DraftUserSearch
                          clearOnSelect
                          label="선수 ID 검색"
                          placeholder="선수 ID 검색"
                          disabled={submitting}
                          disabledUserIds={disabledUserIds}
                          disabledUserMessage="이미 등록된 선수입니다."
                          onSelect={(user) => addRacePlayer(race, user)}
                        />
                      </div>
                      <div className="mt-4 grid gap-2">
                        {racePlayers[race].map((user, index) => (
                          <SelectedUserRow
                            key={user.userId}
                            label={`#${index + 1}`}
                            user={user}
                            onRemove={() => removeRacePlayer(race, user.userId)}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : null}
          </SurfaceCard>
        </div>
      ) : null}
    </form>
  );
}

function SelectedUserRow({
  label,
  user,
  onRemove,
}: {
  label: string;
  user: DraftUserSearchResult;
  onRemove: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-line bg-surface-strong px-4 py-3">
      <div>
        <p className="text-xs font-semibold text-muted">{label}</p>
        <p className="text-sm font-semibold text-foreground">{user.userId}</p>
        <p className="text-xs text-muted">
          {[user.race, user.tier].filter(Boolean).join(" · ") || "-"}
        </p>
      </div>
      <button
        type="button"
        className={cn(
          "rounded-full border border-danger-ink/20 bg-danger-soft px-4 py-2",
          "text-sm font-semibold text-danger-ink transition-colors hover:bg-white",
        )}
        onClick={onRemove}
      >
        삭제
      </button>
    </div>
  );
}
