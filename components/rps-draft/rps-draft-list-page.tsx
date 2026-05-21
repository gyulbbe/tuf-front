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
  createRpsDraftSession,
  deleteRpsDraftSession,
  listRpsDraftSessions,
  type RpsDraftSessionSummary,
  type RpsDraftUserSearchResult,
} from "@/lib/api/rps-draft";
import { buildLoginHref } from "@/lib/auth/auth-navigation";
import type { AuthUser } from "@/lib/auth/auth-types";
import { canManageOwnedResource } from "@/lib/auth/roles";
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

function parseCandidateNames(value: string) {
  return value
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean);
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

function sortSessions(sessions: RpsDraftSessionSummary[]) {
  return [...sessions].sort((left, right) => {
    const leftFinished = left.status === "FINISHED";
    const rightFinished = right.status === "FINISHED";
    const delta =
      Number(leftFinished) - Number(rightFinished) ||
      toTimestamp(right.regDate ?? right.startedAt) -
        toTimestamp(left.regDate ?? left.startedAt) ||
      right.id - left.id;

    return delta;
  });
}

function describeSchedule(session: RpsDraftSessionSummary) {
  if (session.regDate) {
    return `생성 ${formatDateTime(session.regDate)}`;
  }

  if (session.startedAt) {
    return `생성 ${formatDateTime(session.startedAt)}`;
  }

  return null;
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

export function RpsDraftListPage() {
  const router = useRouter();
  const { isAuthenticated, status, user } = useAuth();
  const [sessions, setSessions] = useState<RpsDraftSessionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [deletingSessionId, setDeletingSessionId] = useState<number | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [form, setForm] = useState<RpsDraftCreateFormState>(() =>
    createEmptyForm(
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
        const nextSessions = await listRpsDraftSessions();

        if (!cancelled) {
          setSessions(nextSessions);
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
  }, []);

  const sortedSessions = sortSessions(sessions);
  const loginHref = buildLoginHref({ redirectTo: rpsDraftListPath() });
  const previewCandidateNames = useMemo(
    () => parseCandidateNames(form.candidateNamesText),
    [form.candidateNamesText],
  );
  const team1DisabledUserIds = [
    form.team2Picker?.id,
  ].filter((value): value is number => typeof value === "number");
  const team2DisabledUserIds = [
    form.team1Picker?.id,
  ].filter((value): value is number => typeof value === "number");

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

  function handleOpenCreateDialog() {
    setCreateError(null);
    setForm(
      createEmptyForm(
        buildDefaultDraftTitle(user?.username),
        toCurrentUserSearchResult(user),
      ),
    );
    setIsCreateOpen(true);
  }

  function handleCloseCreateDialog() {
    if (creating) {
      return;
    }

    setIsCreateOpen(false);
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

  return (
    <>
      <SurfaceCard className="p-6 sm:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-4xl">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-accent">
              Draft
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
              가위바위보 드래프트
            </h1>
            <p className="mt-4 text-base leading-8 text-muted">
              팀장 2명은 기존 계정에서 선택하고, 후보는 계정 없이 이름 목록으로 진행합니다.
            </p>
          </div>

          {isAuthenticated ? (
            <div className="flex flex-wrap gap-2 sm:justify-end">
              <Link href="/draft/pinball" className={secondaryLinkClassName}>
                핀볼 드래프트
              </Link>
              <Button variant="accent" onClick={handleOpenCreateDialog}>
                새 드래프트
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
            진행 가능한 드래프트를 불러오는 중입니다.
          </div>
        ) : sortedSessions.length === 0 ? (
          <div className="mt-6 rounded-lg border border-dashed border-line px-6 py-10 text-sm text-muted">
            아직 생성된 드래프트가 없습니다.
          </div>
        ) : (
          <div className="mt-6 grid gap-3 2xl:grid-cols-2">
            {sortedSessions.map((session) => {
              const canManage = canManageOwnedResource({
                ownerUserId: session.ownerUserId,
                role: user?.role,
                userPk: user?.userPk,
              });
              const ownerLabel = formatUserLoginId(session.ownerUserLoginId);
              const liveClassName = canManage
                ? primaryLinkClassName
                : secondaryLinkClassName;

              return (
                <SurfaceCard key={session.id} className="p-5 sm:p-6">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusBadge status={session.status} />
                        <ValueBadge>{formatRelativePickNo(session.currentPickNo)}</ValueBadge>
                        <ValueBadge>방장 {ownerLabel}</ValueBadge>
                      </div>
                      <h2 className="mt-3 text-xl font-semibold text-foreground">
                        {session.title}
                      </h2>
                      <p className="mt-2 text-sm leading-7 text-muted">
                        {describeProgress(session)}
                      </p>
                      {describeSchedule(session) ? (
                        <p className="mt-2 text-sm text-muted">{describeSchedule(session)}</p>
                      ) : null}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Link href={rpsDraftLivePath(session.id)} className={liveClassName}>
                        진행 화면
                      </Link>
                      {canManage ? (
                        <Button
                          variant="danger"
                          disabled={deletingSessionId === session.id}
                          onClick={() => {
                            void handleDeleteSession(session.id, session.title);
                          }}
                        >
                          {deletingSessionId === session.id ? "삭제 중" : "삭제"}
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
    </>
  );
}
