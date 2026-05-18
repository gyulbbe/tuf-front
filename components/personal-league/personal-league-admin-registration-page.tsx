"use client";

import Link from "next/link";
import {
  type FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  createAdminPersonalLeague,
  getAdminPersonalLeague,
  updateAdminPersonalLeague,
  type AdminPersonalLeagueCreateRequest,
  type AdminPersonalLeagueDetail,
  type PersonalLeagueBestOf,
  type PersonalLeagueBracketType,
} from "@/lib/api/personal-league";
import { DraftUserSearch } from "@/components/draft/draft-user-search";
import type { DraftUserSearchResult } from "@/lib/api/draft-users";
import {
  DEFAULT_TOURNAMENT_BEST_OF,
  isValidTournamentBestOf,
  MIN_TOURNAMENT_BEST_OF,
  normalizeTournamentBestOf,
} from "@/lib/tournament/create-types";
import { SurfaceCard } from "@/components/site/surface-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type NoticeTone = "error" | "success";

type NoticeState = {
  tone: NoticeTone;
  text: string;
};

type SelectedPlayer = {
  id: number | null;
  userId: string;
  tier: string | null;
  race: string | null;
};

type LeagueFormState = {
  leagueName: string;
  seasonName: string;
  description: string;
  startDate: string;
  endDate: string;
};

type UserSearchInputProps = {
  disabled?: boolean;
  label: string;
  onCommit?: (user: SelectedPlayer) => void;
  onSelect: (user: SelectedPlayer) => void;
  placeholder: string;
  selectedUser: SelectedPlayer | null;
};

type PersonalLeagueAdminRegistrationPageProps = {
  personalLeagueId?: number;
};

type DualPreviewGroup = {
  code: string;
  players: SelectedPlayer[];
  byeCount: number;
};

function getTodayDateInputValue() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function createInitialLeagueForm(): LeagueFormState {
  return {
    leagueName: "",
    seasonName: "",
    description: "",
    startDate: getTodayDateInputValue(),
    endDate: "",
  };
}

const bracketTypeLabels: Record<PersonalLeagueBracketType, string> = {
  SINGLE_ELIMINATION: "싱글 엘리미네이션",
  DUAL_GROUP: "듀얼 조별전",
};

const selectClassName =
  "w-full rounded-lg border border-line-strong bg-surface-strong px-4 py-3 text-sm text-foreground outline-none transition-colors focus:border-accent focus:bg-white disabled:cursor-not-allowed disabled:opacity-70";

function adminPersonalLeagueEditPath(personalLeagueId: number) {
  return `/admin/personal-league/${personalLeagueId}`;
}

function adminTournamentPath(tournamentId: number) {
  return `/admin/tournament/${tournamentId}`;
}

function toSelectedPlayer(user: DraftUserSearchResult): SelectedPlayer {
  return {
    id: user.id,
    userId: user.userId,
    tier: user.tier,
    race: user.race,
  };
}

function selectedPlayerFromUserId(
  userId: string | null | undefined,
  race?: string | null,
): SelectedPlayer | null {
  const trimmed = userId?.trim();

  return trimmed
    ? { id: null, userId: trimmed, tier: null, race: race ?? null }
    : null;
}

function toDraftUserSearchResult(
  user: SelectedPlayer | null,
): DraftUserSearchResult | null {
  return user
    ? {
        id: user.id ?? -1,
        userId: user.userId,
        tier: user.tier,
        race: user.race,
      }
    : null;
}

function readErrorMessage(error: unknown, fallback = "개인리그 저장에 실패했습니다.") {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return fallback;
}

function getNoticeClassName(tone: NoticeTone) {
  return tone === "success"
    ? "border border-success-ink/15 bg-success-soft text-success-ink"
    : "border border-danger-ink/15 bg-danger-soft text-danger-ink";
}

function normalizeUserId(userId: string) {
  return userId.trim().toLowerCase();
}

function getMetaText(user: SelectedPlayer | DraftUserSearchResult) {
  const parts = [user.tier, user.race].filter(
    (value): value is string => typeof value === "string" && value.trim().length > 0,
  );

  return parts.length > 0 ? parts.join(" · ") : "정보 없음";
}

function parseBestOf(value: string): PersonalLeagueBestOf {
  const parsed = Number(value);

  return normalizeTournamentBestOf(parsed);
}

function buildDualPreview(players: SelectedPlayer[]): DualPreviewGroup[] {
  const groups: DualPreviewGroup[] = [];

  for (let start = 0; start < players.length; start += 4) {
    const groupIndex = start / 4;
    const code =
      groupIndex < 26 ? String.fromCharCode(65 + groupIndex) : `G${groupIndex + 1}`;
    const groupPlayers = players.slice(start, start + 4);

    groups.push({
      code,
      players: groupPlayers,
      byeCount: Math.max(0, 4 - groupPlayers.length),
    });
  }

  return groups;
}

function buildValidationMessages(
  form: LeagueFormState,
  players: SelectedPlayer[],
  createTournament: boolean,
  bracketType: PersonalLeagueBracketType | "",
  bestOf: string,
) {
  const messages: string[] = [];

  if (!form.leagueName.trim()) {
    messages.push("개인리그명을 입력해주세요.");
  }

  if (!form.seasonName.trim()) {
    messages.push("시즌명을 입력해주세요.");
  }

  if (players.length < 2) {
    messages.push("선수를 최소 2명 이상 추가해주세요.");
  }

  const duplicatedPlayer = players.find(
    (player, index) =>
      players.findIndex((item) => normalizeUserId(item.userId) === normalizeUserId(player.userId)) !==
      index,
  );

  if (duplicatedPlayer) {
    messages.push(`선수가 중복되었습니다. ${duplicatedPlayer.userId}`);
  }

  if (!createTournament) {
    return messages;
  }

  if (bracketType !== "SINGLE_ELIMINATION" && bracketType !== "DUAL_GROUP") {
    messages.push("토너먼트 방식을 선택해주세요.");
  }

  if (!isValidTournamentBestOf(Number(bestOf))) {
    messages.push("BO는 1 이상의 홀수여야 합니다.");
  }

  return messages;
}

function UserSearchInput({
  disabled = false,
  label,
  onCommit,
  onSelect,
  placeholder,
  selectedUser,
}: UserSearchInputProps) {
  return (
    <DraftUserSearch
      clearOnSelect={Boolean(onCommit)}
      disabled={disabled}
      label={label}
      onSelect={(user) => {
        const selected = toSelectedPlayer(user);

        onSelect(selected);
        onCommit?.(selected);
      }}
      placeholder={placeholder}
      selectedUser={toDraftUserSearchResult(selectedUser)}
    />
  );
}

export function PersonalLeagueAdminRegistrationPage({
  personalLeagueId,
}: PersonalLeagueAdminRegistrationPageProps) {
  const isEditMode = typeof personalLeagueId === "number";
  const [form, setForm] = useState<LeagueFormState>(() =>
    createInitialLeagueForm(),
  );
  const [players, setPlayers] = useState<SelectedPlayer[]>([]);
  const [playerCandidate, setPlayerCandidate] = useState<SelectedPlayer | null>(null);
  const [createTournament, setCreateTournament] = useState(true);
  const [bracketType, setBracketType] =
    useState<PersonalLeagueBracketType>("SINGLE_ELIMINATION");
  const [bestOf, setBestOf] = useState(String(DEFAULT_TOURNAMENT_BEST_OF));
  const [notice, setNotice] = useState<NoticeState | null>(null);
  const [savedLeague, setSavedLeague] =
    useState<AdminPersonalLeagueDetail | null>(null);
  const [loadedLeague, setLoadedLeague] =
    useState<AdminPersonalLeagueDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(isEditMode);
  const [saving, setSaving] = useState(false);

  const tournamentLocked = Boolean(isEditMode && loadedLeague?.tournamentId);
  const formLocked = Boolean(loadedLeague && !loadedLeague.canEditTournament);
  const validationMessages = useMemo(
    () =>
      buildValidationMessages(
        form,
        players,
        createTournament,
        bracketType,
        bestOf,
      ),
    [bestOf, bracketType, createTournament, form, players],
  );
  const canSubmit =
    validationMessages.length === 0 && !saving && !loadingDetail && !formLocked;
  const dualPreview = useMemo(() => buildDualPreview(players), [players]);
  const successLeague = savedLeague;
  const successTournamentHref =
    typeof successLeague?.tournamentId === "number"
      ? adminTournamentPath(successLeague.tournamentId)
      : null;

  useEffect(() => {
    if (!isEditMode || typeof personalLeagueId !== "number") {
      return;
    }

    const targetPersonalLeagueId = personalLeagueId;
    let cancelled = false;

    async function loadPersonalLeague() {
      setLoadingDetail(true);
      setNotice(null);

      try {
        const detail = await getAdminPersonalLeague(targetPersonalLeagueId);

        if (cancelled) {
          return;
        }

        const nextCreateTournament = typeof detail.tournamentId === "number";

        setLoadedLeague(detail);
        setSavedLeague(null);
        setForm({
          leagueName: detail.leagueName,
          seasonName: detail.seasonName,
          description: detail.description ?? "",
          startDate: detail.startDate ?? "",
          endDate: detail.endDate ?? "",
        });
        setPlayers(
          detail.players
            .map((player) => selectedPlayerFromUserId(player.userId, player.race))
            .filter((player): player is SelectedPlayer => player !== null),
        );
        setCreateTournament(nextCreateTournament);
        setBracketType(detail.tournamentBracketType ?? "SINGLE_ELIMINATION");
        setBestOf(String(detail.tournamentBestOf ?? 3));
      } catch (error) {
        if (!cancelled) {
          setNotice({
            tone: "error",
            text: readErrorMessage(error, "개인리그 정보를 불러오지 못했습니다."),
          });
        }
      } finally {
        if (!cancelled) {
          setLoadingDetail(false);
        }
      }
    }

    void loadPersonalLeague();

    return () => {
      cancelled = true;
    };
  }, [isEditMode, personalLeagueId]);

  function updateForm<K extends keyof LeagueFormState>(
    key: K,
    value: LeagueFormState[K],
  ) {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function handleCreateTournamentChange(checked: boolean) {
    if (tournamentLocked && !checked) {
      setNotice({
        tone: "error",
        text: "이미 연결된 토너먼트는 이 화면에서 해제할 수 없습니다.",
      });
      return;
    }

    setCreateTournament(checked);
  }

  function handleAddPlayer(playerToAdd: SelectedPlayer | null = playerCandidate) {
    if (!playerToAdd) {
      setNotice({ tone: "error", text: "추가할 선수 ID를 선택해주세요." });
      return;
    }

    if (
      players.some(
        (player) => normalizeUserId(player.userId) === normalizeUserId(playerToAdd.userId),
      )
    ) {
      setNotice({
        tone: "error",
        text: `이미 추가된 선수입니다. ${playerToAdd.userId}`,
      });
      return;
    }

    setPlayers((current) => [...current, playerToAdd]);
    setPlayerCandidate(null);
    setNotice(null);
  }

  function movePlayer(index: number, direction: -1 | 1) {
    const nextIndex = index + direction;

    if (nextIndex < 0 || nextIndex >= players.length) {
      return;
    }

    setPlayers((current) => {
      const next = [...current];
      const moving = next[index];

      next[index] = next[nextIndex];
      next[nextIndex] = moving;
      return next;
    });
  }

  function buildPayload(): AdminPersonalLeagueCreateRequest {
    return {
      leagueName: form.leagueName.trim(),
      seasonName: form.seasonName.trim(),
      description: form.description.trim(),
      status: "LIVE",
      leagueType: "PERSONAL",
      startDate: form.startDate || null,
      endDate: form.endDate || null,
      createTournament,
      players: players.map((player) => ({
        userId: player.userId,
      })),
      tournament: createTournament
        ? {
            bracketType,
            bestOf: parseBestOf(bestOf),
          }
        : null,
    };
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (validationMessages.length > 0) {
      setNotice({ tone: "error", text: validationMessages[0] });
      return;
    }

    setSaving(true);
    setNotice(null);

    try {
      const targetPersonalLeagueId = personalLeagueId;
      const saved =
        isEditMode && typeof targetPersonalLeagueId === "number"
          ? await updateAdminPersonalLeague(targetPersonalLeagueId, buildPayload())
          : await createAdminPersonalLeague(buildPayload());

      setSavedLeague(saved);
      setLoadedLeague(saved);
      setNotice({
        tone: "success",
        text: isEditMode
          ? "개인리그가 수정되었습니다."
          : "개인리그가 등록되었습니다.",
      });
    } catch (error) {
      setNotice({ tone: "error", text: readErrorMessage(error) });
    } finally {
      setSaving(false);
    }
  }

  const pageTitle = isEditMode ? "개인리그 수정" : "개인리그 등록";
  const submitLabel = isEditMode ? "개인리그 수정" : "개인리그 등록";

  return (
    <div className="space-y-4">
      <SurfaceCard className="p-7 sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-accent">
          Admin Personal League
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          {pageTitle}
        </h1>
      </SurfaceCard>

      {notice ? (
        <div className={cn("rounded-lg px-4 py-3 text-sm", getNoticeClassName(notice.tone))}>
          {notice.text}
        </div>
      ) : null}

      <form
        className="grid gap-4 xl:grid-cols-[minmax(240px,360px)_minmax(0,1fr)_320px]"
        onSubmit={handleSubmit}
      >
        <div className="space-y-4">
          <SurfaceCard className="space-y-4 p-5 sm:p-6">
            <h2 className="text-xl font-semibold text-foreground">기본 정보</h2>
            <label className="grid gap-2 text-sm font-semibold text-foreground">
              개인리그명
              <Input
                value={form.leagueName}
                disabled={formLocked}
                onChange={(event) => updateForm("leagueName", event.target.value)}
                placeholder="예: 2026 개인리그"
              />
            </label>
            <label className="grid gap-2 text-sm font-semibold text-foreground">
              시즌명
              <Input
                value={form.seasonName}
                disabled={formLocked}
                onChange={(event) => updateForm("seasonName", event.target.value)}
                placeholder="예: 2026 시즌1"
              />
            </label>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
              <label className="grid gap-2 text-sm font-semibold text-foreground">
                시작일
                <Input
                  type="date"
                  value={form.startDate}
                  disabled={formLocked}
                  onChange={(event) => updateForm("startDate", event.target.value)}
                />
              </label>
              <label className="grid gap-2 text-sm font-semibold text-foreground">
                종료일
                <Input
                  type="date"
                  value={form.endDate}
                  disabled={formLocked}
                  onChange={(event) => updateForm("endDate", event.target.value)}
                />
              </label>
            </div>
            <label className="grid gap-2 text-sm font-semibold text-foreground">
              설명
              <Textarea
                value={form.description}
                disabled={formLocked}
                onChange={(event) => updateForm("description", event.target.value)}
                placeholder="시즌 설명"
                rows={5}
              />
            </label>
          </SurfaceCard>

          <SurfaceCard className="space-y-4 p-5 sm:p-6">
            <label className="flex items-center justify-between gap-3 text-sm font-semibold text-foreground">
              <span>토너먼트 함께 생성</span>
              <input
                type="checkbox"
                className="h-5 w-5 rounded border-line-strong text-accent focus:ring-accent disabled:cursor-not-allowed disabled:opacity-70"
                checked={createTournament}
                disabled={formLocked || tournamentLocked}
                onChange={(event) =>
                  handleCreateTournamentChange(event.target.checked)
                }
              />
            </label>
            {tournamentLocked ? (
              <p className="rounded-lg border border-line bg-surface-muted px-4 py-3 text-sm text-muted">
                이미 토너먼트가 연결되어 있어 체크를 해제할 수 없습니다.
              </p>
            ) : null}
          </SurfaceCard>
        </div>

        <div className="space-y-4">
          {createTournament ? (
            <SurfaceCard className="space-y-4 p-5 sm:p-6">
              <h2 className="text-xl font-semibold text-foreground">토너먼트 설정</h2>
              <div className="grid gap-3 md:grid-cols-2">
                <label className="grid gap-2 text-sm font-semibold text-foreground">
                  방식
                  <select
                    className={selectClassName}
                    value={bracketType}
                    disabled={formLocked}
                    onChange={(event) =>
                      setBracketType(event.target.value as PersonalLeagueBracketType)
                    }
                  >
                    <option value="SINGLE_ELIMINATION">싱글 엘리미네이션</option>
                    <option value="DUAL_GROUP">듀얼 조별전</option>
                  </select>
                </label>
                <label className="grid gap-2 text-sm font-semibold text-foreground">
                  BO
                  <Input
                    type="number"
                    min={MIN_TOURNAMENT_BEST_OF}
                    step={2}
                    value={bestOf}
                    disabled={formLocked}
                    onBlur={(event) =>
                      setBestOf(String(normalizeTournamentBestOf(Number(event.target.value))))
                    }
                    onChange={(event) => setBestOf(event.target.value)}
                  />
                </label>
              </div>
              {bracketType === "DUAL_GROUP" ? (
                <div className="rounded-lg border border-line bg-surface-muted px-4 py-4">
                  <p className="text-sm font-semibold text-foreground">
                    듀얼 조별전 미리보기
                  </p>
                  {dualPreview.length === 0 ? (
                    <p className="mt-3 text-sm text-muted">추가된 선수가 없습니다.</p>
                  ) : (
                    <div className="mt-3 grid gap-2 md:grid-cols-2">
                      {dualPreview.map((group) => (
                        <div
                          key={group.code}
                          className="rounded-lg border border-line bg-white px-4 py-3"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-sm font-semibold text-foreground">
                              {group.code}조
                            </p>
                            <span className="text-xs font-semibold text-muted">
                              BYE {group.byeCount}
                            </span>
                          </div>
                          <ol className="mt-2 space-y-1 text-sm text-muted">
                            {group.players.map((player, index) => (
                              <li key={player.userId} className="truncate">
                                {index + 1}. {player.userId}
                              </li>
                            ))}
                          </ol>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : null}
            </SurfaceCard>
          ) : null}

          <SurfaceCard className="space-y-4 p-5 sm:p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-xl font-semibold text-foreground">선수 설정</h2>
                <p className="mt-2 text-sm text-muted">
                  선수 순서가 토너먼트 시드와 슬롯 순서가 됩니다.
                </p>
              </div>
              <span className="rounded-full bg-surface-muted px-3 py-1 text-xs font-semibold text-muted">
                {players.length}명
              </span>
            </div>
            <div className="grid gap-3">
              <UserSearchInput
                key={`player-${playerCandidate?.userId ?? "empty"}`}
                disabled={formLocked}
                label="선수 ID 검색"
                selectedUser={playerCandidate}
                placeholder="선수 ID 검색"
                onCommit={handleAddPlayer}
                onSelect={setPlayerCandidate}
              />
            </div>
            {players.length === 0 ? (
              <p className="rounded-lg border border-dashed border-line px-4 py-6 text-center text-sm text-muted">
                추가된 선수가 없습니다.
              </p>
            ) : (
              <div className="grid gap-2">
                {players.map((player, index) => (
                  <div
                    key={`${player.userId}-${index}`}
                    className="flex flex-col gap-3 rounded-lg border border-line bg-surface-strong px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-muted">
                        #{index + 1}
                      </p>
                      <p className="truncate text-sm font-semibold text-foreground">
                        {player.userId}
                      </p>
                      <p className="mt-1 truncate text-xs text-muted">
                        {getMetaText(player)}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        disabled={formLocked || index === 0}
                        onClick={() => movePlayer(index, -1)}
                      >
                        위로
                      </Button>
                      <Button
                        size="sm"
                        disabled={formLocked || index === players.length - 1}
                        onClick={() => movePlayer(index, 1)}
                      >
                        아래로
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        disabled={formLocked}
                        onClick={() =>
                          setPlayers((current) =>
                            current.filter((_, playerIndex) => playerIndex !== index),
                          )
                        }
                      >
                        삭제
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SurfaceCard>
        </div>

        <SurfaceCard className="space-y-5 p-5 sm:p-6 xl:sticky xl:top-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">
              Summary
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-foreground">생성 요약</h2>
          </div>

          <dl className="grid gap-3 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-muted">개인리그명</dt>
              <dd className="truncate font-semibold text-foreground">
                {form.leagueName.trim() || "미입력"}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted">기간</dt>
              <dd className="font-semibold text-foreground">
                {form.startDate || "-"} ~ {form.endDate || "-"}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted">선수 수</dt>
              <dd className="font-semibold text-foreground">{players.length}명</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted">토너먼트 생성</dt>
              <dd className="font-semibold text-foreground">
                {createTournament ? "생성" : "미생성"}
              </dd>
            </div>
            {createTournament ? (
              <>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted">방식</dt>
                  <dd className="font-semibold text-foreground">
                    {bracketTypeLabels[bracketType]}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted">BO</dt>
                  <dd className="font-semibold text-foreground">BO{bestOf}</dd>
                </div>
              </>
            ) : null}
          </dl>

          {formLocked ? (
            <div className="rounded-lg border border-warning-ink/20 bg-warning-soft px-4 py-3 text-sm leading-6 text-warning-ink">
              종료되지 않았고 연결 토너먼트가 아직 진행 전인 개인리그만 수정할 수 있습니다.
            </div>
          ) : validationMessages.length > 0 ? (
            <div className="rounded-lg border border-warning-ink/20 bg-warning-soft px-4 py-3 text-sm leading-6 text-warning-ink">
              {validationMessages.slice(0, 4).map((message) => (
                <p key={message}>{message}</p>
              ))}
              {validationMessages.length > 4 ? (
                <p>외 {validationMessages.length - 4}개 항목을 확인해주세요.</p>
              ) : null}
            </div>
          ) : (
            <p className="rounded-lg border border-success-ink/15 bg-success-soft px-4 py-3 text-sm text-success-ink">
              저장할 준비가 되었습니다.
            </p>
          )}

          <Button type="submit" variant="accent" fullWidth disabled={!canSubmit}>
            {saving ? "저장 중" : submitLabel}
          </Button>

          {successLeague ? (
            <div className="rounded-lg border border-line bg-surface-muted px-4 py-4 text-sm leading-6 text-muted">
              <p className="font-semibold text-foreground">
                {isEditMode ? "개인리그가 수정되었습니다." : "개인리그가 등록되었습니다."}
              </p>
              <p className="mt-1">ID: {successLeague.id}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Link
                  href={adminPersonalLeagueEditPath(successLeague.id)}
                  className="inline-flex rounded-full border border-line-strong bg-white px-4 py-2 text-sm font-semibold text-muted transition-colors hover:border-accent hover:bg-accent-soft hover:text-accent-ink"
                >
                  수정 화면
                </Link>
                {successTournamentHref ? (
                  <Link
                    href={successTournamentHref}
                    className="inline-flex rounded-full bg-accent px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent-ink"
                  >
                    토너먼트 관리
                  </Link>
                ) : null}
              </div>
            </div>
          ) : null}
        </SurfaceCard>
      </form>
    </div>
  );
}
