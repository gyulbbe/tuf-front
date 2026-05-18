"use client";

import Link from "next/link";
import {
  type FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  createAdminProleague,
  getAdminProleague,
  updateAdminProleague,
  type AdminProleagueCreateRequest,
  type AdminProleagueDetail,
  type AdminProleagueDraftOrderMode,
  type AdminProleagueTeam,
} from "@/lib/api/proleague";
import { DraftUserSearch } from "@/components/draft/draft-user-search";
import type { DraftUserSearchResult } from "@/lib/api/draft-users";
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
  id: number | null;
  userId: string;
  tier: string | null;
  race: string | null;
};

type DraftTeamForm = {
  key: string;
  teamName: string;
  leader: SelectedDraftUser | null;
  viceLeader: SelectedDraftUser | null;
  pickerUserId: string | null;
  members: SelectedDraftUser[];
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
  onCommit?: (user: SelectedDraftUser) => void;
  onSelect: (user: SelectedDraftUser) => void;
  placeholder: string;
  selectedUser: SelectedDraftUser | null;
};

type ProleagueAdminRegistrationPageProps = {
  proleagueId?: number;
};

const selectClassName =
  "w-full rounded-lg border border-line-strong bg-surface-strong px-4 py-3 text-sm text-foreground outline-none transition-colors focus:border-accent focus:bg-white disabled:cursor-not-allowed disabled:opacity-70";

const orderModeLabels: Record<AdminProleagueDraftOrderMode, string> = {
  BASIC: "기본 순서",
  SNAKE: "스네이크",
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

function adminProleagueEditPath(proleagueId: number) {
  return `/admin/proleague/${proleagueId}`;
}

function createInitialTeams(count = 4): DraftTeamForm[] {
  return Array.from({ length: count }, (_, index) => ({
    key: `team-${index + 1}`,
    teamName: "",
    leader: null,
    viceLeader: null,
    pickerUserId: null,
    members: [],
  }));
}

function toSelectedUser(user: DraftUserSearchResult): SelectedDraftUser {
  return {
    id: user.id,
    userId: user.userId,
    tier: user.tier,
    race: user.race,
  };
}

function selectedUserFromUserId(
  userId: string | null | undefined,
): SelectedDraftUser | null {
  const trimmed = userId?.trim();

  return trimmed ? { id: null, userId: trimmed, tier: null, race: null } : null;
}

function userFromUserId(
  userId: string | null | undefined,
  race?: string | null,
): SelectedDraftUser | null {
  const trimmed = userId?.trim();

  return trimmed
    ? { id: null, userId: trimmed, tier: null, race: race ?? null }
    : null;
}

const candidateFromUserId = userFromUserId;

function toDraftUserSearchResult(
  user: SelectedDraftUser | null,
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

function hasTeamInput(team: DraftTeamForm) {
  return Boolean(
    team.teamName.trim() ||
      team.leader ||
      team.viceLeader ||
      team.pickerUserId ||
      team.members.length > 0,
  );
}

function normalizeTeamPicker(team: DraftTeamForm, createDraft: boolean): DraftTeamForm {
  if (!createDraft) {
    return {
      ...team,
      pickerUserId: null,
    };
  }

  if (
    team.pickerUserId &&
    (team.pickerUserId === team.leader?.userId ||
      team.pickerUserId === team.viceLeader?.userId)
  ) {
    return team;
  }

  return {
    ...team,
    pickerUserId: null,
  };
}

function teamsFromDetail(teams: AdminProleagueTeam[]): DraftTeamForm[] {
  if (teams.length === 0) {
    return createInitialTeams();
  }

  return teams.map((team, index) => ({
    key: `team-${team.id ?? index + 1}`,
    teamName: team.teamName,
    leader: selectedUserFromUserId(team.leaderUserId),
    viceLeader: selectedUserFromUserId(team.viceLeaderUserId),
    pickerUserId: team.pickerUserId,
    members: team.members
      .map((member) => userFromUserId(member.userId, member.race))
      .filter((member): member is SelectedDraftUser => member !== null),
  }));
}

function readErrorMessage(error: unknown, fallback = "프로리그 저장에 실패했습니다.") {
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

function getMetaText(user: SelectedDraftUser | DraftUserSearchResult) {
  const parts = [user.tier, user.race].filter(
    (value): value is string => typeof value === "string" && value.trim().length > 0,
  );

  return parts.length > 0 ? parts.join(" · ") : "정보 없음";
}

function getAssignedTeamUserIds(teams: DraftTeamForm[]) {
  return teams.flatMap((team) =>
    [
      team.leader?.userId,
      team.viceLeader?.userId,
      ...team.members.map((member) => member.userId),
    ].filter((value): value is string => typeof value === "string" && value.length > 0),
  );
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

    if (
      createDraft &&
      (!team.pickerUserId ||
        (team.pickerUserId !== team.leader?.userId &&
          team.pickerUserId !== team.viceLeader?.userId))
    ) {
      messages.push(`${teamLabel} 드래프트 진행자를 팀장 또는 부팀장 중에서 선택해주세요.`);
    }
  });

  const assignedUserIds = getAssignedTeamUserIds(teams);
  const duplicatedAssignedUserId = assignedUserIds.find(
    (userId, index) => assignedUserIds.indexOf(userId) !== index,
  );

  if (duplicatedAssignedUserId) {
    messages.push(`팀장/부팀장/선수 배정이 중복되었습니다: ${duplicatedAssignedUserId}`);
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

  if (candidates.length === 0) {
    messages.push("드래프트 후보를 1명 이상 추가해주세요.");
  }

  const duplicatedCandidate = candidates.find(
    (candidate, index) =>
      candidates.findIndex((item) => item.userId === candidate.userId) !== index,
  );

  if (duplicatedCandidate) {
    messages.push(`후보가 중복되었습니다: ${duplicatedCandidate.userId}`);
  }

  const assignedCandidate = candidates.find((candidate) =>
    assignedUserIds.includes(candidate.userId),
  );

  if (assignedCandidate) {
    messages.push(
      `팀장/부팀장/선수로 배정된 ID는 참가 후보로 추가할 수 없습니다: ${assignedCandidate.userId}`,
    );
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
        const selected = toSelectedUser(user);

        onSelect(selected);
        onCommit?.(selected);
      }}
      placeholder={placeholder}
      selectedUser={toDraftUserSearchResult(selectedUser)}
    />
  );
}

export function ProleagueAdminRegistrationPage({
  proleagueId,
}: ProleagueAdminRegistrationPageProps) {
  const isEditMode = typeof proleagueId === "number";
  const [form, setForm] = useState<LeagueFormState>(() =>
    createInitialLeagueForm(),
  );
  const [createDraft, setCreateDraft] = useState(true);
  const [teams, setTeams] = useState<DraftTeamForm[]>(() => createInitialTeams());
  const [pickTimeSeconds, setPickTimeSeconds] = useState("30");
  const [orderMode, setOrderMode] = useState<AdminProleagueDraftOrderMode>("BASIC");
  const [candidateDraftUser, setCandidateDraftUser] =
    useState<SelectedDraftUser | null>(null);
  const [candidates, setCandidates] = useState<SelectedDraftUser[]>([]);
  const [notice, setNotice] = useState<NoticeState | null>(null);
  const [savedProleague, setSavedProleague] =
    useState<AdminProleagueDetail | null>(null);
  const [loadedProleague, setLoadedProleague] =
    useState<AdminProleagueDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(isEditMode);
  const [saving, setSaving] = useState(false);

  const draftLocked = Boolean(isEditMode && loadedProleague?.draftSessionId);
  const formLocked = Boolean(loadedProleague && !loadedProleague.canEditDraft);
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
  const canSubmit =
    validationMessages.length === 0 && !saving && !loadingDetail && !formLocked;
  const successProleague = savedProleague;
  const draftLiveHref =
    typeof successProleague?.draftSessionId === "number"
      ? proleagueDraftLivePath(successProleague.draftSessionId)
      : null;
  const memberCount = teams.reduce((total, team) => total + team.members.length, 0);

  useEffect(() => {
    if (!isEditMode || typeof proleagueId !== "number") {
      return;
    }

    const targetProleagueId = proleagueId;
    let cancelled = false;

    async function loadProleague() {
      setLoadingDetail(true);
      setNotice(null);

      try {
        const detail = await getAdminProleague(targetProleagueId);

        if (cancelled) {
          return;
        }

        const nextCreateDraft = typeof detail.draftSessionId === "number";
        const nextTeams = teamsFromDetail(detail.teams).map((team) =>
          normalizeTeamPicker(team, nextCreateDraft),
        );

        setLoadedProleague(detail);
        setSavedProleague(null);
        setForm({
          leagueName: detail.leagueName,
          seasonName: detail.seasonName,
          description: detail.description ?? "",
          startDate: detail.startDate ?? "",
          endDate: detail.endDate ?? "",
        });
        setCreateDraft(nextCreateDraft);
        setTeams(nextTeams);
        setPickTimeSeconds(String(detail.draftPickTimeSeconds ?? 30));
        setOrderMode(detail.draftOrderMode ?? "BASIC");
        setCandidates(
          detail.candidates
            .map((candidate) => candidateFromUserId(candidate.userId, candidate.race))
            .filter((candidate): candidate is SelectedDraftUser => candidate !== null),
        );
      } catch (error) {
        if (!cancelled) {
          setNotice({
            tone: "error",
            text: readErrorMessage(error, "프로리그 정보를 불러오지 못했습니다."),
          });
        }
      } finally {
        if (!cancelled) {
          setLoadingDetail(false);
        }
      }
    }

    void loadProleague();

    return () => {
      cancelled = true;
    };
  }, [isEditMode, proleagueId]);

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
      current.map((team, index) =>
        index === teamIndex ? normalizeTeamPicker(updater(team), createDraft) : team,
      ),
    );
  }

  function handleCreateDraftChange(checked: boolean) {
    if (draftLocked && !checked) {
      setNotice({
        tone: "error",
        text: "이미 연결된 드래프트는 이 화면에서 해제할 수 없습니다.",
      });
      return;
    }

    setCreateDraft(checked);
    setTeams((current) => current.map((team) => normalizeTeamPicker(team, checked)));
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
          text: "제거할 팀에 입력값이 있습니다. 팀 정보를 비운 뒤 팀 수를 줄여주세요.",
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
        pickerUserId: null,
        members: [],
      })),
    ]);
  }

  function handleAddTeamMember(teamIndex: number, memberToAdd: SelectedDraftUser) {
    const assignedUserIds = getAssignedTeamUserIds(teams);

    if (assignedUserIds.includes(memberToAdd.userId)) {
      setNotice({
        tone: "error",
        text: `이미 팀장/부팀장/선수로 배정된 ID입니다: ${memberToAdd.userId}`,
      });
      return;
    }

    if (candidates.some((candidate) => candidate.userId === memberToAdd.userId)) {
      setNotice({
        tone: "error",
        text: `참가 후보로 추가된 ID는 팀 선수로 추가할 수 없습니다: ${memberToAdd.userId}`,
      });
      return;
    }

    updateTeam(teamIndex, (current) => ({
      ...current,
      members: [...current.members, memberToAdd],
    }));
    setNotice(null);
  }

  function handleAddCandidate(candidateToAdd: SelectedDraftUser | null = candidateDraftUser) {
    if (!candidateToAdd) {
      setNotice({ tone: "error", text: "후보로 추가할 ID를 선택해주세요." });
      return;
    }

    if (candidates.some((candidate) => candidate.userId === candidateToAdd.userId)) {
      setNotice({
        tone: "error",
        text: `이미 추가된 후보입니다: ${candidateToAdd.userId}`,
      });
      return;
    }

    const assignedUserIds = getAssignedTeamUserIds(teams);

    if (assignedUserIds.includes(candidateToAdd.userId)) {
      setNotice({
        tone: "error",
        text: `팀장/부팀장/선수로 배정된 ID는 참가 후보로 추가할 수 없습니다: ${candidateToAdd.userId}`,
      });
      return;
    }

    setCandidates((current) => [...current, candidateToAdd]);
    setCandidateDraftUser(null);
    setNotice(null);
  }

  function buildPayload(): AdminProleagueCreateRequest {
    const pickTime = Number(pickTimeSeconds);
    const teamPayload = teams.map((team, index) => ({
      teamName: team.teamName.trim(),
      leaderUserId: team.leader?.userId ?? "",
      viceLeaderUserId: team.viceLeader?.userId ?? "",
      pickerUserId: createDraft ? team.pickerUserId : null,
      displayOrder: index + 1,
      members: team.members.map((member, memberIndex) => ({
        userId: member.userId,
        displayOrder: memberIndex + 1,
      })),
    }));

    return {
      leagueName: form.leagueName.trim(),
      seasonName: form.seasonName.trim(),
      description: form.description.trim(),
      status: "LIVE",
      leagueType: "PROLEAGUE",
      startDate: form.startDate || null,
      endDate: form.endDate || null,
      createDraft,
      teams: teamPayload,
      draft: createDraft
        ? {
            teamCount: teams.length,
            pickTimeSeconds:
              Number.isInteger(pickTime) && pickTime > 0 ? pickTime : 30,
            orderMode,
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

    try {
      const targetProleagueId = proleagueId;
      const saved =
        isEditMode && typeof targetProleagueId === "number"
          ? await updateAdminProleague(targetProleagueId, buildPayload())
          : await createAdminProleague(buildPayload());

      setSavedProleague(saved);
      setLoadedProleague(saved);
      setNotice({
        tone: "success",
        text: isEditMode
          ? "프로리그가 수정되었습니다."
          : "프로리그가 등록되었습니다.",
      });
    } catch (error) {
      setNotice({ tone: "error", text: readErrorMessage(error) });
    } finally {
      setSaving(false);
    }
  }

  const pageTitle = isEditMode ? "프로리그 수정" : "프로리그 등록";
  const submitLabel = isEditMode ? "프로리그 수정" : "프로리그 등록";

  return (
    <div className="space-y-4">
      <SurfaceCard className="p-7 sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-accent">
          Admin Proleague
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

      {loadingDetail ? (
        <SurfaceCard className="p-5 sm:p-6">
          <div className="rounded-lg border border-dashed border-line px-5 py-10 text-center text-sm text-muted">
            프로리그 정보를 불러오는 중입니다.
          </div>
        </SurfaceCard>
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
                disabled={formLocked}
                onChange={(event) => updateForm("leagueName", event.target.value)}
                placeholder="예: 2026 시즌1 프로리그"
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
              <span>드래프트 함께 생성</span>
              <input
                type="checkbox"
                className="h-5 w-5 rounded border-line-strong text-accent focus:ring-accent disabled:cursor-not-allowed disabled:opacity-70"
                checked={createDraft}
                disabled={formLocked || draftLocked}
                onChange={(event) => handleCreateDraftChange(event.target.checked)}
              />
            </label>
            <p className="text-sm leading-6 text-muted">
              체크하면 프로리그 등록과 동시에 프로리그 드래프트를 함께 생성합니다.
            </p>
            {draftLocked ? (
              <p className="rounded-lg border border-line bg-surface-muted px-4 py-3 text-sm text-muted">
                이미 드래프트가 연결되어 있어 체크를 해제할 수 없습니다.
              </p>
            ) : null}
          </SurfaceCard>
        </div>

        <div className="space-y-4">
          {createDraft ? (
            <SurfaceCard className="space-y-4 p-5 sm:p-6">
              <div>
                <h2 className="text-xl font-semibold text-foreground">
                  드래프트 설정
                </h2>
                <p className="mt-2 text-sm text-muted">
                  픽 제한 시간과 지명 순서를 설정합니다.
                </p>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <label className="grid gap-2 text-sm font-semibold text-foreground">
                  픽 제한 시간
                  <Input
                    type="number"
                    min={1}
                    value={pickTimeSeconds}
                    disabled={formLocked}
                    onChange={(event) => setPickTimeSeconds(event.target.value)}
                  />
                </label>
                <label className="grid gap-2 text-sm font-semibold text-foreground">
                  지명 순서
                  <select
                    className={selectClassName}
                    value={orderMode}
                    disabled={formLocked}
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
          ) : null}

          <SurfaceCard className="space-y-4 p-5 sm:p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-xl font-semibold text-foreground">팀 설정</h2>
                <p className="mt-2 text-sm text-muted">
                  드래프트 생성 여부와 관계없이 팀명, 팀장, 부팀장은 필수입니다.
                </p>
              </div>
              <label className="grid w-28 gap-2 text-sm font-semibold text-foreground">
                팀 수
                <Input
                  type="number"
                  min={2}
                  value={teams.length}
                  disabled={formLocked}
                  onChange={(event) => handleTeamCountChange(event.target.value)}
                />
              </label>
            </div>
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
                      disabled={formLocked}
                      onChange={(event) =>
                        updateTeam(index, (current) => ({
                          ...current,
                          teamName: event.target.value,
                        }))
                      }
                      placeholder="예: Alpha"
                    />
                  </label>
                  <div className="grid gap-2">
                    <UserSearchInput
                      key={`leader-${team.key}-${team.leader?.userId ?? "empty"}`}
                      disabled={formLocked}
                      label="팀장 ID 검색"
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
                        disabled={formLocked}
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
                  </div>
                  <div className="grid gap-2">
                    <UserSearchInput
                      key={`vice-${team.key}-${team.viceLeader?.userId ?? "empty"}`}
                      disabled={formLocked}
                      label="부팀장 ID 검색"
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
                        disabled={formLocked}
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
                  </div>
                  <div className="grid gap-3 rounded-lg border border-line bg-white px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-foreground">선수</p>
                      <span className="rounded-full bg-surface-muted px-3 py-1 text-xs font-semibold text-muted">
                        {team.members.length}명
                      </span>
                    </div>
                    <UserSearchInput
                      key={`member-${team.key}-${team.members.length}`}
                      disabled={formLocked}
                      label="선수 ID 검색"
                      selectedUser={null}
                      placeholder="선수 ID 검색"
                      onSelect={() => undefined}
                      onCommit={(user) => handleAddTeamMember(index, user)}
                    />
                    {team.members.length === 0 ? (
                      <p className="rounded-lg border border-dashed border-line px-4 py-4 text-center text-sm text-muted">
                        등록된 선수가 없습니다.
                      </p>
                    ) : (
                      <div className="grid gap-2">
                        {team.members.map((member) => (
                          <div
                            key={member.userId}
                            className="flex items-center justify-between gap-3 rounded-lg border border-line bg-surface-strong px-3 py-2"
                          >
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-foreground">
                                {member.userId}
                              </p>
                              <p className="mt-1 truncate text-xs text-muted">
                                {getMetaText(member)}
                              </p>
                            </div>
                            <Button
                              size="sm"
                              variant="danger"
                              disabled={formLocked}
                              onClick={() =>
                                updateTeam(index, (current) => ({
                                  ...current,
                                  members: current.members.filter(
                                    (item) => item.userId !== member.userId,
                                  ),
                                }))
                              }
                            >
                              삭제
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  {createDraft ? (
                    <div className="grid gap-2 rounded-lg border border-line bg-white px-4 py-3 text-sm">
                      <p className="font-semibold text-foreground">드래프트 진행자</p>
                      <label className="flex items-center justify-between gap-3 text-muted">
                        <span className="truncate">
                          팀장 {team.leader?.userId ? `(${team.leader.userId})` : ""}
                        </span>
                        <input
                          type="checkbox"
                          className="h-5 w-5 rounded border-line-strong text-accent focus:ring-accent disabled:cursor-not-allowed disabled:opacity-60"
                          checked={team.pickerUserId === team.leader?.userId}
                          disabled={formLocked || !team.leader}
                          onChange={(event) =>
                            updateTeam(index, (current) => ({
                              ...current,
                              pickerUserId: event.target.checked
                                ? current.leader?.userId ?? null
                                : null,
                            }))
                          }
                        />
                      </label>
                      <label className="flex items-center justify-between gap-3 text-muted">
                        <span className="truncate">
                          부팀장 {team.viceLeader?.userId ? `(${team.viceLeader.userId})` : ""}
                        </span>
                        <input
                          type="checkbox"
                          className="h-5 w-5 rounded border-line-strong text-accent focus:ring-accent disabled:cursor-not-allowed disabled:opacity-60"
                          checked={team.pickerUserId === team.viceLeader?.userId}
                          disabled={formLocked || !team.viceLeader}
                          onChange={(event) =>
                            updateTeam(index, (current) => ({
                              ...current,
                              pickerUserId: event.target.checked
                                ? current.viceLeader?.userId ?? null
                                : null,
                            }))
                          }
                        />
                      </label>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </SurfaceCard>

          {createDraft ? (
            <SurfaceCard className="space-y-4 p-5 sm:p-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-foreground">
                    참가 후보 풀
                  </h2>
                  <p className="mt-2 text-sm text-muted">
                    후보는 중복 없이 1명 이상 추가합니다.
                  </p>
                </div>
                <span className="rounded-full bg-surface-muted px-3 py-1 text-xs font-semibold text-muted">
                  {candidates.length}명
                </span>
              </div>
              <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_120px]">
                <UserSearchInput
                  key={`candidate-${candidateDraftUser?.userId ?? "empty"}`}
                  disabled={formLocked}
                  label="후보 ID 검색"
                  selectedUser={candidateDraftUser}
                  placeholder="후보 ID 검색"
                  onCommit={handleAddCandidate}
                  onSelect={setCandidateDraftUser}
                />
                <Button variant="accent" disabled={formLocked} onClick={() => handleAddCandidate()}>
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
                        disabled={formLocked}
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
          ) : null}
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
              <dt className="text-muted">팀 수</dt>
              <dd className="font-semibold text-foreground">{teams.length}팀</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted">드래프트 생성</dt>
              <dd className="font-semibold text-foreground">
                {createDraft ? "생성" : "미생성"}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted">선수 수</dt>
              <dd className="font-semibold text-foreground">{memberCount}명</dd>
            </div>
            {createDraft ? (
              <>
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

          {formLocked ? (
            <div className="rounded-lg border border-warning-ink/20 bg-warning-soft px-4 py-3 text-sm leading-6 text-warning-ink">
              종료되지 않은 프로리그만 수정할 수 있습니다.
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

          {successProleague ? (
            <div className="rounded-lg border border-line bg-surface-muted px-4 py-4 text-sm leading-6 text-muted">
              <p className="font-semibold text-foreground">
                {isEditMode ? "프로리그가 수정되었습니다." : "프로리그가 등록되었습니다."}
              </p>
              <p className="mt-1">ID: {successProleague.id}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Link
                  href={adminProleagueEditPath(successProleague.id)}
                  className="inline-flex rounded-full border border-line-strong bg-white px-4 py-2 text-sm font-semibold text-muted transition-colors hover:border-accent hover:bg-accent-soft hover:text-accent-ink"
                >
                  수정 화면
                </Link>
                {draftLiveHref ? (
                  <Link
                    href={draftLiveHref}
                    className="inline-flex rounded-full bg-accent px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent-ink"
                  >
                    드래프트 진행 화면
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
