"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { RpsDraftUserSearch } from "@/components/rps-draft/rps-draft-user-search";
import { SurfaceCard } from "@/components/site/surface-card";
import { Button } from "@/components/ui/button";
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
import { canManageOwnedResource } from "@/lib/auth/roles";
import {
  rpsDraftListPath,
  rpsDraftLivePath,
  rpsDraftSessionPath,
} from "@/lib/rps-draft/routes";
import {
  formatRace,
  formatRelativePickNo,
  StatusBadge,
  ValueBadge,
} from "@/components/rps-draft/rps-draft-ui";

const secondaryLinkClassName =
  "inline-flex items-center justify-center rounded-full border border-line px-4 py-3 text-sm font-medium text-muted transition-colors hover:border-accent-soft hover:bg-surface-strong hover:text-foreground";

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

function describeSetupHelp(options: {
  canManageSession: boolean;
  isAuthenticated: boolean;
  isReady: boolean;
  needsFallbackSetup: boolean;
  teamCount: number;
  waitingCandidateCount: number;
}) {
  if (!options.isAuthenticated) {
    return "로그인 후 세션 설정을 계속할 수 있습니다.";
  }

  if (!options.canManageSession) {
    return "팀장과 후보 구성이 완료된 세션입니다. 진행 상황만 확인할 수 있습니다.";
  }

  if (!options.isReady) {
    return "이미 시작된 세션입니다. 진행 화면에서 계속 확인하세요.";
  }

  if (options.teamCount !== 2) {
    return "세션 팀 구성이 올바르지 않습니다. 다시 확인해 주세요.";
  }

  if (options.needsFallbackSetup) {
    return "이 세션은 생성 정보가 덜 들어와 있어 시작 전에 보정이 필요합니다.";
  }

  if (options.waitingCandidateCount === 0) {
    return "후보가 없습니다. 다시 확인해 주세요.";
  }

  return "생성 시점에 팀장과 후보가 모두 확정된 세션입니다. 확인 후 바로 시작하면 됩니다.";
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
      setActionMessage("팀장을 먼저 골라 주세요.");
      return;
    }

    setPendingAction(`picker:${teamId}`);
    setActionMessage(null);

    try {
      await assignRpsDraftPicker(sessionId, teamId, {
        pickerUserId: selectedPicker.id,
      });
      setSelectedPickers((current) => ({ ...current, [teamId]: null }));
      await refreshPage("팀장을 지정했습니다.");
    } catch (assignError) {
      setActionMessage(
        assignError instanceof Error
          ? assignError.message
          : "팀장을 지정하지 못했습니다.",
      );
    } finally {
      setPendingAction(null);
    }
  }

  async function handleRegisterCandidate() {
    if (!candidateUser) {
      setActionMessage("후보를 먼저 골라 주세요.");
      return;
    }

    setPendingAction("candidate");
    setActionMessage(null);

    try {
      await registerRpsDraftCandidate(sessionId, {
        candidateUserId: candidateUser.id,
      });
      setCandidateUser(null);
      await refreshPage("후보를 추가했습니다.");
    } catch (registerError) {
      setActionMessage(
        registerError instanceof Error
          ? registerError.message
          : "후보를 추가하지 못했습니다.",
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
      router.push(rpsDraftLivePath(sessionId));
    } catch (startError) {
      setActionMessage(
        startError instanceof Error
          ? startError.message
          : "세션을 시작하지 못했습니다.",
      );
      setPendingAction(null);
    }
  }

  const sortedTeams = sortTeams(session?.teams ?? []);
  const sortedCandidates = sortCandidates(candidates);
  const waitingCandidates = sortedCandidates.filter(
    (candidate) => candidate.status === "WAITING",
  );
  const canManageSession = canManageOwnedResource({
    ownerUserId: session?.ownerUserId,
    role: user?.role,
    userPk: user?.userPk,
  });
  const isReady = session?.status === "READY";
  const canManageReady = Boolean(canManageSession && isReady);
  const needsFallbackSetup =
    Boolean(isReady) &&
    (sortedTeams.some((team) => typeof team.pickerUserId !== "number") ||
      waitingCandidates.length === 0);
  const canStart =
    canManageReady &&
    sortedTeams.length === 2 &&
    sortedTeams.every((team) => typeof team.pickerUserId === "number") &&
    waitingCandidates.length > 0;
  const loginHref = buildLoginHref({
    redirectTo: rpsDraftSessionPath(sessionId),
  });
  const setupHelp = describeSetupHelp({
    canManageSession: Boolean(canManageSession),
    isAuthenticated,
    isReady: Boolean(isReady),
    needsFallbackSetup,
    teamCount: sortedTeams.length,
    waitingCandidateCount: waitingCandidates.length,
  });
  const candidateDisabledUserIds = [
    ...sortedTeams
      .map((team) => team.pickerUserId)
      .filter((value): value is number => typeof value === "number"),
    ...sortedCandidates.map((candidate) => candidate.candidateUserId),
  ];

  return (
    <div className="grid gap-4">
      <SurfaceCard className="p-6 sm:p-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-accent">
              Draft
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {session ? <StatusBadge status={session.status} /> : null}
              {session ? (
                <ValueBadge>{formatRelativePickNo(session.currentPickNo)}</ValueBadge>
              ) : null}
              {session ? (
                <ValueBadge>방장 {session.ownerName || "이름 없음"}</ValueBadge>
              ) : null}
            </div>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
              {session?.title ?? "팀배/컨텐츠 드래프트"}
            </h1>
            <p className="mt-4 text-base leading-8 text-muted">
              {setupHelp} 가위바위보 기반으로 선픽 순서를 정한 뒤 진행합니다.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link href={rpsDraftListPath()} className={secondaryLinkClassName}>
              목록
            </Link>
            <Link href={rpsDraftLivePath(sessionId)} className={secondaryLinkClassName}>
              진행 화면
            </Link>
            <Button
              variant="accent"
              disabled={pendingAction !== null || !canStart}
              onClick={() => {
                void handleStart();
              }}
            >
              {pendingAction === "start" ? "시작하는 중..." : "시작"}
            </Button>
          </div>
        </div>

        {!isAuthenticated && status !== "loading" ? (
          <p className="mt-5 text-sm text-muted">
            <Link href={loginHref} className="font-semibold text-accent">
              로그인
            </Link>
            하면 방장 설정을 계속할 수 있습니다.
          </p>
        ) : null}

        {actionMessage ? (
          <div className="mt-5 rounded-[24px] border border-line bg-surface-strong px-5 py-4">
            <p className="text-sm text-foreground">{actionMessage}</p>
          </div>
        ) : null}
      </SurfaceCard>

      {error ? (
        <SurfaceCard className="border-danger-ink/20 bg-danger-soft p-5">
          <p className="text-sm font-medium text-danger-ink">{error}</p>
        </SurfaceCard>
      ) : null}

      {loading ? (
        <div className="rounded-[24px] border border-dashed border-line px-6 py-10 text-sm text-muted">
          세션 정보를 불러오는 중입니다.
        </div>
      ) : session ? (
        <>
          {needsFallbackSetup ? (
            <SurfaceCard className="border-amber-300/40 bg-amber-100 p-5">
              <p className="text-sm font-medium text-amber-900">
                이 세션은 예전 흐름으로 만들어져 팀장 또는 후보 정보가 비어 있습니다.
                기본 경로는 생성 화면에서 팀장 2명과 후보를 모두 정하고 들어오는
                방식이며, 아래 보정 UI는 기존 세션을 살리기 위한 예외 처리입니다.
              </p>
            </SurfaceCard>
          ) : null}

          <div className="grid gap-4 lg:grid-cols-2">
            {sortedTeams.map((team) => {
              const isAssigning = pendingAction === `picker:${team.id}`;
              const needsPicker = typeof team.pickerUserId !== "number";

              return (
                <SurfaceCard key={team.id} className="p-5 sm:p-6">
                  <div className="flex flex-wrap items-center gap-2">
                    <ValueBadge>{team.displayOrder}팀</ValueBadge>
                    <h2 className="text-lg font-semibold text-foreground">
                      {team.teamName}
                    </h2>
                  </div>

                  <p className="mt-3 text-sm text-muted">
                    팀장 {team.pickerName || "지정 안 됨"}
                  </p>

                  {needsFallbackSetup ? (
                    needsPicker && canManageReady ? (
                      <div className="mt-5 space-y-3">
                        <RpsDraftUserSearch
                          label="팀장 검색"
                          description="기존 세션 보정을 위해 비어 있는 팀장만 지정합니다."
                          selectedUser={selectedPickers[team.id] ?? null}
                          onSelect={(nextUser) => {
                            setSelectedPickers((current) => ({
                              ...current,
                              [team.id]: nextUser,
                            }));
                          }}
                          disabled={!canManageReady || pendingAction !== null}
                          disabledUserIds={candidateDisabledUserIds}
                          disabledUserMessage="후보나 다른 팀장으로 이미 들어간 유저입니다."
                        />
                        <Button
                          variant="outline"
                          fullWidth
                          disabled={!canManageReady || pendingAction !== null}
                          onClick={() => {
                            void handleAssignPicker(team.id);
                          }}
                        >
                          {isAssigning ? "지정하는 중..." : "팀장 지정"}
                        </Button>
                      </div>
                    ) : (
                      <p className="mt-5 text-xs leading-6 text-muted">
                        생성 시점에 이미 확정된 팀장입니다.
                      </p>
                    )
                  ) : (
                    <p className="mt-5 text-xs leading-6 text-muted">
                      생성 화면에서 확정된 팀장 구성입니다.
                    </p>
                  )}
                </SurfaceCard>
              );
            })}
          </div>

          <SurfaceCard className="p-6 sm:p-8">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div className="max-w-2xl">
                <h2 className="text-xl font-semibold text-foreground">후보 목록</h2>
                <p className="mt-3 text-sm leading-7 text-muted">
                  {needsFallbackSetup
                    ? "기존 세션의 누락된 후보만 보정합니다. 새 세션은 생성 화면에서 후보를 모두 고르고 들어옵니다."
                    : "생성 화면에서 선택한 후보들입니다. 시작 전 후보 구성을 한 번 더 확인하세요."}
                </p>
              </div>
              <ValueBadge>대기 중 {waitingCandidates.length}명</ValueBadge>
            </div>

            {needsFallbackSetup && canManageReady ? (
              <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px]">
                <RpsDraftUserSearch
                  label="후보 검색"
                  description="기존 세션 보정을 위해 누락된 후보를 추가합니다."
                  selectedUser={candidateUser}
                  onSelect={(nextUser) => {
                    setCandidateUser(nextUser);
                  }}
                  disabled={!canManageReady || pendingAction !== null}
                  disabledUserIds={candidateDisabledUserIds}
                  disabledUserMessage="팀장이나 기존 후보와 중복되는 유저입니다."
                />

                <div className="rounded-[22px] border border-line bg-surface px-4 py-4">
                  <div className="space-y-3">
                    {candidateUser ? (
                      <div className="rounded-2xl bg-surface-muted px-4 py-3 text-sm text-foreground">
                        선택한 후보: {candidateUser.name || candidateUser.userId}
                      </div>
                    ) : (
                      <p className="text-xs leading-6 text-muted">
                        먼저 후보를 선택해 주세요.
                      </p>
                    )}

                    <Button
                      variant="accent"
                      fullWidth
                      disabled={!canManageReady || pendingAction !== null}
                      onClick={() => {
                        void handleRegisterCandidate();
                      }}
                    >
                      {pendingAction === "candidate" ? "추가하는 중..." : "후보 추가"}
                    </Button>
                  </div>
                </div>
              </div>
            ) : null}

            {sortedCandidates.length === 0 ? (
              <div className="mt-5 rounded-[24px] border border-dashed border-line px-6 py-8 text-sm text-muted">
                아직 등록된 후보가 없습니다.
              </div>
            ) : (
              <div className="mt-5 grid gap-3">
                {sortedCandidates.map((candidate) => (
                  <div
                    key={candidate.candidateUserId}
                    className="rounded-[22px] border border-line bg-surface-strong px-4 py-4"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-semibold text-foreground">
                            {candidate.candidateName}
                          </span>
                          <StatusBadge status={candidate.status} />
                          <ValueBadge>{formatRace(candidate.race)}</ValueBadge>
                        </div>
                        {candidate.pickedRpsDraftTeamName ? (
                          <p className="mt-2 text-xs leading-6 text-muted">
                            {candidate.pickedRpsDraftTeamName}에 배정됨
                          </p>
                        ) : null}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SurfaceCard>
        </>
      ) : null}
    </div>
  );
}
