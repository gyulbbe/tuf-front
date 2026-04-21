"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { SectionCard } from "@/components/site/section-card";
import { SurfaceCard } from "@/components/site/surface-card";
import { TabPageShell } from "@/components/site/tab-page-shell";
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
  formatDateTime,
  formatRelativePickNo,
  StatusBadge,
  ValueBadge,
} from "@/components/rps-draft/rps-draft-ui";

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
      setCreateError("세션 제목을 입력해 주세요.");
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

      router.push(`/rps-draft/${createdSession.id}`);
    } catch (createSessionError) {
      setCreateError(
        createSessionError instanceof Error
          ? createSessionError.message
          : "세션 생성에 실패했습니다.",
      );
    } finally {
      setCreating(false);
    }
  }

  const sortedSessions = sortSessions(sessions);
  const loginHref = buildLoginHref({ redirectTo: "/rps-draft" });

  return (
    <TabPageShell
      label="RPS Draft"
      title="가위바위보 드래프트"
      description="기존 드래프트와 분리된 2팀 전용 RPS 세션 목록이다. 세션 조회는 누구나 가능하고, 생성과 제어는 권한에 따라 열린다."
      sidebar={
        <>
          <SectionCard
            title="새 세션"
            description="READY 상태에서 픽커와 후보를 구성한 뒤 시작한다. 팀명은 비워 두면 백엔드 기본값 1팀 / 2팀이 사용된다."
          >
            <div className="mt-5 space-y-3">
              <Input
                value={form.title}
                onChange={(event) =>
                  setForm((current) => ({ ...current, title: event.target.value }))
                }
                placeholder="세션 제목"
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
                placeholder="1팀명 (선택)"
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
                placeholder="2팀명 (선택)"
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
                  {creating ? "생성 중..." : "세션 만들기"}
                </Button>
              ) : status === "loading" ? (
                <Button variant="outline" fullWidth disabled>
                  인증 확인 중...
                </Button>
              ) : (
                <Link
                  href={loginHref}
                  className="inline-flex w-full items-center justify-center rounded-full bg-accent px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-accent-ink"
                >
                  로그인 후 세션 만들기
                </Link>
              )}
            </div>
          </SectionCard>

          <SectionCard
            title="흐름"
            description="오너가 세션을 시작하면 RPS 제출 대기 상태로 바뀐다. 양 팀이 제출하면 승자가 선픽, 패자가 후픽을 가져가고 후보가 끝나면 종료된다."
          />
        </>
      }
    >
      {error ? (
        <SurfaceCard className="border-danger-ink/20 bg-danger-soft p-5">
          <p className="text-sm font-medium text-danger-ink">{error}</p>
        </SurfaceCard>
      ) : null}

      {loading ? (
        <div className="rounded-[24px] border border-dashed border-line px-6 py-10 text-sm text-muted">
          세션 목록을 불러오는 중...
        </div>
      ) : sortedSessions.length === 0 ? (
        <div className="rounded-[24px] border border-dashed border-line px-6 py-10 text-sm text-muted">
          아직 생성된 RPS 드래프트 세션이 없다.
        </div>
      ) : (
        <div className="grid gap-4">
          {sortedSessions.map((session) => (
            <SurfaceCard key={session.id} className="p-5 sm:p-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge status={session.status} />
                    <ValueBadge>{formatRelativePickNo(session.currentPickNo)}</ValueBadge>
                    <ValueBadge>owner {session.ownerName || session.ownerUserId}</ValueBadge>
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold text-foreground">
                      {session.title}
                    </h2>
                    <p className="mt-2 text-sm leading-7 text-muted">
                      시작 {formatDateTime(session.startedAt)} · 종료{" "}
                      {formatDateTime(session.endedAt)}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs text-muted">
                    <span>현재 팀 ID {session.currentDraftTeamId ?? "없음"}</span>
                    <span>대기 팀 ID {session.pendingDraftTeamId ?? "없음"}</span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Link
                    href={`/rps-draft/${session.id}`}
                    className="inline-flex items-center justify-center rounded-full border border-line px-4 py-2 text-sm text-muted transition-colors hover:border-accent-soft hover:bg-surface-strong hover:text-foreground"
                  >
                    설정
                  </Link>
                  <Link
                    href={`/rps-draft/${session.id}/live`}
                    className="inline-flex items-center justify-center rounded-full bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-ink"
                  >
                    라이브
                  </Link>
                </div>
              </div>
            </SurfaceCard>
          ))}
        </div>
      )}
    </TabPageShell>
  );
}
