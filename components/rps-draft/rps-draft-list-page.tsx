"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { RpsDraftUserSearch } from "@/components/rps-draft/rps-draft-user-search";
import { OverlayDialog } from "@/components/site/overlay-dialog";
import { SurfaceCard } from "@/components/site/surface-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  createRpsDraftSession,
  listRpsDraftSessions,
  searchRpsDraftUsers,
  type RpsDraftSessionSummary,
  type RpsDraftUserSearchResult,
} from "@/lib/api/rps-draft";
import { buildLoginHref } from "@/lib/auth/auth-navigation";
import { canManageOwnedResource } from "@/lib/auth/roles";
import {
  rpsDraftListPath,
  rpsDraftLivePath,
  rpsDraftSessionPath,
} from "@/lib/rps-draft/routes";
import {
  formatDateTime,
  formatRelativePickNo,
  StatusBadge,
  ValueBadge,
} from "@/components/rps-draft/rps-draft-ui";

const secondaryLinkClassName =
  "inline-flex items-center justify-center rounded-full border border-line px-4 py-3 text-sm font-medium text-muted transition-colors hover:border-accent-soft hover:bg-surface-strong hover:text-foreground";

const primaryLinkClassName =
  "inline-flex items-center justify-center rounded-full bg-accent px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-accent-ink";

type RpsDraftCreateFormState = {
  title: string;
  team1Picker: RpsDraftUserSearchResult | null;
  team2Picker: RpsDraftUserSearchResult | null;
  candidates: RpsDraftUserSearchResult[];
};

function padNumber(value: number) {
  return String(value).padStart(2, "0");
}

function buildDefaultDraftTitle(username?: string | null) {
  const now = new Date();
  const userId = username?.trim() || "guest";

  return `${now.getFullYear()}${padNumber(now.getMonth() + 1)}${padNumber(now.getDate())}${padNumber(now.getHours())}${padNumber(now.getMinutes())}_${userId}`;
}

function createEmptyForm(title = ""): RpsDraftCreateFormState {
  return {
    title,
    team1Picker: null,
    team2Picker: null,
    candidates: [],
  };
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
    const delta =
      toTimestamp(right.startedAt) -
        toTimestamp(left.startedAt) ||
      toTimestamp(right.endedAt) -
        toTimestamp(left.endedAt) ||
      right.id - left.id;

    return delta;
  });
}

function filterActiveSessions(sessions: RpsDraftSessionSummary[]) {
  return sortSessions(sessions).filter((session) => session.status !== "FINISHED");
}

function describeSchedule(session: RpsDraftSessionSummary) {
  if (session.startedAt) {
    return `시작 ${formatDateTime(session.startedAt)}`;
  }

  return "아직 시작 전";
}

function describeProgress(session: RpsDraftSessionSummary) {
  switch (session.status) {
    case "READY":
      return "팀장과 후보 구성이 끝난 세션입니다. 바로 시작할 수 있습니다.";
    case "RPS_PENDING":
      return "두 팀장이 가위바위보로 선픽 순서를 정하는 중입니다.";
    case "PICKING":
      return session.currentPickNo
        ? `${session.currentPickNo}픽 진행 중입니다.`
        : "선수 선택이 진행 중입니다.";
    default:
      return "진행 상황을 확인해 주세요.";
  }
}

function formatSelectedUser(user: RpsDraftUserSearchResult) {
  return user.userId;
}

function resolveOwnerUserId(
  ownerUserId: number,
  ownerName: string | null | undefined,
  users: RpsDraftUserSearchResult[],
) {
  const exactPkMatch = users.find((user) => user.id === ownerUserId);

  if (exactPkMatch) {
    return exactPkMatch.userId;
  }

  const normalizedOwnerName = ownerName?.trim().toLowerCase();

  if (!normalizedOwnerName) {
    return null;
  }

  const exactTextMatch = users.find((user) => {
    const normalizedUserId = user.userId.trim().toLowerCase();
    const normalizedDisplayName = user.name?.trim().toLowerCase();

    return (
      normalizedUserId === normalizedOwnerName ||
      normalizedDisplayName === normalizedOwnerName
    );
  });

  return exactTextMatch?.userId ?? null;
}

function hasUser(user: RpsDraftUserSearchResult[], userId: number) {
  return user.some((entry) => entry.id === userId);
}

function validateCreateForm(form: RpsDraftCreateFormState) {
  const title = form.title.trim();

  if (!title) {
    return "드래프트 제목을 입력해 주세요.";
  }

  if (!form.team1Picker || !form.team2Picker) {
    return "팀장 두 명을 모두 골라 주세요.";
  }

  if (form.team1Picker.id === form.team2Picker.id) {
    return "서로 다른 유저를 팀장으로 선택해 주세요.";
  }

  if (form.candidates.length === 0) {
    return "후보를 1명 이상 추가해 주세요.";
  }

  if (hasUser(form.candidates, form.team1Picker.id) || hasUser(form.candidates, form.team2Picker.id)) {
    return "팀장은 후보 목록에 함께 넣을 수 없습니다.";
  }

  return null;
}

export function RpsDraftListPage() {
  const router = useRouter();
  const { isAuthenticated, status, user } = useAuth();
  const [sessions, setSessions] = useState<RpsDraftSessionSummary[]>([]);
  const [ownerUserIds, setOwnerUserIds] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [form, setForm] = useState<RpsDraftCreateFormState>(() =>
    createEmptyForm(buildDefaultDraftTitle(user?.username)),
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

  useEffect(() => {
    let cancelled = false;

    async function hydrateOwnerUserIds() {
      const knownOwnerUserIds: Record<number, string> = {};

      if (user?.username && typeof user.userPk === "number") {
        knownOwnerUserIds[user.userPk] = user.username;
      }

      if (Object.keys(knownOwnerUserIds).length > 0) {
        setOwnerUserIds((current) => ({
          ...current,
          ...knownOwnerUserIds,
        }));
      }

      const unresolvedSessions = sessions.filter((session) => {
        if (!session.ownerName?.trim()) {
          return false;
        }

        if (knownOwnerUserIds[session.ownerUserId]) {
          return false;
        }

        return !ownerUserIds[session.ownerUserId];
      });

      const uniqueSessions = Array.from(
        new Map(
          unresolvedSessions.map((session) => [session.ownerUserId, session]),
        ).values(),
      );

      if (uniqueSessions.length === 0) {
        return;
      }

      const resolvedEntries = await Promise.all(
        uniqueSessions.map(async (session) => {
          try {
            const users = await searchRpsDraftUsers(session.ownerName!, 8);
            return [
              session.ownerUserId,
              resolveOwnerUserId(session.ownerUserId, session.ownerName, users),
            ] as const;
          } catch {
            return [session.ownerUserId, null] as const;
          }
        }),
      );

      if (cancelled) {
        return;
      }

      const nextOwnerUserIds: Record<number, string> = {};

      for (const [ownerUserId, resolvedUserId] of resolvedEntries) {
        if (resolvedUserId) {
          nextOwnerUserIds[ownerUserId] = resolvedUserId;
        }
      }

      if (Object.keys(nextOwnerUserIds).length > 0) {
        setOwnerUserIds((current) => ({
          ...current,
          ...nextOwnerUserIds,
        }));
      }
    }

    void hydrateOwnerUserIds();

    return () => {
      cancelled = true;
    };
  }, [ownerUserIds, sessions, user?.userPk, user?.username]);

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
        candidateUserIds: form.candidates.map((candidate) => candidate.id),
      });

      setIsCreateOpen(false);
      setForm(createEmptyForm());
      router.push(rpsDraftSessionPath(createdSession.id));
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

  function handleAddCandidate(nextUser: RpsDraftUserSearchResult) {
    setCreateError(null);
    setForm((current) => {
      if (hasUser(current.candidates, nextUser.id)) {
        return current;
      }

      return {
        ...current,
        candidates: [...current.candidates, nextUser],
      };
    });
  }

  function handleRemoveCandidate(candidateUserId: number) {
    setCreateError(null);
    setForm((current) => ({
      ...current,
      candidates: current.candidates.filter((candidate) => candidate.id !== candidateUserId),
    }));
  }

  function handleOpenCreateDialog() {
    setCreateError(null);
    setForm(createEmptyForm(buildDefaultDraftTitle(user?.username)));
    setIsCreateOpen(true);
  }

  function handleCloseCreateDialog() {
    if (creating) {
      return;
    }

    setIsCreateOpen(false);
  }

  const activeSessions = filterActiveSessions(sessions);
  const loginHref = buildLoginHref({ redirectTo: rpsDraftListPath() });
  const candidateIds = form.candidates.map((candidate) => candidate.id);
  const team1DisabledUserIds = [
    form.team2Picker?.id,
    ...candidateIds,
  ].filter((value): value is number => typeof value === "number");
  const team2DisabledUserIds = [
    form.team1Picker?.id,
    ...candidateIds,
  ].filter((value): value is number => typeof value === "number");
  const candidateDisabledUserIds = [
    form.team1Picker?.id,
    form.team2Picker?.id,
    ...candidateIds,
  ].filter((value): value is number => typeof value === "number");
  const createSurfaceClassName =
    "bg-surface-strong shadow-none backdrop-blur-none";

  return (
    <>
      <SurfaceCard className="p-6 sm:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-accent">
              Draft
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
              팀배/컨텐츠 드래프트
            </h1>
            <p className="mt-4 text-base leading-8 text-muted">
              세션 생성 전에 팀장 2명과 후보 목록을 한 번에 정하고, 생성 직후 바로
              시작 단계로 넘어가는 팀배/컨텐츠 드래프트입니다.
            </p>
          </div>

          <Button variant="accent" onClick={handleOpenCreateDialog}>
            드래프트 생성
          </Button>
        </div>

        {error ? (
          <div className="mt-6 rounded-[24px] border border-danger-ink/20 bg-danger-soft px-5 py-4">
            <p className="text-sm font-medium text-danger-ink">{error}</p>
          </div>
        ) : null}

        {loading ? (
          <div className="mt-6 rounded-[24px] border border-dashed border-line px-6 py-10 text-sm text-muted">
            진행 가능한 드래프트를 불러오는 중입니다.
          </div>
        ) : activeSessions.length === 0 ? (
          <div className="mt-6 rounded-[24px] border border-dashed border-line px-6 py-10 text-sm text-muted">
            아직 진행 가능한 드래프트가 없습니다.
          </div>
        ) : (
          <div className="mt-6 grid gap-3">
            {activeSessions.map((session) => {
              const canManage = canManageOwnedResource({
                ownerUserId: session.ownerUserId,
                role: user?.role,
                userPk: user?.userPk,
              });
              const settingsClassName = canManage
                ? primaryLinkClassName
                : secondaryLinkClassName;
              const liveClassName = canManage
                ? secondaryLinkClassName
                : primaryLinkClassName;

              return (
                <SurfaceCard key={session.id} className="p-5 sm:p-6">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusBadge status={session.status} />
                        <ValueBadge>{formatRelativePickNo(session.currentPickNo)}</ValueBadge>
                        <ValueBadge>
                          방장 {ownerUserIds[session.ownerUserId] ?? `user_pk:${session.ownerUserId}`}
                        </ValueBadge>
                      </div>
                      <h2 className="mt-3 text-xl font-semibold text-foreground">
                        {session.title}
                      </h2>
                      <p className="mt-2 text-sm leading-7 text-muted">
                        {describeProgress(session)}
                      </p>
                      <p className="mt-2 text-sm text-muted">{describeSchedule(session)}</p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Link
                        href={rpsDraftSessionPath(session.id)}
                        className={settingsClassName}
                      >
                        세션 상세
                      </Link>
                      <Link href={rpsDraftLivePath(session.id)} className={liveClassName}>
                        진행 화면
                      </Link>
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
        description="제목, 팀장 2명, 후보 목록을 여기서 모두 정합니다. 생성이 끝나면 바로 세션 상세로 이동합니다."
        panelClassName="max-w-6xl bg-white backdrop-blur-none"
      >
        <form
          className="grid gap-5 xl:grid-cols-[minmax(0,420px)_minmax(0,1fr)]"
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
                placeholder="예: 4월 팀배 컨텐츠전"
                disabled={creating}
              />
            </div>

            <div className="grid gap-4">
              <SurfaceCard className={`p-5 ${createSurfaceClassName}`}>
                <div>
                  <h3 className="text-lg font-semibold text-foreground">1팀 팀장</h3>
                </div>

                <div className="mt-4">
                  <RpsDraftUserSearch
                    label="팀장 검색"
                    selectedUser={form.team1Picker}
                    onSelect={(nextUser) => {
                      handleSelectTeam("team1Picker", nextUser);
                    }}
                    disabled={creating}
                    disabledUserIds={team1DisabledUserIds}
                    disabledUserMessage="다른 팀장이나 후보로 이미 선택된 유저입니다."
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

              <SurfaceCard className={`p-5 ${createSurfaceClassName}`}>
                <div>
                  <h3 className="text-lg font-semibold text-foreground">2팀 팀장</h3>
                </div>

                <div className="mt-4">
                  <RpsDraftUserSearch
                    label="팀장 검색"
                    selectedUser={form.team2Picker}
                    onSelect={(nextUser) => {
                      handleSelectTeam("team2Picker", nextUser);
                    }}
                    disabled={creating}
                    disabledUserIds={team2DisabledUserIds}
                    disabledUserMessage="다른 팀장이나 후보로 이미 선택된 유저입니다."
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
          </div>

          <SurfaceCard className={`p-5 ${createSurfaceClassName}`}>
            <div>
              <div>
                <h3 className="text-lg font-semibold text-foreground">팀원 선택</h3>
              </div>
            </div>

            <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
              <RpsDraftUserSearch
                label="팀원 검색"
                onSelect={(nextUser) => {
                  handleAddCandidate(nextUser);
                }}
                disabled={creating}
                disabledUserIds={candidateDisabledUserIds}
                disabledUserMessage="팀장이거나 이미 후보 목록에 들어간 유저입니다."
              />

              <div className="rounded-[22px] border border-line bg-white px-4 py-4">
                <div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">선택한 팀원</p>
                  </div>
                </div>

                {form.candidates.length === 0 ? (
                  <div className="mt-4 rounded-2xl border border-dashed border-line px-4 py-8 text-sm text-muted">
                    아직 선택한 팀원이 없습니다.
                  </div>
                ) : (
                  <div className="mt-4 grid max-h-80 gap-3 overflow-y-auto pr-1">
                    {form.candidates.map((candidate, index) => (
                      <div
                        key={candidate.id}
                        className="rounded-2xl border border-line bg-white px-4 py-4"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <ValueBadge>{index + 1}번 팀원</ValueBadge>
                              <span className="text-sm font-semibold text-foreground">
                                {formatSelectedUser(candidate)}
                              </span>
                            </div>
                          </div>

                          <Button
                            size="sm"
                            onClick={() => {
                              handleRemoveCandidate(candidate.id);
                            }}
                            disabled={creating}
                          >
                            제거
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </SurfaceCard>

          <div className="space-y-3 border-t border-line/80 pt-4 xl:col-span-2">
            {createError ? (
              <p className="text-sm text-danger-ink">{createError}</p>
            ) : null}

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs leading-6 text-muted">
                생성 전에 팀장 2명과 후보를 모두 정합니다. 생성되면 세션 상세에서
                바로 시작만 하면 됩니다.
              </p>

              <div className="sm:min-w-72">
                {isAuthenticated ? (
                  <Button type="submit" variant="accent" fullWidth disabled={creating}>
                    {creating ? "생성하는 중..." : "생성하고 세션 열기"}
                  </Button>
                ) : status === "loading" ? (
                  <Button variant="outline" fullWidth disabled>
                    로그인 확인 중...
                  </Button>
                ) : (
                  <Link href={loginHref} className={`${primaryLinkClassName} w-full`}>
                    로그인하고 생성하기
                  </Link>
                )}
              </div>
            </div>
          </div>
        </form>
      </OverlayDialog>
    </>
  );
}
