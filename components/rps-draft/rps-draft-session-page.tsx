"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { RpsDraftUserSearch } from "@/components/rps-draft/rps-draft-user-search";
import {
  formatDateTime,
  formatRace,
  formatRelativePickNo,
  formatSessionStatus,
  StatusBadge,
  ValueBadge,
} from "@/components/rps-draft/rps-draft-ui";
import { SectionCard } from "@/components/site/section-card";
import { SurfaceCard } from "@/components/site/surface-card";
import { TabPageShell } from "@/components/site/tab-page-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  assignRpsDraftPicker,
  getRpsDraftSession,
  listRpsDraftCandidates,
  registerRpsDraftCandidate,
  startRpsDraftSession,
  type RpsDraftCandidate,
  type RpsDraftSessionDetail,
  type RpsDraftTeam,
  type RpsDraftUserSearchResult,
} from "@/lib/api/rps-draft";
import { buildLoginHref } from "@/lib/auth/auth-navigation";

const RACE_OPTIONS = [
  { label: "자동", value: "" },
  { label: "저그", value: "ZERG" },
  { label: "테란", value: "TERRAN" },
  { label: "프로토스", value: "PROTOSS" },
  { label: "랜덤", value: "RANDOM" },
] as const;

function sortTeams(teams: RpsDraftTeam[]) {
  return [...teams].sort((left, right) => left.displayOrder - right.displayOrder);
}

function sortCandidates(candidates: RpsDraftCandidate[]) {
  const statusRank: Record<string, number> = {
    WAITING: 0,
    PICKED: 1,
    EXCLUDED: 2,
  };

  return [...candidates].sort((left, right) => {
    const rankDelta =
      (statusRank[left.status] ?? Number.MAX_SAFE_INTEGER) -
      (statusRank[right.status] ?? Number.MAX_SAFE_INTEGER);

    if (rankDelta !== 0) {
      return rankDelta;
    }

    return left.candidateName.localeCompare(right.candidateName, "ko-KR");
  });
}

export function RpsDraftSessionPage({ sessionId }: { sessionId: number }) {
  const router = useRouter();
  const { isAuthenticated, status, user } = useAuth();
  const [session, setSession] = useState<RpsDraftSessionDetail | null>(null);
  const [candidates, setCandidates] = useState<RpsDraftCandidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [selectedPickers, setSelectedPickers] = useState<
    Record<number, RpsDraftUserSearchResult | null>
  >({});
  const [candidateUser, setCandidateUser] =
    useState<RpsDraftUserSearchResult | null>(null);
  const [candidateName, setCandidateName] = useState("");
  const [candidateRace, setCandidateRace] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadPage() {
      setLoading(true);
      setError(null);

      try {
        const [nextSession, nextCandidates] = await Promise.all([
          getRpsDraftSession(sessionId),
          listRpsDraftCandidates(sessionId),
        ]);

        if (!cancelled) {
          setSession(nextSession);
          setCandidates(nextCandidates);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "세션 정보를 불러오지 못했습니다.",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadPage();

    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  async function refreshPage(message?: string | null) {
    const [nextSession, nextCandidates] = await Promise.all([
      getRpsDraftSession(sessionId),
      listRpsDraftCandidates(sessionId),
    ]);

    setSession(nextSession);
    setCandidates(nextCandidates);
    setActionMessage(message ?? null);
  }

  async function handleAssignPicker(teamId: number) {
    const selectedPicker = selectedPickers[teamId];

    if (!selectedPicker) {
      setActionMessage("픽커로 지정할 유저를 먼저 선택해 주세요.");
      return;
    }

    setPendingAction(`picker:${teamId}`);
    setActionMessage(null);

    try {
      await assignRpsDraftPicker(sessionId, teamId, {
        pickerUserId: selectedPicker.id,
      });
      setSelectedPickers((current) => ({ ...current, [teamId]: null }));
      await refreshPage("픽커를 지정했다.");
    } catch (assignError) {
      setActionMessage(
        assignError instanceof Error
          ? assignError.message
          : "픽커 지정에 실패했습니다.",
      );
    } finally {
      setPendingAction(null);
    }
  }

  async function handleRegisterCandidate() {
    if (!candidateUser) {
      setActionMessage("후보로 등록할 유저를 먼저 선택해 주세요.");
      return;
    }

    setPendingAction("candidate");
    setActionMessage(null);

    try {
      await registerRpsDraftCandidate(sessionId, {
        candidateUserId: candidateUser.id,
        candidateName: candidateName.trim() || undefined,
        race: candidateRace || undefined,
      });
      setCandidateUser(null);
      setCandidateName("");
      setCandidateRace("");
      await refreshPage("후보를 등록했다.");
    } catch (registerError) {
      setActionMessage(
        registerError instanceof Error
          ? registerError.message
          : "후보 등록에 실패했습니다.",
      );
    } finally {
      setPendingAction(null);
    }
  }

  async function handleStart() {
    setPendingAction("start");
    setActionMessage(null);

    try {
      await startRpsDraftSession(sessionId);
      router.push(`/rps-draft/${sessionId}/live`);
    } catch (startError) {
      setActionMessage(
        startError instanceof Error ? startError.message : "세션 시작에 실패했습니다.",
      );
      setPendingAction(null);
    }
  }

  const sortedTeams = sortTeams(session?.teams ?? []);
  const sortedCandidates = sortCandidates(candidates);
  const waitingCandidates = sortedCandidates.filter(
    (candidate) => candidate.status === "WAITING",
  );
  const isOwner = session && user ? session.ownerUserId === user.userPk : false;
  const isReady = session?.status === "READY";
  const canManageReady = Boolean(isOwner && isReady);
  const canStart =
    canManageReady &&
    sortedTeams.length === 2 &&
    sortedTeams.every((team) => typeof team.pickerUserId === "number") &&
    waitingCandidates.length > 0;
  const loginHref = buildLoginHref({
    redirectTo: `/rps-draft/${sessionId}`,
  });

  return (
    <TabPageShell
      label="RPS Draft"
      title={session?.title ?? "가위바위보 드래프트 세션"}
      description="READY 상태에서는 오너가 2팀 픽커와 후보를 확정하고 시작할 수 있다. 세션이 시작된 뒤 실시간 진행은 라이브 화면에서 본다."
      sidebar={
        <>
          <SectionCard
            title="세션 상태"
            description="이 화면은 준비용 설정 페이지다. 시작 이후에는 라이브 화면을 source of truth로 사용한다."
          >
            {session ? (
              <div className="mt-5 space-y-3 text-sm text-foreground">
                <div className="flex flex-wrap gap-2">
                  <StatusBadge status={session.status} />
                  <ValueBadge>{formatRelativePickNo(session.currentPickNo)}</ValueBadge>
                </div>
                <p>오너: {session.ownerName || session.ownerUserId}</p>
                <p>시작: {formatDateTime(session.startedAt)}</p>
                <p>종료: {formatDateTime(session.endedAt)}</p>
                <p>현재 상태: {formatSessionStatus(session.status)}</p>
              </div>
            ) : (
              <p className="mt-5 text-sm text-muted">세션 정보를 불러오는 중...</p>
            )}
          </SectionCard>

          <SectionCard
            title="바로 가기"
            description="설정과 라이브 화면을 분리해 둔다. 시작 전에도 라이브 화면에서 공개 상태를 볼 수 있다."
          >
            <div className="mt-5 flex flex-col gap-2">
              <Link
                href="/rps-draft"
                className="inline-flex items-center justify-center rounded-full border border-line px-4 py-2 text-sm text-muted transition-colors hover:border-accent-soft hover:bg-surface-strong hover:text-foreground"
              >
                목록으로
              </Link>
              <Link
                href={`/rps-draft/${sessionId}/live`}
                className="inline-flex items-center justify-center rounded-full bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-ink"
              >
                라이브 화면
              </Link>
              {!isAuthenticated && status !== "loading" ? (
                <Link
                  href={loginHref}
                  className="inline-flex items-center justify-center rounded-full border border-line px-4 py-2 text-sm text-muted transition-colors hover:border-accent-soft hover:bg-surface-strong hover:text-foreground"
                >
                  로그인
                </Link>
              ) : null}
            </div>
          </SectionCard>
        </>
      }
    >
      {error ? (
        <SurfaceCard className="border-danger-ink/20 bg-danger-soft p-5">
          <p className="text-sm font-medium text-danger-ink">{error}</p>
        </SurfaceCard>
      ) : null}

      {actionMessage ? (
        <SurfaceCard className="border-line bg-surface-strong p-5">
          <p className="text-sm text-foreground">{actionMessage}</p>
        </SurfaceCard>
      ) : null}

      {loading ? (
        <div className="rounded-[24px] border border-dashed border-line px-6 py-10 text-sm text-muted">
          세션 정보를 불러오는 중...
        </div>
      ) : session ? (
        <div className="grid gap-4">
          <SurfaceCard className="p-5 sm:p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={session.status} />
                  <ValueBadge>{formatRelativePickNo(session.currentPickNo)}</ValueBadge>
                </div>
                <p className="mt-3 text-sm leading-7 text-muted">
                  READY 상태에서만 픽커 지정과 후보 등록이 가능하다. 현재 상태는{" "}
                  {formatSessionStatus(session.status)}.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  variant="accent"
                  disabled={pendingAction !== null || !canStart}
                  onClick={() => {
                    void handleStart();
                  }}
                >
                  {pendingAction === "start" ? "시작 중..." : "세션 시작"}
                </Button>
                <Link
                  href={`/rps-draft/${sessionId}/live`}
                  className="inline-flex items-center justify-center rounded-full border border-line px-4 py-3 text-sm text-muted transition-colors hover:border-accent-soft hover:bg-surface-strong hover:text-foreground"
                >
                  라이브 열기
                </Link>
              </div>
            </div>

            {!isAuthenticated && status !== "loading" ? (
              <p className="mt-4 text-sm text-muted">
                제어하려면{" "}
                <Link href={loginHref} className="font-semibold text-accent">
                  로그인
                </Link>
                이 필요하다.
              </p>
            ) : null}

            {isAuthenticated && !isOwner ? (
              <p className="mt-4 text-sm text-muted">
                이 세션의 오너만 픽커 지정, 후보 등록, 시작을 할 수 있다.
              </p>
            ) : null}

            {isOwner && !isReady ? (
              <p className="mt-4 text-sm text-muted">
                READY 상태가 아니므로 설정은 잠겨 있다.
              </p>
            ) : null}
          </SurfaceCard>

          <div className="grid gap-4 xl:grid-cols-2">
            {sortedTeams.map((team) => {
              const isAssigning = pendingAction === `picker:${team.id}`;

              return (
                <SurfaceCard key={team.id} className="p-5 sm:p-6">
                  <div className="flex flex-wrap items-center gap-2">
                    <ValueBadge>{team.displayOrder}팀</ValueBadge>
                    <h2 className="text-lg font-semibold text-foreground">
                      {team.teamName}
                    </h2>
                  </div>
                  <p className="mt-3 text-sm leading-7 text-muted">
                    현재 픽커:{" "}
                    {team.pickerName
                      ? `${team.pickerName} (#${team.pickerUserId})`
                      : "미지정"}
                  </p>

                  <div className="mt-5 space-y-3">
                    <RpsDraftUserSearch
                      label="픽커 검색"
                      description="READY 상태에서만 지정 가능하다."
                      selectedUser={selectedPickers[team.id] ?? null}
                      onSelect={(nextUser) => {
                        setSelectedPickers((current) => ({
                          ...current,
                          [team.id]: nextUser,
                        }));
                      }}
                      disabled={!canManageReady || pendingAction !== null}
                    />
                    <Button
                      variant="outline"
                      fullWidth
                      disabled={!canManageReady || pendingAction !== null}
                      onClick={() => {
                        void handleAssignPicker(team.id);
                      }}
                    >
                      {isAssigning ? "지정 중..." : "이 팀 픽커 지정"}
                    </Button>
                  </div>
                </SurfaceCard>
              );
            })}
          </div>

          <SurfaceCard className="p-5 sm:p-6">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
              <div className="max-w-2xl">
                <h2 className="text-lg font-semibold text-foreground">후보 등록</h2>
                <p className="mt-2 text-sm leading-7 text-muted">
                  후보는 READY 상태에서만 추가할 수 있다. 이름을 비우면 백엔드가 유저명
                  또는 아이디로 보정한다.
                </p>
              </div>

              <div className="min-w-44">
                <Button
                  variant="accent"
                  fullWidth
                  disabled={!canManageReady || pendingAction !== null}
                  onClick={() => {
                    void handleRegisterCandidate();
                  }}
                >
                  {pendingAction === "candidate" ? "등록 중..." : "후보 등록"}
                </Button>
              </div>
            </div>

            <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(260px,0.8fr)]">
              <RpsDraftUserSearch
                label="후보 유저 검색"
                description="user_id나 이름으로 검색해서 후보를 선택한다."
                selectedUser={candidateUser}
                onSelect={(nextUser) => {
                  setCandidateUser(nextUser);
                  setCandidateRace(nextUser.race ?? "");
                }}
                disabled={!canManageReady || pendingAction !== null}
              />

              <div className="space-y-3 rounded-[22px] border border-line bg-surface px-4 py-4">
                <div>
                  <p className="text-sm font-semibold text-foreground">후보 옵션</p>
                  <p className="mt-1 text-xs leading-6 text-muted">
                    별칭은 선택사항이다. 종족도 비워 두면 백엔드 기본값을 따른다.
                  </p>
                </div>
                <Input
                  value={candidateName}
                  onChange={(event) => setCandidateName(event.target.value)}
                  placeholder="후보 표시 이름 (선택)"
                  disabled={!canManageReady || pendingAction !== null}
                />
                <label className="flex flex-col gap-2 text-sm text-foreground">
                  <span>종족</span>
                  <select
                    value={candidateRace}
                    onChange={(event) => setCandidateRace(event.target.value)}
                    disabled={!canManageReady || pendingAction !== null}
                    className="w-full rounded-2xl border border-line bg-surface-strong px-4 py-3 text-sm text-foreground outline-none transition-colors focus:border-accent-soft focus:bg-white disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {RACE_OPTIONS.map((option) => (
                      <option key={option.value || "auto"} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                {candidateUser ? (
                  <div className="rounded-2xl bg-surface-muted px-4 py-3 text-sm text-foreground">
                    선택된 후보: {candidateUser.name || candidateUser.userId} · #
                    {candidateUser.id}
                  </div>
                ) : null}
              </div>
            </div>
          </SurfaceCard>

          <SurfaceCard className="p-5 sm:p-6">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-foreground">후보 목록</h2>
                <p className="mt-2 text-sm leading-7 text-muted">
                  WAITING 후보가 실제 드래프트 대상이다. 시작 후에는 읽기 전용으로 본다.
                </p>
              </div>
              <ValueBadge>WAITING {waitingCandidates.length}명</ValueBadge>
            </div>

            {sortedCandidates.length === 0 ? (
              <div className="mt-5 rounded-[24px] border border-dashed border-line px-6 py-8 text-sm text-muted">
                등록된 후보가 없다.
              </div>
            ) : (
              <div className="mt-5 grid gap-3">
                {sortedCandidates.map((candidate) => (
                  <div
                    key={candidate.candidateUserId}
                    className="rounded-[22px] border border-line bg-surface-strong px-4 py-4"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-semibold text-foreground">
                            {candidate.candidateName}
                          </span>
                          <StatusBadge status={candidate.status} />
                          <ValueBadge>{formatRace(candidate.race)}</ValueBadge>
                        </div>
                        <p className="mt-2 text-xs leading-6 text-muted">
                          userPk #{candidate.candidateUserId}
                        </p>
                      </div>

                      <div className="text-xs leading-6 text-muted sm:text-right">
                        <p>
                          지명 팀:{" "}
                          {candidate.pickedRpsDraftTeamName ||
                            candidate.pickedRpsDraftTeamId ||
                            "미정"}
                        </p>
                        <p>지명 시각: {formatDateTime(candidate.pickedAt)}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SurfaceCard>
        </div>
      ) : null}
    </TabPageShell>
  );
}
