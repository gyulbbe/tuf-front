"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { RpsDraftUserSearch } from "@/components/rps-draft/rps-draft-user-search";
import {
  formatDateTime,
  formatRelativePickNo,
  StatusBadge,
  ValueBadge,
} from "@/components/rps-draft/rps-draft-ui";
import { OverlayDialog } from "@/components/site/overlay-dialog";
import { SurfaceCard } from "@/components/site/surface-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  createEntrySubmissionSession,
  deleteEntrySubmissionSession,
  listEntrySubmissionSessions,
  type EntrySubmissionSessionSummary,
} from "@/lib/api/entry-submission";
import {
  createRpsDraftSession,
  deleteRpsDraftSession,
  listRpsDraftSessions,
  type RpsDraftSessionSummary,
  type RpsDraftUserSearchResult,
} from "@/lib/api/rps-draft";
import { buildLoginHref } from "@/lib/auth/auth-navigation";
import type { AuthUser } from "@/lib/auth/auth-types";
import { canManageOwnedResource } from "@/lib/auth/roles";
import { entrySubmissionSessionPath } from "@/lib/entry-submission/routes";
import { rpsDraftListPath, rpsDraftLivePath } from "@/lib/rps-draft/routes";

const secondaryLinkClassName =
  "inline-flex items-center justify-center rounded-full border border-line-strong bg-white px-4 py-3 text-sm font-semibold text-muted transition-colors hover:border-accent hover:bg-accent-soft hover:text-accent-ink";

const primaryLinkClassName =
  "inline-flex items-center justify-center rounded-full bg-accent px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-accent-ink";

type RpsDraftCreateFormState = {
  title: string;
  team1Picker: RpsDraftUserSearchResult | null;
  team2Picker: RpsDraftUserSearchResult | null;
  candidateNamesText: string;
};

type EntrySubmissionCreateFormState = {
  title: string;
  team1Captain: RpsDraftUserSearchResult | null;
  team2Captain: RpsDraftUserSearchResult | null;
  team1PlayerNamesText: string;
  team2PlayerNamesText: string;
  setCountText: string;
  setCountEdited: boolean;
};

type DraftHistoryItem = {
  kind: "rps" | "entry";
  id: number;
  title: string;
  ownerUserId: number;
  ownerUserLoginId: string | null;
  status: string;
  regDate: string | null;
  updateDate: string | null;
  href: string;
  typeLabel: string;
  progressText: string;
  metaLabel: string;
};

type RpsDraftListPageProps = {
  mode?: "draft" | "entry";
};

function padNumber(value: number) {
  return String(value).padStart(2, "0");
}

function buildDefaultDraftTitle(username?: string | null) {
  const now = new Date();
  const userId = username?.trim() || "guest";

  return `${now.getFullYear()}${padNumber(now.getMonth() + 1)}${padNumber(now.getDate())}${padNumber(now.getHours())}${padNumber(now.getMinutes())}_${userId}`;
}

function toCurrentUserSearchResult(user?: AuthUser | null): RpsDraftUserSearchResult | null {
  if (!user || typeof user.userPk !== "number" || !user.username.trim()) {
    return null;
  }

  return {
    id: user.userPk,
    userId: user.username.trim(),
    tier: null,
    race: null,
  };
}

function createEmptyForm(
  title = "",
  team1Picker: RpsDraftUserSearchResult | null = null,
): RpsDraftCreateFormState {
  return {
    title,
    team1Picker,
    team2Picker: null,
    candidateNamesText: "",
  };
}

function createEmptyEntryForm(
  title = "",
  team1Captain: RpsDraftUserSearchResult | null = null,
): EntrySubmissionCreateFormState {
  return withAutoEntrySetCount({
    title,
    team1Captain,
    team2Captain: null,
    team1PlayerNamesText: "",
    team2PlayerNamesText: "",
    setCountText: "",
    setCountEdited: false,
  });
}

function parseCandidateNames(value: string) {
  return value
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean);
}

function countEntryPlayers(
  captain: RpsDraftUserSearchResult | null,
  playerNamesText: string,
) {
  return parseCandidateNames(playerNamesText).length + (captain ? 1 : 0);
}

function calculateEntrySetCount(form: EntrySubmissionCreateFormState) {
  return Math.max(
    countEntryPlayers(form.team1Captain, form.team1PlayerNamesText),
    countEntryPlayers(form.team2Captain, form.team2PlayerNamesText),
    1,
  );
}

function withAutoEntrySetCount(
  form: EntrySubmissionCreateFormState,
): EntrySubmissionCreateFormState {
  if (form.setCountEdited) {
    return form;
  }

  return {
    ...form,
    setCountText: String(calculateEntrySetCount(form)),
  };
}

function sanitizePositiveIntegerText(value: string) {
  return value.replace(/\D/g, "");
}

function isBlockedNumberInputKey(key: string) {
  return key === "e" || key === "E" || key === "+" || key === "-" || key === ".";
}

function findDuplicateCandidateName(names: readonly string[]) {
  const seenNames = new Set<string>();

  for (const name of names) {
    const key = name.toLocaleLowerCase("ko-KR");

    if (seenNames.has(key)) {
      return name;
    }

    seenNames.add(key);
  }

  return null;
}

function toTimestamp(value: string | null | undefined) {
  if (!value) {
    return 0;
  }

  const timestamp = new Date(value).getTime();
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function sortDraftHistoryItems(items: DraftHistoryItem[]) {
  return [...items].sort((left, right) => {
    const leftFinished = left.status === "FINISHED" || left.status === "COMPLETED";
    const rightFinished = right.status === "FINISHED" || right.status === "COMPLETED";

    return (
      Number(leftFinished) - Number(rightFinished) ||
      toTimestamp(right.regDate ?? right.updateDate) - toTimestamp(left.regDate ?? left.updateDate) ||
      right.id - left.id
    );
  });
}

function describeProgress(session: RpsDraftSessionSummary) {
  switch (session.status) {
    case "RPS_PENDING":
      return "두 팀장이 가위바위보로 지명 순서를 정하는 중입니다.";
    case "PICKING":
      return session.currentPickNo
        ? `${session.currentPickNo}번 지명 진행 중입니다.`
        : "후보 지명이 진행 중입니다.";
    case "FINISHED":
      return "완료된 드래프트입니다.";
    default:
      return "진행 상황을 확인해 주세요.";
  }
}

function describeEntryProgress(session: EntrySubmissionSessionSummary) {
  return session.status === "COMPLETED"
    ? "양 팀 엔트리 제출이 완료됐습니다."
    : "팀장 엔트리 제출을 기다리는 중입니다.";
}

function buildDraftHistoryItems(
  rpsSessions: RpsDraftSessionSummary[],
  entrySessions: EntrySubmissionSessionSummary[],
) {
  return sortDraftHistoryItems([
    ...rpsSessions.map((session) => ({
      kind: "rps" as const,
      id: session.id,
      title: session.title,
      ownerUserId: session.ownerUserId,
      ownerUserLoginId: session.ownerUserLoginId,
      status: session.status,
      regDate: session.regDate ?? session.startedAt,
      updateDate: session.updateDate,
      href: rpsDraftLivePath(session.id),
      typeLabel: "가위바위보",
      progressText: describeProgress(session),
      metaLabel: formatRelativePickNo(session.currentPickNo),
    })),
    ...entrySessions.map((session) => ({
      kind: "entry" as const,
      id: session.id,
      title: session.title,
      ownerUserId: session.ownerUserId,
      ownerUserLoginId: session.ownerUserLoginId,
      status: session.status,
      regDate: session.regDate,
      updateDate: session.updateDate,
      href: entrySubmissionSessionPath(session.id),
      typeLabel: "엔트리 제출",
      progressText: describeEntryProgress(session),
      metaLabel: `${session.setCount}세트`,
    })),
  ]);
}

function formatUserLoginId(value: string | null | undefined) {
  return value?.trim() || "아이디 확인 필요";
}

function validateCreateForm(form: RpsDraftCreateFormState) {
  const title = form.title.trim();
  const candidateNames = parseCandidateNames(form.candidateNamesText);
  const duplicateName = findDuplicateCandidateName(candidateNames);

  if (!title) {
    return "드래프트 제목을 입력해 주세요.";
  }

  if (!form.team1Picker || !form.team2Picker) {
    return "팀장 2명을 모두 골라 주세요.";
  }

  if (form.team1Picker.id === form.team2Picker.id) {
    return "서로 다른 팀장을 선택해 주세요.";
  }

  if (candidateNames.length === 0) {
    return "후보 이름을 1명 이상 입력해 주세요.";
  }

  if (duplicateName) {
    return `후보 이름이 중복됩니다: ${duplicateName}`;
  }

  return null;
}

function validateEntryCreateForm(form: EntrySubmissionCreateFormState) {
  const title = form.title.trim();
  const team1PlayerNames = parseCandidateNames(form.team1PlayerNamesText);
  const team2PlayerNames = parseCandidateNames(form.team2PlayerNamesText);
  const team1Duplicate = findDuplicateCandidateName(team1PlayerNames);
  const team2Duplicate = findDuplicateCandidateName(team2PlayerNames);
  const setCountText = form.setCountText.trim();

  if (!title) {
    return "제목을 입력해 주세요.";
  }
  if (!form.team1Captain || !form.team2Captain) {
    return "팀장 2명을 모두 골라 주세요.";
  }
  if (form.team1Captain.id === form.team2Captain.id) {
    return "서로 다른 팀장을 선택해 주세요.";
  }
  if (team1PlayerNames.some((name) => name.toLocaleLowerCase("ko-KR") === form.team1Captain?.userId.toLocaleLowerCase("ko-KR"))) {
    return "1팀 선수 목록에 팀장 아이디가 중복됐습니다.";
  }
  if (team2PlayerNames.some((name) => name.toLocaleLowerCase("ko-KR") === form.team2Captain?.userId.toLocaleLowerCase("ko-KR"))) {
    return "2팀 선수 목록에 팀장 아이디가 중복됐습니다.";
  }
  if (team1Duplicate) {
    return `1팀 선수 이름이 중복됩니다: ${team1Duplicate}`;
  }
  if (team2Duplicate) {
    return `2팀 선수 이름이 중복됩니다: ${team2Duplicate}`;
  }
  if (!setCountText || !Number.isInteger(Number(setCountText)) || Number(setCountText) < 1) {
    return "세트 수는 1 이상의 정수로 입력해 주세요.";
  }

  return null;
}

export function RpsDraftListPage({ mode = "draft" }: RpsDraftListPageProps) {
  const router = useRouter();
  const { isAuthenticated, status, user } = useAuth();
  const [sessions, setSessions] = useState<RpsDraftSessionSummary[]>([]);
  const [entrySessions, setEntrySessions] = useState<EntrySubmissionSessionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCreateTypeOpen, setIsCreateTypeOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEntryCreateOpen, setIsEntryCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [entryCreating, setEntryCreating] = useState(false);
  const [deletingSessionId, setDeletingSessionId] = useState<number | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [entryCreateError, setEntryCreateError] = useState<string | null>(null);
  const [form, setForm] = useState<RpsDraftCreateFormState>(() =>
    createEmptyForm(
      buildDefaultDraftTitle(user?.username),
      toCurrentUserSearchResult(user),
    ),
  );
  const [entryForm, setEntryForm] = useState<EntrySubmissionCreateFormState>(() =>
    createEmptyEntryForm(
      buildDefaultDraftTitle(user?.username),
      toCurrentUserSearchResult(user),
    ),
  );

  useEffect(() => {
    let cancelled = false;

    async function loadSessions() {
      setLoading(true);
      setError(null);

      try {
        const [nextSessions, nextEntrySessions] =
          mode === "entry"
            ? await Promise.all([
                Promise.resolve([] as RpsDraftSessionSummary[]),
                listEntrySubmissionSessions(),
              ])
            : await Promise.all([
                listRpsDraftSessions(),
                Promise.resolve([] as EntrySubmissionSessionSummary[]),
              ]);

        if (!cancelled) {
          setSessions(nextSessions);
          setEntrySessions(nextEntrySessions);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "드래프트 목록을 불러오지 못했습니다.",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadSessions();

    return () => {
      cancelled = true;
    };
  }, [mode]);

  const listPath = mode === "entry" ? "/draft/entry" : rpsDraftListPath();
  const historyItems = buildDraftHistoryItems(sessions, entrySessions);
  const loginHref = buildLoginHref({ redirectTo: listPath });
  const previewCandidateNames = useMemo(
    () => parseCandidateNames(form.candidateNamesText),
    [form.candidateNamesText],
  );
  const previewTeam1EntryNames = useMemo(
    () => parseCandidateNames(entryForm.team1PlayerNamesText),
    [entryForm.team1PlayerNamesText],
  );
  const previewTeam2EntryNames = useMemo(
    () => parseCandidateNames(entryForm.team2PlayerNamesText),
    [entryForm.team2PlayerNamesText],
  );
  const team1DisabledUserIds = [
    form.team2Picker?.id,
  ].filter((value): value is number => typeof value === "number");
  const team2DisabledUserIds = [
    form.team1Picker?.id,
  ].filter((value): value is number => typeof value === "number");
  const entryTeam1DisabledUserIds = [
    entryForm.team2Captain?.id,
  ].filter((value): value is number => typeof value === "number");
  const entryTeam2DisabledUserIds = [
    entryForm.team1Captain?.id,
  ].filter((value): value is number => typeof value === "number");
  const pageTitle = mode === "entry" ? "엔트리 이력" : "드래프트 이력";
  const pageLoadingText =
    mode === "entry"
      ? "엔트리 이력을 불러오는 중입니다."
      : "진행 가능한 드래프트를 불러오는 중입니다.";
  const pageEmptyText =
    mode === "entry"
      ? "아직 생성된 엔트리 제출이 없습니다."
      : "아직 생성된 드래프트가 없습니다.";
  const createButtonLabel = mode === "entry" ? "엔트리 생성" : "드래프트 생성";

  function updateEntryForm(
    updater: (current: EntrySubmissionCreateFormState) => EntrySubmissionCreateFormState,
  ) {
    setEntryForm((current) => withAutoEntrySetCount(updater(current)));
  }

  async function handleCreateSession() {
    const validationMessage = validateCreateForm(form);

    if (validationMessage) {
      setCreateError(validationMessage);
      return;
    }

    setCreating(true);
    setCreateError(null);

    try {
      const createdSession = await createRpsDraftSession({
        title: form.title.trim(),
        team1PickerUserId: form.team1Picker!.id,
        team2PickerUserId: form.team2Picker!.id,
        candidateNames: parseCandidateNames(form.candidateNamesText),
      });

      setIsCreateOpen(false);
      setForm(createEmptyForm());
      router.push(rpsDraftLivePath(createdSession.id));
    } catch (createSessionError) {
      setCreateError(
        createSessionError instanceof Error
          ? createSessionError.message
          : "드래프트를 만들지 못했습니다.",
      );
    } finally {
      setCreating(false);
    }
  }

  async function handleCreateEntrySession() {
    const validationMessage = validateEntryCreateForm(entryForm);

    if (validationMessage) {
      setEntryCreateError(validationMessage);
      return;
    }

    setEntryCreating(true);
    setEntryCreateError(null);

    try {
      const createdSnapshot = await createEntrySubmissionSession({
        title: entryForm.title.trim(),
        team1CaptainUserId: entryForm.team1Captain!.id,
        team2CaptainUserId: entryForm.team2Captain!.id,
        team1PlayerNames: parseCandidateNames(entryForm.team1PlayerNamesText),
        team2PlayerNames: parseCandidateNames(entryForm.team2PlayerNamesText),
        setCount: Number(entryForm.setCountText.trim()),
      });

      setIsEntryCreateOpen(false);
      setEntryForm(createEmptyEntryForm());
      router.push(entrySubmissionSessionPath(createdSnapshot.session.id));
    } catch (createSessionError) {
      setEntryCreateError(
        createSessionError instanceof Error
          ? createSessionError.message
          : "엔트리 제출을 생성하지 못했습니다.",
      );
    } finally {
      setEntryCreating(false);
    }
  }

  function handleSelectTeam(teamKey: "team1Picker" | "team2Picker", nextUser: RpsDraftUserSearchResult) {
    setCreateError(null);
    setForm((current) => ({
      ...current,
      [teamKey]: nextUser,
    }));
  }

  function handleClearTeam(teamKey: "team1Picker" | "team2Picker") {
    setCreateError(null);
    setForm((current) => ({
      ...current,
      [teamKey]: null,
    }));
  }

  function handleSelectEntryTeam(
    teamKey: "team1Captain" | "team2Captain",
    nextUser: RpsDraftUserSearchResult,
  ) {
    setEntryCreateError(null);
    updateEntryForm((current) => ({
      ...current,
      [teamKey]: nextUser,
    }));
  }

  function handleClearEntryTeam(teamKey: "team1Captain" | "team2Captain") {
    setEntryCreateError(null);
    updateEntryForm((current) => ({
      ...current,
      [teamKey]: null,
    }));
  }

  function handleOpenCreateTypeDialog() {
    if (mode === "entry") {
      handleOpenEntryCreateDialog();
      return;
    }

    setIsCreateTypeOpen(true);
  }

  function handleCloseCreateTypeDialog() {
    setIsCreateTypeOpen(false);
  }

  function handleOpenCreateDialog() {
    setIsCreateTypeOpen(false);
    setCreateError(null);
    setForm(
      createEmptyForm(
        buildDefaultDraftTitle(user?.username),
        toCurrentUserSearchResult(user),
      ),
    );
    setIsCreateOpen(true);
  }

  function handleOpenPinballDraft() {
    setIsCreateTypeOpen(false);
    router.push("/draft/pinball");
  }

  function handleOpenEntryCreateDialog() {
    setIsCreateTypeOpen(false);
    setEntryCreateError(null);
    setEntryForm(
      createEmptyEntryForm(
        buildDefaultDraftTitle(user?.username),
        toCurrentUserSearchResult(user),
      ),
    );
    setIsEntryCreateOpen(true);
  }

  function handleCloseCreateDialog() {
    if (creating) {
      return;
    }

    setIsCreateOpen(false);
  }

  function handleCloseEntryCreateDialog() {
    if (entryCreating) {
      return;
    }

    setIsEntryCreateOpen(false);
  }

  async function handleDeleteSession(sessionId: number, title: string) {
    if (
      !window.confirm(
        [`"${title}" 드래프트를 삭제할까요?`, "", "삭제 후에는 되돌릴 수 없습니다."].join("\n"),
      )
    ) {
      return;
    }

    setDeletingSessionId(sessionId);
    setError(null);

    try {
      await deleteRpsDraftSession(sessionId);
      setSessions((current) => current.filter((session) => session.id !== sessionId));
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "드래프트를 삭제하지 못했습니다.",
      );
    } finally {
      setDeletingSessionId(null);
    }
  }

  async function handleDeleteEntrySession(sessionId: number, title: string) {
    if (
      !window.confirm(
        [`"${title}" 엔트리 제출을 삭제할까요?`, "", "삭제 후에는 되돌릴 수 없습니다."].join("\n"),
      )
    ) {
      return;
    }

    setDeletingSessionId(sessionId);
    setError(null);

    try {
      await deleteEntrySubmissionSession(sessionId);
      setEntrySessions((current) => current.filter((session) => session.id !== sessionId));
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "엔트리 제출을 삭제하지 못했습니다.",
      );
    } finally {
      setDeletingSessionId(null);
    }
  }

  return (
    <>
      <SurfaceCard className="p-6 sm:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-4xl">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-accent">
              Draft
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
              {pageTitle}
            </h1>
          </div>

          {mode === "draft" || isAuthenticated ? (
            <div className="flex flex-wrap gap-2 sm:justify-end">
              <Button variant="accent" onClick={handleOpenCreateTypeDialog}>
                {createButtonLabel}
              </Button>
            </div>
          ) : status === "loading" ? (
            <Button variant="outline" disabled>
              로그인 확인 중
            </Button>
          ) : (
            <Link href={loginHref} className={primaryLinkClassName}>
              로그인하고 생성
            </Link>
          )}
        </div>

        {error ? (
          <div className="mt-6 rounded-lg border border-danger-ink/20 bg-danger-soft px-5 py-4">
            <p className="text-sm font-medium text-danger-ink">{error}</p>
          </div>
        ) : null}

        {loading ? (
          <div className="mt-6 rounded-lg border border-dashed border-line px-6 py-10 text-sm text-muted">
            {pageLoadingText}
          </div>
        ) : historyItems.length === 0 ? (
          <div className="mt-6 rounded-lg border border-dashed border-line px-6 py-10 text-sm text-muted">
            {pageEmptyText}
          </div>
        ) : (
          <div className="mt-6 grid gap-3 2xl:grid-cols-2">
            {historyItems.map((item) => {
              const canManage = canManageOwnedResource({
                ownerUserId: item.ownerUserId,
                role: user?.role,
                userPk: user?.userPk,
              });
              const ownerLabel = formatUserLoginId(item.ownerUserLoginId);
              const liveClassName = canManage
                ? primaryLinkClassName
                : secondaryLinkClassName;

              return (
                <SurfaceCard key={`${item.kind}-${item.id}`} className="p-5 sm:p-6">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusBadge status={item.status} />
                        <ValueBadge>{item.typeLabel}</ValueBadge>
                        <ValueBadge>{item.metaLabel}</ValueBadge>
                        <ValueBadge>방장 {ownerLabel}</ValueBadge>
                      </div>
                      <h2 className="mt-3 text-xl font-semibold text-foreground">
                        {item.title}
                      </h2>
                      <p className="mt-2 text-sm leading-7 text-muted">
                        {item.progressText}
                      </p>
                      {item.regDate ? (
                        <p className="mt-2 text-sm text-muted">생성 {formatDateTime(item.regDate)}</p>
                      ) : null}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Link href={item.href} className={liveClassName}>
                        진행 화면
                      </Link>
                      {canManage ? (
                        <Button
                          variant="danger"
                          disabled={deletingSessionId === item.id}
                          onClick={() => {
                            if (item.kind === "entry") {
                              void handleDeleteEntrySession(item.id, item.title);
                              return;
                            }
                            void handleDeleteSession(item.id, item.title);
                          }}
                        >
                          {deletingSessionId === item.id ? "삭제 중" : "삭제"}
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </SurfaceCard>
              );
            })}
          </div>
        )}
      </SurfaceCard>

      <OverlayDialog
        open={isCreateTypeOpen}
        onClose={handleCloseCreateTypeDialog}
        title="드래프트 생성"
        panelClassName="max-w-xl bg-white backdrop-blur-none"
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Button
            variant="accent"
            className="h-20 rounded-lg text-base"
            onClick={handleOpenCreateDialog}
          >
            가위바위보 드래프트
          </Button>
          <Button
            variant="outline"
            className="h-20 rounded-lg text-base"
            onClick={handleOpenPinballDraft}
          >
            핀볼 드래프트
          </Button>
        </div>
      </OverlayDialog>

      <OverlayDialog
        open={isCreateOpen}
        onClose={handleCloseCreateDialog}
        closeOnBackdropClick={false}
        closeOnEscape={false}
        title="드래프트 생성"
        description="팀장 2명과 쉼표로 구분한 후보 이름을 입력하면 바로 진행 화면으로 이동합니다."
        panelClassName="max-w-[1100px] bg-white backdrop-blur-none"
      >
        <form
          className="grid gap-5 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)]"
          onSubmit={(event) => {
            event.preventDefault();
            void handleCreateSession();
          }}
        >
          <div className="space-y-5">
            <div className="space-y-2">
              <p className="text-sm font-semibold text-foreground">드래프트 제목</p>
              <Input
                value={form.title}
                onChange={(event) => {
                  setCreateError(null);
                  setForm((current) => ({ ...current, title: event.target.value }));
                }}
                placeholder="예: 4월 가위바위보 드래프트"
                disabled={creating}
              />
            </div>

            <SurfaceCard className="bg-surface-strong p-5 shadow-none">
              <h3 className="text-lg font-semibold text-foreground">1팀 팀장</h3>
              <div className="mt-4">
                <RpsDraftUserSearch
                  label="팀장 검색"
                  selectedUser={form.team1Picker}
                  onSelect={(nextUser) => {
                    handleSelectTeam("team1Picker", nextUser);
                  }}
                  disabled={creating}
                  disabledUserIds={team1DisabledUserIds}
                  disabledUserMessage="이미 다른 팀장으로 선택된 계정입니다."
                />
              </div>
              {form.team1Picker ? (
                <div className="mt-4 flex justify-end">
                  <Button
                    size="sm"
                    onClick={() => {
                      handleClearTeam("team1Picker");
                    }}
                    disabled={creating}
                  >
                    선택 해제
                  </Button>
                </div>
              ) : null}
            </SurfaceCard>

            <SurfaceCard className="bg-surface-strong p-5 shadow-none">
              <h3 className="text-lg font-semibold text-foreground">2팀 팀장</h3>
              <div className="mt-4">
                <RpsDraftUserSearch
                  label="팀장 검색"
                  selectedUser={form.team2Picker}
                  onSelect={(nextUser) => {
                    handleSelectTeam("team2Picker", nextUser);
                  }}
                  disabled={creating}
                  disabledUserIds={team2DisabledUserIds}
                  disabledUserMessage="이미 다른 팀장으로 선택된 계정입니다."
                />
              </div>
              {form.team2Picker ? (
                <div className="mt-4 flex justify-end">
                  <Button
                    size="sm"
                    onClick={() => {
                      handleClearTeam("team2Picker");
                    }}
                    disabled={creating}
                  >
                    선택 해제
                  </Button>
                </div>
              ) : null}
            </SurfaceCard>
          </div>

          <SurfaceCard className="bg-surface-strong p-5 shadow-none">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-lg font-semibold text-foreground">후보 이름</h3>
              <ValueBadge>{previewCandidateNames.length}명</ValueBadge>
            </div>

            <textarea
              value={form.candidateNamesText}
              onChange={(event) => {
                setCreateError(null);
                setForm((current) => ({
                  ...current,
                  candidateNamesText: event.target.value,
                }));
              }}
              className="mt-4 min-h-44 w-full resize-y rounded-lg border border-line-strong bg-white px-4 py-3 text-sm leading-7 text-foreground outline-none transition-colors placeholder:text-muted focus:border-accent"
              placeholder="예: alpha, bravo, charlie"
              disabled={creating}
            />

            <div className="mt-4 rounded-lg border border-line bg-white px-4 py-4">
              <p className="text-sm font-semibold text-foreground">미리보기</p>
              {previewCandidateNames.length === 0 ? (
                <p className="mt-3 text-sm text-muted">쉼표로 후보 이름을 입력해 주세요.</p>
              ) : (
                <div className="mt-3 flex max-h-64 flex-wrap gap-2 overflow-y-auto pr-1">
                  {previewCandidateNames.map((candidateName, index) => (
                    <ValueBadge key={`${candidateName}-${index}`}>
                      {index + 1}. {candidateName}
                    </ValueBadge>
                  ))}
                </div>
              )}
            </div>
          </SurfaceCard>

          <div className="space-y-3 border-t border-line/80 pt-4 lg:col-span-2">
            {createError ? (
              <p className="text-sm text-danger-ink">{createError}</p>
            ) : null}

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
              {isAuthenticated ? (
                <Button type="submit" variant="accent" disabled={creating}>
                  {creating ? "생성 중" : "생성하고 진행 화면 열기"}
                </Button>
              ) : status === "loading" ? (
                <Button variant="outline" disabled>
                  로그인 확인 중
                </Button>
              ) : (
                <Link href={loginHref} className={primaryLinkClassName}>
                  로그인하고 생성
                </Link>
              )}
            </div>
          </div>
        </form>
      </OverlayDialog>

      <OverlayDialog
        open={isEntryCreateOpen}
        onClose={handleCloseEntryCreateDialog}
        closeOnBackdropClick={false}
        closeOnEscape={false}
        title="엔트리 제출 생성"
        description="팀장은 선수 카드에 자동 포함됩니다. 추가 선수만 쉼표로 입력해 주세요."
        panelClassName="max-w-[1120px] bg-white backdrop-blur-none"
      >
        <form
          className="grid gap-5 lg:grid-cols-2"
          onSubmit={(event) => {
            event.preventDefault();
            void handleCreateEntrySession();
          }}
        >
          <div className="space-y-5">
            <div className="space-y-2">
              <p className="text-sm font-semibold text-foreground">제목</p>
              <Input
                value={entryForm.title}
                onChange={(event) => {
                  setEntryCreateError(null);
                  setEntryForm((current) => ({ ...current, title: event.target.value }));
                }}
                placeholder="예: 4세트 엔트리 제출"
                disabled={entryCreating}
              />
            </div>

            <div className="space-y-2">
              <p className="text-sm font-semibold text-foreground">세트 수</p>
              <Input
                value={entryForm.setCountText}
                onChange={(event) => {
                  setEntryCreateError(null);
                  setEntryForm((current) => ({
                    ...current,
                    setCountText: sanitizePositiveIntegerText(event.target.value),
                    setCountEdited: true,
                  }));
                }}
                onKeyDown={(event) => {
                  if (isBlockedNumberInputKey(event.key)) {
                    event.preventDefault();
                  }
                }}
                type="number"
                min={1}
                step={1}
                inputMode="numeric"
                placeholder="선수 수에 맞춰 자동 설정"
                disabled={entryCreating}
              />
            </div>

            <SurfaceCard className="bg-surface-strong p-5 shadow-none">
              <h3 className="text-lg font-semibold text-foreground">1팀 팀장</h3>
              <div className="mt-4">
                <RpsDraftUserSearch
                  label="팀장 검색"
                  selectedUser={entryForm.team1Captain}
                  onSelect={(nextUser) => handleSelectEntryTeam("team1Captain", nextUser)}
                  disabled={entryCreating}
                  disabledUserIds={entryTeam1DisabledUserIds}
                  disabledUserMessage="이미 다른 팀장으로 선택된 계정입니다."
                />
              </div>
              {entryForm.team1Captain ? (
                <div className="mt-4 flex justify-end">
                  <Button
                    size="sm"
                    onClick={() => handleClearEntryTeam("team1Captain")}
                    disabled={entryCreating}
                  >
                    선택 해제
                  </Button>
                </div>
              ) : null}
            </SurfaceCard>

            <SurfaceCard className="bg-surface-strong p-5 shadow-none">
              <h3 className="text-lg font-semibold text-foreground">2팀 팀장</h3>
              <div className="mt-4">
                <RpsDraftUserSearch
                  label="팀장 검색"
                  selectedUser={entryForm.team2Captain}
                  onSelect={(nextUser) => handleSelectEntryTeam("team2Captain", nextUser)}
                  disabled={entryCreating}
                  disabledUserIds={entryTeam2DisabledUserIds}
                  disabledUserMessage="이미 다른 팀장으로 선택된 계정입니다."
                />
              </div>
              {entryForm.team2Captain ? (
                <div className="mt-4 flex justify-end">
                  <Button
                    size="sm"
                    onClick={() => handleClearEntryTeam("team2Captain")}
                    disabled={entryCreating}
                  >
                    선택 해제
                  </Button>
                </div>
              ) : null}
            </SurfaceCard>
          </div>

          <div className="space-y-5">
            <SurfaceCard className="bg-surface-strong p-5 shadow-none">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-lg font-semibold text-foreground">1팀 추가 선수</h3>
                <ValueBadge>팀장 포함 {previewTeam1EntryNames.length + (entryForm.team1Captain ? 1 : 0)}명</ValueBadge>
              </div>
              <textarea
                value={entryForm.team1PlayerNamesText}
                onChange={(event) => {
                  setEntryCreateError(null);
                  updateEntryForm((current) => ({
                    ...current,
                    team1PlayerNamesText: event.target.value,
                  }));
                }}
                className="mt-4 min-h-36 w-full resize-y rounded-lg border border-line-strong bg-white px-4 py-3 text-sm leading-7 text-foreground outline-none transition-colors placeholder:text-muted focus:border-accent"
                placeholder="예: a, b, c"
                disabled={entryCreating}
              />
            </SurfaceCard>

            <SurfaceCard className="bg-surface-strong p-5 shadow-none">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-lg font-semibold text-foreground">2팀 추가 선수</h3>
                <ValueBadge>팀장 포함 {previewTeam2EntryNames.length + (entryForm.team2Captain ? 1 : 0)}명</ValueBadge>
              </div>
              <textarea
                value={entryForm.team2PlayerNamesText}
                onChange={(event) => {
                  setEntryCreateError(null);
                  updateEntryForm((current) => ({
                    ...current,
                    team2PlayerNamesText: event.target.value,
                  }));
                }}
                className="mt-4 min-h-36 w-full resize-y rounded-lg border border-line-strong bg-white px-4 py-3 text-sm leading-7 text-foreground outline-none transition-colors placeholder:text-muted focus:border-accent"
                placeholder="예: e, f, g"
                disabled={entryCreating}
              />
            </SurfaceCard>
          </div>

          <div className="space-y-3 border-t border-line/80 pt-4 lg:col-span-2">
            {entryCreateError ? (
              <p className="text-sm text-danger-ink">{entryCreateError}</p>
            ) : null}

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
              {isAuthenticated ? (
                <Button type="submit" variant="accent" disabled={entryCreating}>
                  {entryCreating ? "생성 중" : "생성하고 엔트리 화면 열기"}
                </Button>
              ) : status === "loading" ? (
                <Button variant="outline" disabled>
                  로그인 확인 중
                </Button>
              ) : (
                <Link href={loginHref} className={primaryLinkClassName}>
                  로그인하고 생성
                </Link>
              )}
            </div>
          </div>
        </form>
      </OverlayDialog>
    </>
  );
}
