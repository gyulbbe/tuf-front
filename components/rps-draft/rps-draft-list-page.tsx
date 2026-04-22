"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { SectionCard } from "@/components/site/section-card";
import { SurfaceCard } from "@/components/site/surface-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  createRpsDraftSession,
  listRpsDraftSessions,
  type RpsDraftSessionCreateRequest,
  type RpsDraftSessionSummary,
} from "@/lib/api/rps-draft";
import { buildLoginHref } from "@/lib/auth/auth-navigation";
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

function describeSchedule(session: RpsDraftSessionSummary) {
  if (session.endedAt) {
    return `종료 ${formatDateTime(session.endedAt)}`;
  }

  if (session.startedAt) {
    return `시작 ${formatDateTime(session.startedAt)}`;
  }

  return "시작 전";
}

export function RpsDraftListPage() {
  const router = useRouter();
  const { isAuthenticated, status } = useAuth();
  const [sessions, setSessions] = useState<RpsDraftSessionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [form, setForm] = useState<RpsDraftSessionCreateRequest>({
    title: "",
    team1Name: "",
    team2Name: "",
  });

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
              : "세션 목록을 불러오지 못했습니다.",
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

  async function handleCreateSession() {
    const title = form.title.trim();

    if (!title) {
      setCreateError("세션 이름을 입력해 주세요.");
      return;
    }

    setCreating(true);
    setCreateError(null);

    try {
      const createdSession = await createRpsDraftSession({
        title,
        team1Name: form.team1Name?.trim() || undefined,
        team2Name: form.team2Name?.trim() || undefined,
      });

      router.push(rpsDraftSessionPath(createdSession.id));
    } catch (createSessionError) {
      setCreateError(
        createSessionError instanceof Error
          ? createSessionError.message
          : "세션을 만들지 못했습니다.",
      );
    } finally {
      setCreating(false);
    }
  }

  const sortedSessions = sortSessions(sessions);
  const loginHref = buildLoginHref({ redirectTo: rpsDraftListPath() });

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_320px]">
      <SurfaceCard className="p-6 sm:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-accent">
              Draft
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
              가위바위보 팀 정하기
            </h1>
            <p className="mt-4 text-base leading-8 text-muted">
              세션을 만들고, 방장이 팀장 2명과 후보를 정한 뒤 바로 시작하면 된다.
            </p>
          </div>

          <Link href="/draft" className={secondaryLinkClassName}>
            기존 드래프트
          </Link>
        </div>

        {error ? (
          <div className="mt-6 rounded-[24px] border border-danger-ink/20 bg-danger-soft px-5 py-4">
            <p className="text-sm font-medium text-danger-ink">{error}</p>
          </div>
        ) : null}

        {loading ? (
          <div className="mt-6 rounded-[24px] border border-dashed border-line px-6 py-10 text-sm text-muted">
            세션 목록을 불러오는 중입니다.
          </div>
        ) : sortedSessions.length === 0 ? (
          <div className="mt-6 rounded-[24px] border border-dashed border-line px-6 py-10 text-sm text-muted">
            아직 만든 세션이 없습니다.
          </div>
        ) : (
          <div className="mt-6 grid gap-3">
            {sortedSessions.map((session) => (
              <SurfaceCard key={session.id} className="p-5 sm:p-6">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge status={session.status} />
                      <ValueBadge>{formatRelativePickNo(session.currentPickNo)}</ValueBadge>
                      <ValueBadge>
                        방장 {session.ownerName || "이름 없음"}
                      </ValueBadge>
                    </div>
                    <h2 className="mt-3 text-xl font-semibold text-foreground">
                      {session.title}
                    </h2>
                    <p className="mt-2 text-sm leading-7 text-muted">
                      {describeSchedule(session)}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Link
                      href={rpsDraftSessionPath(session.id)}
                      className={secondaryLinkClassName}
                    >
                      설정
                    </Link>
                    <Link
                      href={rpsDraftLivePath(session.id)}
                      className={primaryLinkClassName}
                    >
                      진행 화면
                    </Link>
                  </div>
                </div>
              </SurfaceCard>
            ))}
          </div>
        )}
      </SurfaceCard>

      <SectionCard
        title="새 세션"
        description="세션 이름과 두 팀 이름만 넣으면 바로 만들 수 있습니다."
      >
        <div className="mt-5 space-y-3">
          <Input
            value={form.title}
            onChange={(event) =>
              setForm((current) => ({ ...current, title: event.target.value }))
            }
            placeholder="세션 이름"
            disabled={creating}
          />
          <Input
            value={form.team1Name ?? ""}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                team1Name: event.target.value,
              }))
            }
            placeholder="1팀 이름"
            disabled={creating}
          />
          <Input
            value={form.team2Name ?? ""}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                team2Name: event.target.value,
              }))
            }
            placeholder="2팀 이름"
            disabled={creating}
          />

          {createError ? (
            <p className="text-sm text-danger-ink">{createError}</p>
          ) : null}

          {isAuthenticated ? (
            <Button
              variant="accent"
              fullWidth
              disabled={creating}
              onClick={() => {
                void handleCreateSession();
              }}
            >
              {creating ? "만드는 중..." : "세션 만들기"}
            </Button>
          ) : status === "loading" ? (
            <Button variant="outline" fullWidth disabled>
              로그인 확인 중...
            </Button>
          ) : (
            <Link href={loginHref} className={primaryLinkClassName}>
              로그인하고 만들기
            </Link>
          )}

          <p className="text-xs leading-6 text-muted">
            세션을 만든 뒤 방장이 팀장과 후보를 정합니다.
          </p>
        </div>
      </SectionCard>
    </div>
  );
}
