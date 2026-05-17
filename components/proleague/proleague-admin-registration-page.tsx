"use client";

import Link from "next/link";
import {
  type FormEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  createAdminProleague,
  type AdminProleagueCreateRequest,
  type AdminProleagueDetail,
  type AdminProleagueDraftOrderMode,
} from "@/lib/api/proleague";
import {
  searchDraftUsers,
  type DraftUserSearchResult,
} from "@/lib/api/draft";
import { proleagueDraftLivePath } from "@/lib/proleague-draft/routes";
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

type SelectedDraftUser = {
  userId: string;
  tier: string | null;
  race: string | null;
};

type DraftTeamForm = {
  key: string;
  teamName: string;
  leader: SelectedDraftUser | null;
  viceLeader: SelectedDraftUser | null;
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
  onSelect: (user: SelectedDraftUser) => void;
  placeholder: string;
  selectedUser: SelectedDraftUser | null;
};

const selectClassName =
  "w-full rounded-lg border border-line-strong bg-surface-strong px-4 py-3 text-sm text-foreground outline-none transition-colors focus:border-accent focus:bg-white disabled:cursor-not-allowed disabled:opacity-70";

const orderModeLabels: Record<AdminProleagueDraftOrderMode, string> = {
  BASIC: "기본 순서",
  SNAKE: "스네이크",
};

const initialLeagueForm: LeagueFormState = {
  leagueName: "",
  seasonName: "",
  description: "",
  startDate: "",
  endDate: "",
};

function createInitialTeams(count = 4): DraftTeamForm[] {
  return Array.from({ length: count }, (_, index) => ({
    key: `team-${index + 1}`,
    teamName: "",
    leader: null,
    viceLeader: null,
  }));
}

function readErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return "프로리그 등록에 실패했습니다.";
}

function getNoticeClassName(tone: NoticeTone) {
  return tone === "success"
    ? "border border-success-ink/15 bg-success-soft text-success-ink"
    : "border border-danger-ink/15 bg-danger-soft text-danger-ink";
}

function getMetaText(user: SelectedDraftUser | DraftUserSearchResult) {
  const parts = [user.tier, user.race].filter(
    (value): value is string => typeof value === "string" && value.trim().length > 0,
  );

  return parts.length > 0 ? parts.join(" · ") : "정보 없음";
}

function toSelectedUser(user: DraftUserSearchResult): SelectedDraftUser {
  return {
    userId: user.userId,
    tier: user.tier,
    race: user.race,
  };
}

function hasTeamInput(team: DraftTeamForm) {
  return Boolean(team.teamName.trim() || team.leader || team.viceLeader);
}

function buildValidationMessages(
  form: LeagueFormState,
  createDraft: boolean,
  teams: DraftTeamForm[],
  pickTimeSeconds: string,
  orderMode: AdminProleagueDraftOrderMode,
  candidates: SelectedDraftUser[],
) {
  const messages: string[] = [];

  if (!form.leagueName.trim()) {
    messages.push("프로리그명을 입력해주세요.");
  }

  if (!form.seasonName.trim()) {
    messages.push("시즌명을 입력해주세요.");
  }

  if (!form.startDate) {
    messages.push("시작일을 선택해주세요.");
  }

  if (!form.endDate) {
    messages.push("종료일을 선택해주세요.");
  }

  if (!createDraft) {
    return messages;
  }

  const pickTime = Number(pickTimeSeconds);

  if (!Number.isInteger(pickTime) || pickTime < 1) {
    messages.push("픽 제한 시간은 1초 이상이어야 합니다.");
  }

  if (orderMode !== "BASIC" && orderMode !== "SNAKE") {
    messages.push("지명 순서를 선택해주세요.");
  }

  if (teams.length < 2) {
    messages.push("팀은 최소 2개 이상이어야 합니다.");
  }

  teams.forEach((team, index) => {
    const teamLabel = `${index + 1}팀`;

    if (!team.teamName.trim()) {
      messages.push(`${teamLabel} 팀명을 입력해주세요.`);
    }

    if (!team.leader) {
      messages.push(`${teamLabel} 팀장 ID를 선택해주세요.`);
    }

    if (!team.viceLeader) {
      messages.push(`${teamLabel} 부팀장 ID를 선택해주세요.`);
    }

    if (team.leader && team.viceLeader && team.leader.userId === team.viceLeader.userId) {
      messages.push(`${teamLabel} 팀장과 부팀장은 같을 수 없습니다.`);
    }
  });

  const assignedUserIds = teams.flatMap((team) =>
    [team.leader?.userId, team.viceLeader?.userId].filter(
      (value): value is string => typeof value === "string" && value.length > 0,
    ),
  );
  const duplicatedAssignedUserId = assignedUserIds.find(
    (userId, index) => assignedUserIds.indexOf(userId) !== index,
  );

  if (duplicatedAssignedUserId) {
    messages.push(`팀장/부팀장 배정이 중복되었습니다: ${duplicatedAssignedUserId}`);
  }

  const duplicatedCandidate = candidates.find(
    (candidate, index) =>
      candidates.findIndex((item) => item.userId === candidate.userId) !== index,
  );

  if (duplicatedCandidate) {
    messages.push(`후보가 중복되었습니다: ${duplicatedCandidate.userId}`);
  }

  return messages;
}

function UserSearchInput({
  disabled = false,
  onSelect,
  placeholder,
  selectedUser,
}: UserSearchInputProps) {
  const [query, setQuery] = useState(selectedUser?.userId ?? "");
  const [results, setResults] = useState<DraftUserSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

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

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [open]);

  useEffect(() => {
    const keyword = query.trim();

    if (!keyword || selectedUser?.userId === keyword) {
      return;
    }

    let cancelled = false;
    const timeoutId = window.setTimeout(async () => {
      setLoading(true);

      try {
        const nextResults = (await searchDraftUsers(keyword, 8)).filter((user) =>
          user.userId.toLowerCase().includes(keyword.toLowerCase()),
        );

        if (!cancelled) {
          setResults(nextResults);
          setOpen(true);
        }
      } catch {
        if (!cancelled) {
          setResults([]);
          setOpen(true);
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
  }, [query, selectedUser?.userId]);

  function handleSelect(user: DraftUserSearchResult) {
    const selected = toSelectedUser(user);

    setQuery(selected.userId);
    setOpen(false);
    setResults([]);
    onSelect(selected);
  }

  return (
    <div ref={rootRef} className={cn("relative", open ? "z-30" : "z-0")}>
      <Input
        value={query}
        disabled={disabled}
        placeholder={placeholder}
        onChange={(event) => {
          const nextQuery = event.target.value;

          setQuery(nextQuery);

          if (!nextQuery.trim() || selectedUser?.userId === nextQuery.trim()) {
            setResults([]);
            setLoading(false);
            setOpen(false);
            return;
          }

          setOpen(true);
        }}
        onFocus={() => {
          if (query.trim() && selectedUser?.userId !== query.trim()) {
            setOpen(true);
          }
        }}
      />
      {selectedUser ? (
        <p className="mt-2 truncate text-xs font-semibold text-accent-ink">
          선택됨: {selectedUser.userId}
        </p>
      ) : null}
      {open ? (
        <div className="absolute left-0 right-0 top-full mt-2 max-h-72 overflow-y-auto rounded-lg border border-line bg-white p-2 shadow-[0_16px_50px_rgba(23,33,43,0.14)]">
          {loading ? (
            <p className="px-3 py-3 text-sm text-muted">검색 중입니다.</p>
          ) : results.length === 0 ? (
            <p className="px-3 py-3 text-sm text-muted">검색 결과가 없습니다.</p>
          ) : (
            results.map((user) => (
              <button
                key={user.userId}
                type="button"
                className="block w-full rounded-lg px-3 py-3 text-left transition-colors hover:bg-accent-soft"
                onClick={() => handleSelect(user)}
              >
                <span className="block truncate text-sm font-semibold text-foreground">
                  {user.userId}
                </span>
                <span className="mt-1 block truncate text-xs text-muted">
                  {getMetaText(user)}
                </span>
              </button>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}

export function ProleagueAdminRegistrationPage() {
  const [form, setForm] = useState<LeagueFormState>(initialLeagueForm);
  const [createDraft, setCreateDraft] = useState(true);
  const [teams, setTeams] = useState<DraftTeamForm[]>(() => createInitialTeams());
  const [pickTimeSeconds, setPickTimeSeconds] = useState("30");
  const [orderMode, setOrderMode] = useState<AdminProleagueDraftOrderMode>("BASIC");
  const [candidateDraftUser, setCandidateDraftUser] =
    useState<SelectedDraftUser | null>(null);
  const [candidates, setCandidates] = useState<SelectedDraftUser[]>([]);
  const [notice, setNotice] = useState<NoticeState | null>(null);
  const [createdProleague, setCreatedProleague] =
    useState<AdminProleagueDetail | null>(null);
  const [saving, setSaving] = useState(false);

  const validationMessages = useMemo(
    () =>
      buildValidationMessages(
        form,
        createDraft,
        teams,
        pickTimeSeconds,
        orderMode,
        candidates,
      ),
    [candidates, createDraft, form, orderMode, pickTimeSeconds, teams],
  );
  const canSubmit = validationMessages.length === 0 && !saving;
  const draftLiveHref =
    typeof createdProleague?.draftSessionId === "number"
      ? proleagueDraftLivePath(createdProleague.draftSessionId)
      : null;

  function updateForm<K extends keyof LeagueFormState>(
    key: K,
    value: LeagueFormState[K],
  ) {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function updateTeam(
    teamIndex: number,
    updater: (team: DraftTeamForm) => DraftTeamForm,
  ) {
    setTeams((current) =>
      current.map((team, index) => (index === teamIndex ? updater(team) : team)),
    );
  }

  function handleTeamCountChange(value: string) {
    const parsed = Number(value);
    const nextCount = Number.isInteger(parsed) ? Math.max(2, parsed) : teams.length;

    if (nextCount === teams.length) {
      return;
    }

    if (nextCount < teams.length) {
      const removedTeams = teams.slice(nextCount);

      if (removedTeams.some(hasTeamInput)) {
        setNotice({
          tone: "error",
          text: "제거될 팀에 입력값이 있습니다. 팀 정보를 비운 뒤 팀 수를 줄여주세요.",
        });
        return;
      }

      setTeams((current) => current.slice(0, nextCount));
      return;
    }

    setTeams((current) => [
      ...current,
      ...Array.from({ length: nextCount - current.length }, (_, index) => ({
        key: `team-${current.length + index + 1}`,
        teamName: "",
        leader: null,
        viceLeader: null,
      })),
    ]);
  }

  function handleAddCandidate() {
    if (!candidateDraftUser) {
      setNotice({ tone: "error", text: "후보로 추가할 유저 ID를 선택해주세요." });
      return;
    }

    if (candidates.some((candidate) => candidate.userId === candidateDraftUser.userId)) {
      setNotice({
        tone: "error",
        text: `이미 추가된 후보입니다: ${candidateDraftUser.userId}`,
      });
      return;
    }

    setCandidates((current) => [...current, candidateDraftUser]);
    setCandidateDraftUser(null);
    setNotice(null);
  }

  function buildPayload(): AdminProleagueCreateRequest {
    const pickTime = Number(pickTimeSeconds);

    return {
      leagueName: form.leagueName.trim(),
      seasonName: form.seasonName.trim(),
      description: form.description.trim(),
      status: "READY",
      startDate: form.startDate,
      endDate: form.endDate,
      createDraft,
      draft: createDraft
        ? {
            teamCount: teams.length,
            pickTimeSeconds:
              Number.isInteger(pickTime) && pickTime > 0 ? pickTime : 30,
            orderMode,
            teams: teams.map((team, index) => ({
              teamName: team.teamName.trim(),
              leaderUserId: team.leader?.userId ?? "",
              viceLeaderUserId: team.viceLeader?.userId ?? "",
              displayOrder: index + 1,
            })),
            candidates: candidates.map((candidate) => ({
              userId: candidate.userId,
            })),
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
    setCreatedProleague(null);

    try {
      const created = await createAdminProleague(buildPayload());

      setCreatedProleague(created);
      setNotice({ tone: "success", text: "프로리그가 등록되었습니다." });
    } catch (error) {
      setNotice({ tone: "error", text: readErrorMessage(error) });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <SurfaceCard className="p-7 sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-accent">
          Admin Proleague
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          프로리그 등록
        </h1>
      </SurfaceCard>

      {notice ? (
        <div className={cn("rounded-lg px-4 py-3 text-sm", getNoticeClassName(notice.tone))}>
          {notice.text}
        </div>
      ) : null}

      <form
        className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)_320px]"
        onSubmit={handleSubmit}
      >
        <div className="space-y-4">
          <SurfaceCard className="space-y-4 p-5 sm:p-6">
            <h2 className="text-xl font-semibold text-foreground">기본 정보</h2>
            <label className="grid gap-2 text-sm font-semibold text-foreground">
              프로리그명
              <Input
                value={form.leagueName}
                onChange={(event) => updateForm("leagueName", event.target.value)}
                placeholder="예: 2026 시즌1 프로리그"
              />
            </label>
            <label className="grid gap-2 text-sm font-semibold text-foreground">
              시즌명
              <Input
                value={form.seasonName}
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
                  onChange={(event) => updateForm("startDate", event.target.value)}
                />
              </label>
              <label className="grid gap-2 text-sm font-semibold text-foreground">
                종료일
                <Input
                  type="date"
                  value={form.endDate}
                  onChange={(event) => updateForm("endDate", event.target.value)}
                />
              </label>
            </div>
            <label className="grid gap-2 text-sm font-semibold text-foreground">
              설명
              <Textarea
                value={form.description}
                onChange={(event) => updateForm("description", event.target.value)}
                placeholder="시즌 설명"
                rows={5}
              />
            </label>
          </SurfaceCard>

          <SurfaceCard className="space-y-4 p-5 sm:p-6">
            <label className="flex items-center justify-between gap-3 text-sm font-semibold text-foreground">
              <span>드래프트 함께 생성</span>
              <input
                type="checkbox"
                className="h-5 w-5 rounded border-line-strong text-accent focus:ring-accent"
                checked={createDraft}
                onChange={(event) => setCreateDraft(event.target.checked)}
              />
            </label>
            <p className="text-sm leading-6 text-muted">
              체크하면 프로리그 등록과 동시에 프로리그 드래프트도 함께 생성합니다.
            </p>
          </SurfaceCard>
        </div>

        <div className="space-y-4">
          {createDraft ? (
            <>
              <SurfaceCard className="space-y-4 p-5 sm:p-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <h2 className="text-xl font-semibold text-foreground">
                      드래프트 설정
                    </h2>
                    <p className="mt-2 text-sm text-muted">
                      팀 수를 줄일 때 입력된 팀은 먼저 비워야 합니다.
                    </p>
                  </div>
                </div>
                <div className="grid gap-3 md:grid-cols-3">
                  <label className="grid gap-2 text-sm font-semibold text-foreground">
                    팀 수
                    <Input
                      type="number"
                      min={2}
                      value={teams.length}
                      onChange={(event) => handleTeamCountChange(event.target.value)}
                    />
                  </label>
                  <label className="grid gap-2 text-sm font-semibold text-foreground">
                    픽 제한 시간
                    <Input
                      type="number"
                      min={1}
                      value={pickTimeSeconds}
                      onChange={(event) => setPickTimeSeconds(event.target.value)}
                    />
                  </label>
                  <label className="grid gap-2 text-sm font-semibold text-foreground">
                    지명 순서
                    <select
                      className={selectClassName}
                      value={orderMode}
                      onChange={(event) =>
                        setOrderMode(event.target.value as AdminProleagueDraftOrderMode)
                      }
                    >
                      <option value="BASIC">기본 순서</option>
                      <option value="SNAKE">스네이크</option>
                    </select>
                  </label>
                </div>
              </SurfaceCard>

              <SurfaceCard className="space-y-4 p-5 sm:p-6">
                <h2 className="text-xl font-semibold text-foreground">팀 설정</h2>
                <div className="grid gap-4 lg:grid-cols-2">
                  {teams.map((team, index) => (
                    <div
                      key={team.key}
                      className="space-y-4 rounded-lg border border-line bg-surface-strong p-4"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <h3 className="text-lg font-semibold text-foreground">
                          {index + 1}팀
                        </h3>
                        <span className="rounded-full bg-surface-muted px-3 py-1 text-xs font-semibold text-muted">
                          표시 순서 {index + 1}
                        </span>
                      </div>
                      <label className="grid gap-2 text-sm font-semibold text-foreground">
                        팀명
                        <Input
                          value={team.teamName}
                          onChange={(event) =>
                            updateTeam(index, (current) => ({
                              ...current,
                              teamName: event.target.value,
                            }))
                          }
                          placeholder="예: Alpha"
                        />
                      </label>
                      <label className="grid gap-2 text-sm font-semibold text-foreground">
                        팀장 ID
                        <UserSearchInput
                          key={`leader-${team.key}-${team.leader?.userId ?? "empty"}`}
                          selectedUser={team.leader}
                          placeholder="팀장 ID 검색"
                          onSelect={(user) =>
                            updateTeam(index, (current) => ({
                              ...current,
                              leader: user,
                            }))
                          }
                        />
                        {team.leader ? (
                          <Button
                            size="sm"
                            onClick={() =>
                              updateTeam(index, (current) => ({
                                ...current,
                                leader: null,
                              }))
                            }
                          >
                            팀장 해제
                          </Button>
                        ) : null}
                      </label>
                      <label className="grid gap-2 text-sm font-semibold text-foreground">
                        부팀장 ID
                        <UserSearchInput
                          key={`vice-${team.key}-${team.viceLeader?.userId ?? "empty"}`}
                          selectedUser={team.viceLeader}
                          placeholder="부팀장 ID 검색"
                          onSelect={(user) =>
                            updateTeam(index, (current) => ({
                              ...current,
                              viceLeader: user,
                            }))
                          }
                        />
                        {team.viceLeader ? (
                          <Button
                            size="sm"
                            onClick={() =>
                              updateTeam(index, (current) => ({
                                ...current,
                                viceLeader: null,
                              }))
                            }
                          >
                            부팀장 해제
                          </Button>
                        ) : null}
                      </label>
                    </div>
                  ))}
                </div>
              </SurfaceCard>

              <SurfaceCard className="space-y-4 p-5 sm:p-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <h2 className="text-xl font-semibold text-foreground">
                      참가 후보 풀
                    </h2>
                    <p className="mt-2 text-sm text-muted">
                      후보는 중복 없이 추가됩니다.
                    </p>
                  </div>
                  <span className="rounded-full bg-surface-muted px-3 py-1 text-xs font-semibold text-muted">
                    {candidates.length}명
                  </span>
                </div>
                <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_120px]">
                  <UserSearchInput
                    key={`candidate-${candidateDraftUser?.userId ?? "empty"}`}
                    selectedUser={candidateDraftUser}
                    placeholder="후보 ID 검색"
                    onSelect={setCandidateDraftUser}
                  />
                  <Button variant="accent" onClick={handleAddCandidate}>
                    후보 추가
                  </Button>
                </div>
                {candidates.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-line px-4 py-6 text-center text-sm text-muted">
                    추가된 후보가 없습니다.
                  </p>
                ) : (
                  <div className="grid gap-2 sm:grid-cols-2">
                    {candidates.map((candidate) => (
                      <div
                        key={candidate.userId}
                        className="flex items-center justify-between gap-3 rounded-lg border border-line bg-surface-strong px-4 py-3"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-foreground">
                            {candidate.userId}
                          </p>
                          <p className="mt-1 truncate text-xs text-muted">
                            {getMetaText(candidate)}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          variant="danger"
                          onClick={() =>
                            setCandidates((current) =>
                              current.filter((item) => item.userId !== candidate.userId),
                            )
                          }
                        >
                          삭제
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </SurfaceCard>
            </>
          ) : (
            <SurfaceCard className="p-5 sm:p-6">
              <h2 className="text-xl font-semibold text-foreground">드래프트 미생성</h2>
              <p className="mt-3 text-sm leading-6 text-muted">
                프로리그 기본 정보만 등록합니다.
              </p>
            </SurfaceCard>
          )}
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
              <dt className="text-muted">프로리그명</dt>
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
              <dt className="text-muted">드래프트 생성</dt>
              <dd className="font-semibold text-foreground">
                {createDraft ? "생성" : "미생성"}
              </dd>
            </div>
            {createDraft ? (
              <>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted">팀 수</dt>
                  <dd className="font-semibold text-foreground">{teams.length}팀</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted">후보 수</dt>
                  <dd className="font-semibold text-foreground">
                    {candidates.length}명
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted">픽 제한 시간</dt>
                  <dd className="font-semibold text-foreground">
                    {pickTimeSeconds || "0"}초
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted">지명 순서</dt>
                  <dd className="font-semibold text-foreground">
                    {orderModeLabels[orderMode]}
                  </dd>
                </div>
              </>
            ) : null}
          </dl>

          {validationMessages.length > 0 ? (
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
              등록할 준비가 되었습니다.
            </p>
          )}

          <Button type="submit" variant="accent" fullWidth disabled={!canSubmit}>
            {saving ? "등록 중" : "프로리그 등록"}
          </Button>

          {createdProleague ? (
            <div className="rounded-lg border border-line bg-surface-muted px-4 py-4 text-sm leading-6 text-muted">
              <p className="font-semibold text-foreground">
                프로리그가 등록되었습니다.
              </p>
              <p className="mt-1">ID: {createdProleague.id}</p>
              {draftLiveHref ? (
                <Link
                  href={draftLiveHref}
                  className="mt-3 inline-flex rounded-full bg-accent px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent-ink"
                >
                  드래프트 진행 화면으로 이동
                </Link>
              ) : null}
            </div>
          ) : null}
        </SurfaceCard>
      </form>
    </div>
  );
}
