"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { RpsDraftUserSearch } from "@/components/rps-draft/rps-draft-user-search";
import { SurfaceCard } from "@/components/site/surface-card";
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

const RACE_OPTIONS = [
  { label: "자동", value: "" },
  { label: "저그", value: "ZERG" },
  { label: "테란", value: "TERRAN" },
  { label: "프로토스", value: "PROTOSS" },
  { label: "랜덤", value: "RANDOM" },
] as const;

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
  canManageReady: boolean;
  isAuthenticated: boolean;
  isOwner: boolean;
  isReady: boolean;
  waitingCandidateCount: number;
  teams: RpsDraftTeam[];
}) {
  if (!options.isAuthenticated) {
    return "로그인 후 세션 설정을 계속할 수 있습니다.";
  }

  if (!options.isOwner) {
    return "설정은 방장만 할 수 있습니다.";
  }

  if (!options.isReady) {
    return "이미 시작된 세션입니다. 진행 화면에서 계속 확인하세요.";
  }

  if (options.teams.some((team) => typeof team.pickerUserId !== "number")) {
    return "두 팀의 팀장을 먼저 정해 주세요.";
  }

  if (options.waitingCandidateCount === 0) {
    return "후보를 1명 이상 추가하면 시작할 수 있습니다.";
  }

  return "준비가 끝났습니다. 시작 버튼을 누르면 바로 진행됩니다.";
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
        candidateName: candidateName.trim() || undefined,
        race: candidateRace || undefined,
      });
      setCandidateUser(null);
      setCandidateName("");
      setCandidateRace("");
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
  const isOwner = session && user ? session.ownerUserId === user.userPk : false;
  const isReady = session?.status === "READY";
  const canManageReady = Boolean(isOwner && isReady);
  const canStart =
    canManageReady &&
    sortedTeams.length === 2 &&
    sortedTeams.every((team) => typeof team.pickerUserId === "number") &&
    waitingCandidates.length > 0;
  const loginHref = buildLoginHref({
    redirectTo: rpsDraftSessionPath(sessionId),
  });
  const setupHelp = describeSetupHelp({
    canManageReady,
    isAuthenticated,
    isOwner: Boolean(isOwner),
    isReady: Boolean(isReady),
    waitingCandidateCount: waitingCandidates.length,
    teams: sortedTeams,
  });

  return (
    <div className="grid gap-4">
      <SurfaceCard className="p-6 sm:p-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-accent">
              RPS Team Draft
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
              {session?.title ?? "가위바위보 팀 정하기"}
            </h1>
            <p className="mt-4 text-base leading-8 text-muted">{setupHelp}</p>
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
          <div className="grid gap-4 lg:grid-cols-2">
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

                  <p className="mt-3 text-sm text-muted">
                    팀장 {team.pickerName || "지정 안 됨"}
                  </p>

                  <div className="mt-5 space-y-3">
                    <RpsDraftUserSearch
                      label="팀장 검색"
                      description="방장만 바꿀 수 있습니다."
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
                      {isAssigning ? "지정하는 중..." : "팀장 지정"}
                    </Button>
                  </div>
                </SurfaceCard>
              );
            })}
          </div>

          <SurfaceCard className="p-6 sm:p-8">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="max-w-2xl">
                <h2 className="text-xl font-semibold text-foreground">후보 추가</h2>
                <p className="mt-3 text-sm leading-7 text-muted">
                  유저를 검색해서 후보에 넣습니다. 표시 이름과 종족은 필요할 때만 바꾸면 됩니다.
                </p>
              </div>

              <Button
                variant="accent"
                disabled={!canManageReady || pendingAction !== null}
                onClick={() => {
                  void handleRegisterCandidate();
                }}
              >
                {pendingAction === "candidate" ? "추가하는 중..." : "후보 추가"}
              </Button>
            </div>

            <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
              <RpsDraftUserSearch
                label="후보 검색"
                description="후보로 넣을 유저를 찾으세요."
                selectedUser={candidateUser}
                onSelect={(nextUser) => {
                  setCandidateUser(nextUser);
                  setCandidateRace(nextUser.race ?? "");
                }}
                disabled={!canManageReady || pendingAction !== null}
              />

              <div className="rounded-[22px] border border-line bg-surface px-4 py-4">
                <div className="space-y-3">
                  <Input
                    value={candidateName}
                    onChange={(event) => setCandidateName(event.target.value)}
                    placeholder="표시 이름 (선택)"
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
                      선택한 후보: {candidateUser.name || candidateUser.userId}
                    </div>
                  ) : (
                    <p className="text-xs leading-6 text-muted">
                      먼저 후보를 선택해 주세요.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </SurfaceCard>

          <SurfaceCard className="p-6 sm:p-8">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-xl font-semibold text-foreground">후보 목록</h2>
                <p className="mt-3 text-sm leading-7 text-muted">
                  시작 전에는 대기 중 후보만 모으면 됩니다.
                </p>
              </div>
              <ValueBadge>대기 중 {waitingCandidates.length}명</ValueBadge>
            </div>

            {sortedCandidates.length === 0 ? (
              <div className="mt-5 rounded-[24px] border border-dashed border-line px-6 py-8 text-sm text-muted">
                아직 추가한 후보가 없습니다.
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
