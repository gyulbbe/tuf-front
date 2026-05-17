"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { HomeScheduleMapSearch } from "@/components/admin/home-schedule-map-search";
import { HomeSchedulePlayerSearch } from "@/components/admin/home-schedule-player-search";
import { HomeScheduleProleagueTeamSearch } from "@/components/admin/home-schedule-proleague-team-search";
import {
  type AdminHomeScheduleMatchRequest,
  type HomeScheduleGroup,
  type HomeScheduleMatch,
  type HomeScheduleMatchFormat,
  type HomeSchedulePlayerSide,
  type StarcraftRace,
} from "@/lib/api/home-schedule";

export type MatchPlayerFormState = {
  id: number | null;
  side: HomeSchedulePlayerSide;
  slotOrder: number;
  userId: number | null;
  playerName: string;
  playerRank: string;
  playerRace: StarcraftRace | "";
  note: string;
};

export type MatchFormState = {
  id: number | null;
  displayOrder: number;
  setLabel: string;
  matchFormat: HomeScheduleMatchFormat;
  teamAName: string;
  teamBName: string;
  mapId: number | null;
  mapName: string;
  note: string;
  sideAPlayers: MatchPlayerFormState[];
  sideBPlayers: MatchPlayerFormState[];
};

const SELECT_CLASS_NAME =
  "w-full rounded-lg border border-line-strong bg-surface-strong px-4 py-3 text-sm text-foreground outline-none transition-colors focus:border-accent focus:bg-white disabled:cursor-not-allowed disabled:opacity-70";

const TEAM_PLAY_OPTIONS: Array<{ label: string; slotCount: 2 | 3 | 4 }> = [
  { label: "2:2", slotCount: 2 },
  { label: "3:3", slotCount: 3 },
  { label: "4:4", slotCount: 4 },
];

const RACE_OPTIONS: Array<{ label: string; value: StarcraftRace | "" }> = [
  { value: "", label: "미정" },
  { value: "TERRAN", label: "Terran" },
  { value: "ZERG", label: "Zerg" },
  { value: "PROTOSS", label: "Protoss" },
  { value: "RANDOM", label: "Random" },
];

function getFormatSlotCount(format: HomeScheduleMatchFormat) {
  switch (format) {
    case "2V2":
      return 2;
    case "3V3":
      return 3;
    case "CUSTOM":
      return null;
    default:
      return 1;
  }
}

function getTeamPlaySlotCount(match: MatchFormState): 2 | 3 | 4 {
  if (match.matchFormat === "3V3") {
    return 3;
  }

  if (
    match.matchFormat === "CUSTOM" &&
    Math.max(match.sideAPlayers.length, match.sideBPlayers.length) >= 4
  ) {
    return 4;
  }

  return 2;
}

function isTeamPlayMatch(match: MatchFormState) {
  return (
    match.matchFormat === "2V2" ||
    match.matchFormat === "3V3" ||
    (match.matchFormat === "CUSTOM" &&
      Math.max(match.sideAPlayers.length, match.sideBPlayers.length) > 1)
  );
}

function createPlayer(
  side: HomeSchedulePlayerSide,
  slotOrder: number,
): MatchPlayerFormState {
  return {
    id: null,
    side,
    slotOrder,
    userId: null,
    playerName: "",
    playerRank: "",
    playerRace: "",
    note: "",
  };
}

function normalizePlayers(
  players: MatchPlayerFormState[],
  side: HomeSchedulePlayerSide,
  format: HomeScheduleMatchFormat,
) {
  const slotCount = getFormatSlotCount(format);
  const nextPlayers =
    slotCount === null ? [...players] : players.slice(0, slotCount);
  const minimumCount = slotCount ?? Math.max(1, nextPlayers.length);

  while (nextPlayers.length < minimumCount) {
    nextPlayers.push(createPlayer(side, nextPlayers.length + 1));
  }

  return nextPlayers.map((player, index) => ({
    ...player,
    side,
    slotOrder: index + 1,
  }));
}

function resizePlayers(
  players: MatchPlayerFormState[],
  side: HomeSchedulePlayerSide,
  slotCount: number,
) {
  const nextPlayers = players.slice(0, slotCount);

  while (nextPlayers.length < slotCount) {
    nextPlayers.push(createPlayer(side, nextPlayers.length + 1));
  }

  return nextPlayers.map((player, index) => ({
    ...player,
    side,
    slotOrder: index + 1,
  }));
}

function forceSingleMatch(match: MatchFormState): MatchFormState {
  return {
    ...match,
    matchFormat: "1V1",
    sideAPlayers: resizePlayers(match.sideAPlayers, "A", 1),
    sideBPlayers: resizePlayers(match.sideBPlayers, "B", 1),
  };
}

function toPlayerState(
  player: HomeScheduleMatch["sideAPlayers"][number],
  side: HomeSchedulePlayerSide,
): MatchPlayerFormState {
  return {
    id: player.id || null,
    side,
    slotOrder: player.slotOrder || 1,
    userId: player.userId,
    playerName: player.playerName,
    playerRank: player.playerRank ?? "",
    playerRace: player.playerRace ?? "",
    note: player.note ?? "",
  };
}

export function createEmptyMatchState(
  displayOrder: number,
): MatchFormState {
  return {
    id: null,
    displayOrder,
    setLabel: `${displayOrder}세트`,
    matchFormat: "1V1",
    teamAName: "",
    teamBName: "",
    mapId: null,
    mapName: "",
    note: "",
    sideAPlayers: [createPlayer("A", 1)],
    sideBPlayers: [createPlayer("B", 1)],
  };
}

export function createMatchStateFromScheduleMatch(
  match: HomeScheduleMatch,
): MatchFormState {
  const sideAPlayers = match.sideAPlayers
    .map((player) => toPlayerState(player, "A"))
    .sort((left, right) => left.slotOrder - right.slotOrder);
  const sideBPlayers = match.sideBPlayers
    .map((player) => toPlayerState(player, "B"))
    .sort((left, right) => left.slotOrder - right.slotOrder);

  return {
    id: match.id || null,
    displayOrder: match.displayOrder || 1,
    setLabel: match.setLabel || "SET",
    matchFormat: match.matchFormat,
    teamAName: match.teamAName ?? "",
    teamBName: match.teamBName ?? "",
    mapId: match.mapId,
    mapName: match.mapName ?? "",
    note: match.note ?? "",
    sideAPlayers: normalizePlayers(sideAPlayers, "A", match.matchFormat),
    sideBPlayers: normalizePlayers(sideBPlayers, "B", match.matchFormat),
  };
}

export function createMatchPayload(
  match: MatchFormState,
  displayOrder = match.displayOrder,
  options: {
    forceSingleMatch?: boolean;
    teamAName?: string;
    teamBName?: string;
  } = {},
): AdminHomeScheduleMatchRequest {
  const payloadMatch = options.forceSingleMatch ? forceSingleMatch(match) : match;
  const players = [...payloadMatch.sideAPlayers, ...payloadMatch.sideBPlayers].map((player) => {
    const playerName = player.playerName.trim();

    return {
      id: player.id,
      side: player.side,
      slotOrder: player.slotOrder,
      userId: playerName ? player.userId : null,
      playerName: playerName || null,
      playerRank: player.playerRank.trim() || null,
      playerRace: player.playerRace || null,
      note: null,
    };
  });

  return {
    id: match.id,
    displayOrder,
    setLabel: `${displayOrder}세트`,
    matchFormat: payloadMatch.matchFormat,
    teamAName: (options.teamAName ?? match.teamAName).trim() || null,
    teamBName: (options.teamBName ?? match.teamBName).trim() || null,
    mapId: match.mapId,
    note: null,
    players,
  };
}

type HomeScheduleMatchEditorProps = {
  matches: MatchFormState[];
  onChange: (matches: MatchFormState[]) => void;
  onRepresentativeTeamANameChange: (value: string) => void;
  onRepresentativeTeamBNameChange: (value: string) => void;
  representativeTeamAName: string;
  representativeTeamBName: string;
  scheduleGroup: HomeScheduleGroup;
};

export function HomeScheduleMatchEditor({
  matches,
  onChange,
  onRepresentativeTeamANameChange,
  onRepresentativeTeamBNameChange,
  representativeTeamAName,
  representativeTeamBName,
  scheduleGroup,
}: HomeScheduleMatchEditorProps) {
  const isProleague = scheduleGroup === "PROLEAGUE";
  const isPersonalLeague = scheduleGroup === "PERSONAL_LEAGUE";

  function updateMatch(index: number, updater: (match: MatchFormState) => MatchFormState) {
    onChange(matches.map((match, matchIndex) => (matchIndex === index ? updater(match) : match)));
  }

  function addMatch() {
    onChange([...matches, createEmptyMatchState(matches.length + 1)]);
  }

  function removeMatch(index: number) {
    onChange(
      matches
        .filter((_, matchIndex) => matchIndex !== index)
        .map((match, matchIndex) => ({
          ...match,
          displayOrder: matchIndex + 1,
        })),
    );
  }

  function moveMatch(index: number, direction: -1 | 1) {
    const targetIndex = index + direction;

    if (targetIndex < 0 || targetIndex >= matches.length) {
      return;
    }

    const nextMatches = [...matches];
    const [target] = nextMatches.splice(index, 1);
    nextMatches.splice(targetIndex, 0, target);
    onChange(
      nextMatches.map((match, matchIndex) => ({
        ...match,
        displayOrder: matchIndex + 1,
      })),
    );
  }

  function updateTeamPlayEnabled(index: number, enabled: boolean) {
    updateMatch(index, (match) => {
      if (!enabled) {
        return {
          ...match,
          matchFormat: "1V1",
          sideAPlayers: resizePlayers(match.sideAPlayers, "A", 1),
          sideBPlayers: resizePlayers(match.sideBPlayers, "B", 1),
        };
      }

      const slotCount = getTeamPlaySlotCount(match);
      const nextFormat = slotCount === 3 ? "3V3" : slotCount === 4 ? "CUSTOM" : "2V2";

      return {
        ...match,
        matchFormat: nextFormat,
        sideAPlayers: resizePlayers(match.sideAPlayers, "A", slotCount),
        sideBPlayers: resizePlayers(match.sideBPlayers, "B", slotCount),
      };
    });
  }

  function updateTeamPlaySlotCount(index: number, slotCount: 2 | 3 | 4) {
    updateMatch(index, (match) => {
      const nextFormat = slotCount === 3 ? "3V3" : slotCount === 4 ? "CUSTOM" : "2V2";

      return {
        ...match,
        matchFormat: nextFormat,
        sideAPlayers: resizePlayers(match.sideAPlayers, "A", slotCount),
        sideBPlayers: resizePlayers(match.sideBPlayers, "B", slotCount),
      };
    });
  }

  function updatePlayer(
    matchIndex: number,
    side: HomeSchedulePlayerSide,
    playerIndex: number,
    updater: (player: MatchPlayerFormState) => MatchPlayerFormState,
  ) {
    updateMatch(matchIndex, (match) => {
      const key = side === "A" ? "sideAPlayers" : "sideBPlayers";
      const currentPlayers =
        match[key].length > 0 ? match[key] : [createPlayer(side, 1)];

      return {
        ...match,
        [key]: currentPlayers.map((player, index) =>
          index === playerIndex ? updater(player) : player,
        ),
      };
    });
  }

  return (
    <section className="space-y-4 rounded-lg border border-line bg-surface-muted/60 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold text-foreground">세트 대진</h3>
          <p className="mt-1 text-sm leading-6 text-muted">
            프로리그와 개인리그는 메인 화면에서 세트별 선수, 티어, 종족, 맵으로 표시됩니다.
          </p>
        </div>
        <Button onClick={addMatch} variant="accent">
          세트 추가
        </Button>
      </div>

      {isProleague ? (
        <div className="grid gap-3 rounded-lg border border-line bg-white p-4 xl:grid-cols-2">
          <label className="grid gap-2 text-sm font-semibold text-foreground">
            A팀
            <Input
              value={representativeTeamAName}
              onChange={(event) => onRepresentativeTeamANameChange(event.target.value)}
              placeholder="팀명을 작성하세요."
            />
            <HomeScheduleProleagueTeamSearch
              onSelect={(team) => onRepresentativeTeamANameChange(team.teamName)}
            />
          </label>
          <label className="grid gap-2 text-sm font-semibold text-foreground">
            B팀
            <Input
              value={representativeTeamBName}
              onChange={(event) => onRepresentativeTeamBNameChange(event.target.value)}
              placeholder="팀명을 작성하세요."
            />
            <HomeScheduleProleagueTeamSearch
              onSelect={(team) => onRepresentativeTeamBNameChange(team.teamName)}
            />
          </label>
        </div>
      ) : null}

      {matches.length === 0 ? (
        <p className="rounded-lg border border-dashed border-line bg-white px-4 py-5 text-sm text-muted">
          등록된 세트 대진이 없습니다. 공지/터프봇/기타 일정은 대진 없이 저장할 수 있습니다.
        </p>
      ) : null}

      <div className="space-y-4">
        {matches.map((match, matchIndex) => {
          const visibleSideAPlayers = isPersonalLeague
            ? resizePlayers(match.sideAPlayers, "A", 1)
            : match.sideAPlayers;
          const visibleSideBPlayers = isPersonalLeague
            ? resizePlayers(match.sideBPlayers, "B", 1)
            : match.sideBPlayers;
          const selectedUserIds = [
            ...visibleSideAPlayers,
            ...visibleSideBPlayers,
          ]
            .map((player) => player.userId)
            .filter((userId): userId is number => typeof userId === "number");

          return (
          <div key={`${match.id ?? "new"}-${matchIndex}`} className="rounded-lg border border-line bg-white p-4">
            <div className="grid gap-3 xl:grid-cols-[auto_minmax(180px,260px)_auto] xl:items-center">
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-accent-soft px-4 py-2 text-sm font-black text-accent-ink">
                  {matchIndex + 1}세트
                </span>
              </div>
              <div className="grid gap-2 rounded-lg border border-line bg-surface-strong px-3 py-3">
                {isPersonalLeague ? (
                  <span className="rounded-full bg-accent-soft px-3 py-1 text-xs font-semibold text-accent-ink">
                    1:1
                  </span>
                ) : (
                  <>
                    <label className="flex items-center gap-2 text-sm font-semibold text-foreground">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-line-strong text-accent focus:ring-accent"
                        checked={isTeamPlayMatch(match)}
                        onChange={(event) =>
                          updateTeamPlayEnabled(matchIndex, event.target.checked)
                        }
                      />
                      팀플
                    </label>
                    {isTeamPlayMatch(match) ? (
                      <select
                        className={SELECT_CLASS_NAME}
                        value={getTeamPlaySlotCount(match)}
                        onChange={(event) =>
                          updateTeamPlaySlotCount(
                            matchIndex,
                            Number.parseInt(event.target.value, 10) as 2 | 3 | 4,
                          )
                        }
                      >
                        {TEAM_PLAY_OPTIONS.map((option) => (
                          <option key={option.slotCount} value={option.slotCount}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="rounded-full bg-accent-soft px-3 py-1 text-xs font-semibold text-accent-ink">
                        1:1
                      </span>
                    )}
                  </>
                )}
              </div>
              <div className="flex flex-wrap gap-2 xl:justify-end">
                <Button
                  size="sm"
                  aria-label={`${matchIndex + 1}세트 위로 이동`}
                  disabled={matchIndex === 0}
                  onClick={() => moveMatch(matchIndex, -1)}
                >
                  ↑
                </Button>
                <Button
                  size="sm"
                  aria-label={`${matchIndex + 1}세트 아래로 이동`}
                  disabled={matchIndex === matches.length - 1}
                  onClick={() => moveMatch(matchIndex, 1)}
                >
                  ↓
                </Button>
                <Button size="sm" variant="danger" onClick={() => removeMatch(matchIndex)}>
                  삭제
                </Button>
              </div>
            </div>

            <div className="mt-4 grid gap-3">
              <label className="grid gap-2 text-sm font-semibold text-foreground">
                맵
                <HomeScheduleMapSearch
                  mapName={match.mapName}
                  onClear={() =>
                    updateMatch(matchIndex, (current) => ({
                      ...current,
                      mapId: null,
                      mapName: "",
                    }))
                  }
                  onSelect={(map) =>
                    updateMatch(matchIndex, (current) => ({
                      ...current,
                      mapId: map.id,
                      mapName: map.mapName,
                    }))
                  }
                />
              </label>
            </div>

            <div className="mt-4 grid gap-3">
              <PlayerSideEditor
                players={visibleSideAPlayers}
                selectedUserIds={selectedUserIds}
                side="A"
                onUpdate={(playerIndex, updater) =>
                  updatePlayer(matchIndex, "A", playerIndex, updater)
                }
              />
              <PlayerSideEditor
                players={visibleSideBPlayers}
                selectedUserIds={selectedUserIds}
                side="B"
                onUpdate={(playerIndex, updater) =>
                  updatePlayer(matchIndex, "B", playerIndex, updater)
                }
              />
            </div>
          </div>
          );
        })}
      </div>
    </section>
  );
}

function PlayerSideEditor({
  onUpdate,
  players,
  selectedUserIds,
  side,
}: {
  onUpdate: (
    index: number,
    updater: (player: MatchPlayerFormState) => MatchPlayerFormState,
  ) => void;
  players: MatchPlayerFormState[];
  selectedUserIds: number[];
  side: HomeSchedulePlayerSide;
}) {
  const teamLabel = `${side}팀`;

  return (
    <div className="rounded-lg border border-line bg-surface-strong p-3">
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-foreground">
          {teamLabel}
        </p>
      </div>

      <div className="space-y-3">
        {players.map((player, index) => (
          <div
            key={`${side}-${player.id ?? "new"}-${index}`}
            className="grid gap-3 rounded-lg border border-line bg-white p-3"
          >
            <HomeSchedulePlayerSearch
              disabledUserIds={selectedUserIds.filter(
                (userId) => userId !== player.userId,
              )}
              onSelect={(user) =>
                onUpdate(index, (current) => ({
                  ...current,
                  userId: user.id,
                  playerName: user.userId,
                  playerRank: user.tier ?? "",
                  playerRace: user.race ?? "",
                }))
              }
            />

            <div className="grid gap-3 md:grid-cols-[minmax(0,1.1fr)_120px_140px]">
              <label className="grid gap-2 text-sm font-semibold text-foreground">
                아이디
                <Input
                  value={player.playerName}
                  onChange={(event) =>
                    onUpdate(index, (current) => ({
                      ...current,
                      userId: null,
                      playerName: event.target.value,
                    }))
                  }
                  placeholder="선수 ID"
                />
              </label>
              <label className="grid gap-2 text-sm font-semibold text-foreground">
                티어
                <Input
                  value={player.playerRank}
                  onChange={(event) =>
                    onUpdate(index, (current) => ({
                      ...current,
                      playerRank: event.target.value,
                    }))
                  }
                  placeholder="A+"
                />
              </label>
              <label className="grid gap-2 text-sm font-semibold text-foreground">
                종족
                <select
                  className={SELECT_CLASS_NAME}
                  value={player.playerRace}
                  onChange={(event) =>
                    onUpdate(index, (current) => ({
                      ...current,
                      playerRace: event.target.value as StarcraftRace | "",
                    }))
                  }
                >
                  {RACE_OPTIONS.map((option) => (
                    <option key={option.value || "none"} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
