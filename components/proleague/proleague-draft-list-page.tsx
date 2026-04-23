"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { DraftAdminConsole } from "@/components/proleague/draft-admin-console";
import { OverlayDialog } from "@/components/site/overlay-dialog";
import { SurfaceCard } from "@/components/site/surface-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  createDraftSession,
  listDraftSessions,
  searchDraftUsers,
  type DraftSessionSummary,
  type DraftUserSearchResult,
} from "@/lib/api/draft";
import { buildLoginHref } from "@/lib/auth/auth-navigation";
import { canManageOwnedResource } from "@/lib/auth/roles";
import {
  proleagueDraftListPath,
  proleagueDraftLivePath,
  proleagueDraftSessionPath,
} from "@/lib/proleague-draft/routes";
import { cn } from "@/lib/utils";

type CreateFormState = {
  pickTimeSeconds: string;
  teamCount: string;
  title: string;
};

function padNumber(value: number) {
  return String(value).padStart(2, "0");
}

function buildDefaultDraftTitle(username?: string | null) {
  const now = new Date();
  const userId = username?.trim() || "guest";

  return `${now.getFullYear()}${padNumber(now.getMonth() + 1)}${padNumber(now.getDate())}${padNumber(now.getHours())}${padNumber(now.getMinutes())}_${userId}`;
}

function createEmptyForm(title = ""): CreateFormState {
  return {
    title,
    teamCount: "6",
    pickTimeSeconds: "30",
  };
}

function resolveOwnerUserId(
  ownerUserId: number,
  ownerName: string | null | undefined,
  users: DraftUserSearchResult[],
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

const STATUS_LABELS: Record<string, string> = {
  READY: "준비",
  LIVE: "진행 중",
  PAUSED: "일시정지",
  FINISHED: "종료",
};

const secondaryLinkClassName =
  "inline-flex items-center justify-center rounded-full border border-line px-4 py-3 text-sm font-medium text-muted transition-colors hover:border-accent-soft hover:bg-surface-strong hover:text-foreground";

const primaryLinkClassName =
  "inline-flex items-center justify-center rounded-full bg-accent px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-accent-ink";

function toTimestamp(value: string | null | undefined) {
  if (!value) {
    return 0;
  }

  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function formatDateTime(value: string | null | undefined) {
  const timestamp = toTimestamp(value);

  if (!timestamp) {
    return "-";
  }

  return new Intl.DateTimeFormat("ko-KR", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(timestamp);
}

function sortSessions(sessions: DraftSessionSummary[]) {
  const priority = new Map([
    ["LIVE", 0],
    ["PAUSED", 1],
    ["READY", 2],
    ["FINISHED", 3],
  ]);

  return [...sessions].sort((left, right) => {
    const priorityGap =
      (priority.get(left.status) ?? Number.MAX_SAFE_INTEGER) -
      (priority.get(right.status) ?? Number.MAX_SAFE_INTEGER);

    if (priorityGap !== 0) {
      return priorityGap;
    }

    const leftActivity =
      toTimestamp(left.startedAt) ||
      toTimestamp(left.deadlineAt) ||
      toTimestamp(left.endedAt) ||
      left.id;
    const rightActivity =
      toTimestamp(right.startedAt) ||
      toTimestamp(right.deadlineAt) ||
      toTimestamp(right.endedAt) ||
      right.id;

    return rightActivity - leftActivity;
  });
}

function filterActiveSessions(sessions: DraftSessionSummary[]) {
  return sortSessions(sessions).filter((session) => session.status !== "FINISHED");
}

function formatStatus(status: string) {
  return STATUS_LABELS[status] ?? status;
}

function getStatusClassName(status: string) {
  switch (status) {
    case "LIVE":
      return "bg-success-soft text-success-ink";
    case "PAUSED":
      return "bg-danger-soft text-danger-ink";
    case "FINISHED":
      return "bg-surface-muted text-muted";
    default:
      return "bg-accent-soft text-accent-ink";
  }
}

function describeActivity(session: DraftSessionSummary) {
  if (session.status === "LIVE" && session.deadlineAt) {
    return `현재 턴 마감 ${formatDateTime(session.deadlineAt)}`;
  }

  if (session.startedAt) {
    return `시작 ${formatDateTime(session.startedAt)}`;
  }

  if (session.endedAt) {
    return `종료 ${formatDateTime(session.endedAt)}`;
  }

  return "아직 시작 전";
}

export function ProleagueDraftListPage() {
  const { isAuthenticated, status, user } = useAuth();
  const [sessions, setSessions] = useState<DraftSessionSummary[]>([]);
  const [ownerUserIds, setOwnerUserIds] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingSessionId, setEditingSessionId] = useState<number | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<CreateFormState>(() =>
    createEmptyForm(buildDefaultDraftTitle(user?.username)),
  );

  useEffect(() => {
    let cancelled = false;

    async function loadSessions() {
      setLoading(true);
      setError(null);

      try {
        const nextSessions = await listDraftSessions();

        if (!cancelled) {
          setSessions(nextSessions);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "프로리그 드래프트 목록을 불러오지 못했습니다.",
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
            const users = await searchDraftUsers(session.ownerName!, 8);
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
    const title = form.title.trim();
    const teamCount = Number(form.teamCount.trim());
    const pickTimeSeconds = Number(form.pickTimeSeconds.trim());

    if (!title) {
      setCreateError("드래프트 이름을 입력해 주세요.");
      return;
    }

    if (!Number.isInteger(teamCount) || teamCount < 2) {
      setCreateError("팀 수는 2 이상의 정수여야 합니다.");
      return;
    }

    if (!Number.isInteger(pickTimeSeconds) || pickTimeSeconds < 1) {
      setCreateError("픽 제한 시간은 1초 이상의 정수여야 합니다.");
      return;
    }

    setCreating(true);
    setCreateError(null);

    try {
      const createdSession = await createDraftSession({
        title,
        teamCount,
        pickTimeSeconds,
      });

      setEditingSessionId(createdSession.id);
      try {
        const nextSessions = await listDraftSessions();
        setSessions(nextSessions);
      } catch {
        // noop
      }
    } catch (createSessionError) {
      setCreateError(
        createSessionError instanceof Error
          ? createSessionError.message
          : "프로리그 드래프트를 생성하지 못했습니다.",
      );
    } finally {
      setCreating(false);
    }
  }

  function handleOpenCreateDialog() {
    setCreateError(null);
    setEditingSessionId(null);
    setForm(createEmptyForm(buildDefaultDraftTitle(user?.username)));
    setIsCreateOpen(true);
  }

  function handleCloseCreateDialog() {
    if (creating) {
      return;
    }

    setIsCreateOpen(false);
    setEditingSessionId(null);
  }

  const activeSessions = filterActiveSessions(sessions);
  const loginHref = buildLoginHref({ redirectTo: proleagueDraftListPath() });

  return (
    <>
      <SurfaceCard className="p-6 sm:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-accent">
              Draft
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
              프로리그 드래프트
            </h1>
            <p className="mt-4 text-base leading-8 text-muted">
              진행 중인 프로리그 드래프트를 바로 확인하고, 새 세션을 만들어 바로 설정을
              이어갈 수 있습니다.
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
            진행 가능한 프로리그 드래프트를 불러오는 중입니다.
          </div>
        ) : activeSessions.length === 0 ? (
          <div className="mt-6 rounded-[24px] border border-dashed border-line px-6 py-10 text-sm text-muted">
            아직 진행 가능한 프로리그 드래프트가 없습니다.
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
                        <span
                          className={cn(
                            "rounded-full px-3 py-1 text-xs font-semibold",
                            getStatusClassName(session.status),
                          )}
                        >
                          {formatStatus(session.status)}
                        </span>
                        <span className="rounded-full bg-surface-muted px-3 py-1 text-xs font-semibold text-foreground">
                          방장 {ownerUserIds[session.ownerUserId] ?? `user_pk:${session.ownerUserId}`}
                        </span>
                        <span className="rounded-full bg-surface-muted px-3 py-1 text-xs font-semibold text-foreground">
                          팀 {session.teamCount}
                        </span>
                        <span className="rounded-full bg-surface-muted px-3 py-1 text-xs font-semibold text-foreground">
                          제한 {session.pickTimeSeconds}초
                        </span>
                      </div>

                      <h2 className="mt-3 text-xl font-semibold text-foreground">
                        {session.title}
                      </h2>
                      <p className="mt-2 text-sm leading-7 text-muted">
                        {describeActivity(session)}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Link
                        href={proleagueDraftSessionPath(session.id)}
                        className={settingsClassName}
                      >
                        설정
                      </Link>
                      <Link
                        href={proleagueDraftLivePath(session.id)}
                        className={liveClassName}
                      >
                        라이브/관전
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
        title={editingSessionId ? "프로리그 드래프트 설정" : "드래프트 생성"}
        description={
          editingSessionId
            ? undefined
            : "세션을 만들고 같은 팝업 안에서 바로 설정을 이어갑니다."
        }
        panelClassName="max-w-7xl"
      >
        {editingSessionId ? (
          <DraftAdminConsole
            sessionId={editingSessionId}
            onDataChanged={() => {
              void listDraftSessions()
                .then((nextSessions) => {
                  setSessions(nextSessions);
                })
                .catch(() => {
                  // noop
                });
            }}
            onSessionDeleted={() => {
              setEditingSessionId(null);
              setIsCreateOpen(false);
              void listDraftSessions()
                .then((nextSessions) => {
                  setSessions(nextSessions);
                })
                .catch(() => {
                  // noop
                });
            }}
          />
        ) : (
          <form
            className="space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              void handleCreateSession();
            }}
          >
            <Input
              value={form.title}
              onChange={(event) =>
                setForm((current) => ({ ...current, title: event.target.value }))
              }
              placeholder="드래프트 이름"
              disabled={creating}
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <Input
                type="number"
                min={2}
                value={form.teamCount}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    teamCount: event.target.value,
                  }))
                }
                placeholder="팀 수"
                disabled={creating}
              />
              <Input
                type="number"
                min={1}
                value={form.pickTimeSeconds}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    pickTimeSeconds: event.target.value,
                  }))
                }
                placeholder="픽 제한 시간(초)"
                disabled={creating}
              />
            </div>

            {createError ? (
              <p className="text-sm text-danger-ink">{createError}</p>
            ) : null}

            {isAuthenticated ? (
              <Button type="submit" variant="accent" fullWidth disabled={creating}>
                {creating ? "생성하는 중..." : "생성하고 설정 계속하기"}
              </Button>
            ) : status === "loading" ? (
              <Button variant="outline" fullWidth disabled>
                로그인 확인 중...
              </Button>
            ) : (
              <Link href={loginHref} className={primaryLinkClassName}>
                로그인하고 생성하기
              </Link>
            )}
          </form>
        )}
      </OverlayDialog>
    </>
  );
}
