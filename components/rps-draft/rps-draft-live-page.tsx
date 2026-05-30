"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import {
  formatChoice,
  formatDateTime,
  formatRelativePickNo,
  formatRoundResult,
  StatusBadge,
  ValueBadge,
} from "@/components/rps-draft/rps-draft-ui";
import { OverlayDialog } from "@/components/site/overlay-dialog";
import { SurfaceCard } from "@/components/site/surface-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createEntrySubmissionSession } from "@/lib/api/entry-submission";
import {
  getRpsDraftSnapshot,
  pickRpsDraftCandidate,
  submitRpsDraftChoice,
  type RpsChoice,
  type RpsDraftLivePermissions,
  type RpsDraftLiveSnapshot,
  type RpsDraftLiveTeam,
  type RpsDraftPick,
  type RpsDraftRosterItem,
  type RpsDraftUserSearchResult,
} from "@/lib/api/rps-draft";
import { buildLoginHref } from "@/lib/auth/auth-navigation";
import type { AuthUser } from "@/lib/auth/auth-types";
import { entrySubmissionSessionPath } from "@/lib/entry-submission/routes";
import { subscribeToRpsDraftSession } from "@/lib/rps-draft/live-events";
import { rpsDraftListPath, rpsDraftLivePath } from "@/lib/rps-draft/routes";
import { cn } from "@/lib/utils";

type NoticeTone = "info" | "danger" | "success";

type LiveState = {
  permissions: RpsDraftLivePermissions | null;
  snapshot: RpsDraftLiveSnapshot | null;
};

type LiveNotice = {
  message: string;
  tone: NoticeTone;
};

type EntryFromRpsFormState = {
  title: string;
  team1Captain: RpsDraftUserSearchResult;
  team2Captain: RpsDraftUserSearchResult;
  team1PlayerNamesText: string;
  team2PlayerNamesText: string;
  setCountText: string;
  setCountEdited: boolean;
};

const INITIAL_LIVE_STATE: LiveState = {
  permissions: null,
  snapshot: null,
};

const RPS_CHOICES: readonly { label: string; value: RpsChoice }[] = [
  { label: "가위", value: "SCISSORS" },
  { label: "바위", value: "ROCK" },
  { label: "보", value: "PAPER" },
];

const secondaryLinkClassName =
  "inline-flex items-center justify-center rounded-full border border-line-strong bg-white px-4 py-3 text-sm font-semibold text-muted transition-colors hover:border-accent hover:bg-accent-soft hover:text-accent-ink";

function buildNoticeClassName(tone: NoticeTone) {
  switch (tone) {
    case "danger":
      return "border-danger-ink/20 bg-danger-soft text-danger-ink";
    case "success":
      return "border-success-ink/20 bg-success-soft text-success-ink";
    default:
      return "border-accent/20 bg-accent-soft text-accent-ink";
  }
}

function sortTeams(teams: RpsDraftLiveTeam[]) {
  return [...teams].sort((left, right) => left.displayOrder - right.displayOrder);
}

function sortRoster(team: RpsDraftLiveTeam) {
  return [...team.roster].sort((left, right) => left.pickNo - right.pickNo);
}

function formatCandidateName(value: string | null | undefined) {
  return value?.trim() || "이름 확인 필요";
}

function parsePlayerNames(value: string) {
  return value
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean);
}

function findDuplicateName(names: readonly string[]) {
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

function countEntryPlayers(
  captain: RpsDraftUserSearchResult,
  playerNamesText: string,
) {
  return parsePlayerNames(playerNamesText).length + (captain ? 1 : 0);
}

function calculateEntrySetCount(form: EntryFromRpsFormState) {
  return Math.max(
    countEntryPlayers(form.team1Captain, form.team1PlayerNamesText),
    countEntryPlayers(form.team2Captain, form.team2PlayerNamesText),
    1,
  );
}

function withAutoEntrySetCount(
  form: EntryFromRpsFormState,
): EntryFromRpsFormState {
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

function rosterNamesText(team: RpsDraftLiveTeam) {
  return sortRoster(team)
    .map((item) => item.candidateName.trim())
    .filter(Boolean)
    .join(", ");
}

function toCaptainSearchResult(team: RpsDraftLiveTeam): RpsDraftUserSearchResult | null {
  if (typeof team.pickerUserId !== "number") {
    return null;
  }

  const userId = team.pickerUserLoginId?.trim() || team.teamName.trim();
  if (!userId) {
    return null;
  }

  return {
    id: team.pickerUserId,
    userId,
    tier: null,
    race: null,
  };
}

function buildEntryFormFromRpsSnapshot(
  snapshot: RpsDraftLiveSnapshot,
): EntryFromRpsFormState {
  const teams = sortTeams(snapshot.teams);
  const team1 = teams[0];
  const team2 = teams[1];
  if (!team1 || !team2) {
    throw new Error("두 팀 정보가 있어야 엔트리 제출을 만들 수 있습니다.");
  }

  const team1Captain = toCaptainSearchResult(team1);
  const team2Captain = toCaptainSearchResult(team2);
  if (!team1Captain || !team2Captain) {
    throw new Error("팀장 계정 정보를 확인할 수 없습니다.");
  }

  return withAutoEntrySetCount({
    title: `${snapshot.session.title} 엔트리`,
    team1Captain,
    team2Captain,
    team1PlayerNamesText: rosterNamesText(team1),
    team2PlayerNamesText: rosterNamesText(team2),
    setCountText: "",
    setCountEdited: false,
  });
}

function validateEntryFromRpsForm(form: EntryFromRpsFormState | null) {
  if (!form) {
    return "엔트리 제출 정보를 준비하지 못했습니다.";
  }

  const title = form.title.trim();
  const team1PlayerNames = parsePlayerNames(form.team1PlayerNamesText);
  const team2PlayerNames = parsePlayerNames(form.team2PlayerNamesText);
  const team1Duplicate = findDuplicateName(team1PlayerNames);
  const team2Duplicate = findDuplicateName(team2PlayerNames);
  const setCountText = form.setCountText.trim();

  if (!title) {
    return "제목을 입력해 주세요.";
  }
  if (form.team1Captain.id === form.team2Captain.id) {
    return "서로 다른 팀장이 필요합니다.";
  }
  if (team1PlayerNames.some((name) => name.toLocaleLowerCase("ko-KR") === form.team1Captain.userId.toLocaleLowerCase("ko-KR"))) {
    return "1팀 선수 목록에 팀장 아이디가 중복됐습니다.";
  }
  if (team2PlayerNames.some((name) => name.toLocaleLowerCase("ko-KR") === form.team2Captain.userId.toLocaleLowerCase("ko-KR"))) {
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

function findTeamById(teams: RpsDraftLiveTeam[], teamId: number | null | undefined) {
  if (typeof teamId !== "number") {
    return null;
  }

  return teams.find((team) => team.id === teamId) ?? null;
}

function findMyTeam(snapshot: RpsDraftLiveSnapshot, user: AuthUser | null) {
  if (!user) {
    return null;
  }

  return snapshot.teams.find((team) => team.pickerUserId === user.userPk) ?? null;
}

function derivePermissions(
  snapshot: RpsDraftLiveSnapshot,
  user: AuthUser | null,
): RpsDraftLivePermissions {
  const myTeam = findMyTeam(snapshot, user);
  const isOwner = Boolean(user && snapshot.session.ownerUserId === user.userPk);
  const myChoiceSubmitted =
    myTeam?.displayOrder === 1
      ? snapshot.rps.team1Submitted
      : myTeam?.displayOrder === 2
        ? snapshot.rps.team2Submitted
        : false;

  let myRole: RpsDraftLivePermissions["myRole"] = "VIEWER";

  if (isOwner && myTeam) {
    myRole = "OWNER_PICKER";
  } else if (isOwner) {
    myRole = "OWNER";
  } else if (myTeam) {
    myRole = "PICKER";
  }

  return {
    canControl: isOwner,
    canSubmitRps:
      snapshot.session.status === "RPS_PENDING" &&
      Boolean(myTeam) &&
      !myChoiceSubmitted,
    canPick:
      snapshot.session.status === "PICKING" &&
      Boolean(myTeam) &&
      snapshot.session.currentDraftTeamId === myTeam?.id,
    myTeamId: myTeam?.id ?? null,
    myRole,
  };
}

function describeTurn(snapshot: RpsDraftLiveSnapshot) {
  const currentTeam = findTeamById(
    snapshot.teams,
    snapshot.session.currentDraftTeamId,
  );
  const pendingTeam = findTeamById(
    snapshot.teams,
    snapshot.session.pendingDraftTeamId,
  );

  switch (snapshot.session.status) {
    case "RPS_PENDING":
      return "두 팀장이 가위바위보를 내는 중입니다.";
    case "PICKING":
      return currentTeam
        ? `${currentTeam.teamName} 지명 차례입니다.${
            pendingTeam ? ` 다음 차례는 ${pendingTeam.teamName}입니다.` : ""
          }`
        : "후보 지명 차례를 확인하는 중입니다.";
    case "FINISHED":
      return "모든 후보 지명이 끝났습니다.";
    default:
      return "현재 상태를 확인하는 중입니다.";
  }
}

function describePickHelp(options: {
  canPick: boolean;
  currentTeam: RpsDraftLiveTeam | null;
  status: string | null | undefined;
}) {
  if (options.status !== "PICKING") {
    return "가위바위보가 끝나면 여기에서 후보를 고릅니다.";
  }

  if (options.canPick) {
    return "지금은 내 팀 지명 차례입니다.";
  }

  if (options.currentTeam) {
    return `지금은 ${options.currentTeam.teamName} 지명 차례입니다.`;
  }

  return "후보 지명 순서를 확인하는 중입니다.";
}

function TeamPanel({
  myTeamId,
  sessionCurrentTeamId,
  sessionPendingTeamId,
  team,
}: {
  myTeamId: number | null;
  sessionCurrentTeamId: number | null;
  sessionPendingTeamId: number | null;
  team: RpsDraftLiveTeam;
}) {
  const isCurrent = sessionCurrentTeamId === team.id;
  const isPending = sessionPendingTeamId === team.id;
  const isMine = myTeamId === team.id;
  const roster = sortRoster(team);

  return (
    <SurfaceCard
      className={cn(
        "p-5 sm:p-6",
        isCurrent && "border-accent/30 bg-accent-soft/40",
        !isCurrent && isPending && "border-warning-ink/15 bg-warning-soft",
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <ValueBadge>{team.displayOrder}팀</ValueBadge>
        <h2 className="text-lg font-semibold text-foreground">{team.teamName}</h2>
        {isMine ? <ValueBadge>내 팀</ValueBadge> : null}
        {isCurrent ? <ValueBadge className="border-accent/20">현재 차례</ValueBadge> : null}
        {!isCurrent && isPending ? (
          <ValueBadge className="border-warning-ink/20 bg-warning-soft text-warning-ink">
            다음 차례
          </ValueBadge>
        ) : null}
      </div>

      <div className="mt-5 space-y-3">
        {roster.length === 0 ? (
          <div className="rounded-lg border border-dashed border-line px-4 py-5 text-sm text-muted">
            아직 뽑은 후보가 없습니다.
          </div>
        ) : (
          roster.map((item: RpsDraftRosterItem) => (
            <div
              key={`${team.id}-${item.pickNo}`}
              className="rounded-lg border border-line bg-surface-strong px-4 py-4"
            >
              <div className="flex flex-wrap items-center gap-2">
                <ValueBadge>{item.pickNo}번</ValueBadge>
                {item.roundNo ? <ValueBadge>{item.roundNo}라운드</ValueBadge> : null}
                <span className="text-sm font-semibold text-foreground">
                  {formatCandidateName(item.candidateName)}
                </span>
              </div>
              <p className="mt-2 text-xs leading-6 text-muted">
                {formatDateTime(item.pickedAt)}
              </p>
            </div>
          ))
        )}
      </div>
    </SurfaceCard>
  );
}

export function RpsDraftLivePage({ sessionId }: { sessionId: number }) {
  const router = useRouter();
  const { isAuthenticated, status, user } = useAuth();
  const [liveState, setLiveState] = useState(INITIAL_LIVE_STATE);
  const [loading, setLoading] = useState(true);
  const [bootstrapped, setBootstrapped] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [notice, setNotice] = useState<LiveNotice | null>(null);
  const [isEntryCreateOpen, setIsEntryCreateOpen] = useState(false);
  const [entryForm, setEntryForm] = useState<EntryFromRpsFormState | null>(null);
  const [entryCreateError, setEntryCreateError] = useState<string | null>(null);
  const [entryCreating, setEntryCreating] = useState(false);
  const backgroundRefreshInFlightRef = useRef(false);
  const lastBackgroundRefreshAtRef = useRef(0);

  const applySnapshot = useCallback(
    (nextSnapshot: RpsDraftLiveSnapshot) => {
      setLiveState(() => {
        const nextPermissions =
          nextSnapshot.permissions ?? derivePermissions(nextSnapshot, user);

        return {
          permissions: nextPermissions,
          snapshot: {
            ...nextSnapshot,
            permissions: nextPermissions,
          },
        };
      });
    },
    [user],
  );

  const refreshSnapshot = useCallback(
    async (options?: { background?: boolean; keepMessage?: boolean }) => {
      if (options?.background) {
        const now = Date.now();

        if (
          backgroundRefreshInFlightRef.current ||
          now - lastBackgroundRefreshAtRef.current < 1000
        ) {
          return;
        }

        backgroundRefreshInFlightRef.current = true;
        lastBackgroundRefreshAtRef.current = now;
      }

      if (!options?.background) {
        setLoading(true);
      }

      try {
        const nextSnapshot = await getRpsDraftSnapshot(sessionId);
        applySnapshot(nextSnapshot);
        setError(null);

        if (!options?.keepMessage) {
          setActionMessage(null);
        }

        setBootstrapped(true);
      } catch (refreshError) {
        if (!options?.background) {
          setError(
            refreshError instanceof Error
              ? refreshError.message
              : "드래프트 진행 화면을 불러오지 못했습니다.",
          );
        }
      } finally {
        if (options?.background) {
          backgroundRefreshInFlightRef.current = false;
        }

        if (!options?.background) {
          setLoading(false);
        }
      }
    },
    [applySnapshot, sessionId],
  );

  useEffect(() => {
    let cancelled = false;

    async function loadInitialSnapshot() {
      try {
        const nextSnapshot = await getRpsDraftSnapshot(sessionId);

        if (cancelled) {
          return;
        }

        applySnapshot(nextSnapshot);
        setError(null);
        setLoading(false);
        setBootstrapped(true);
      } catch (loadError) {
        if (cancelled) {
          return;
        }

        setError(
          loadError instanceof Error
            ? loadError.message
            : "드래프트 진행 화면을 불러오지 못했습니다.",
        );
        setLoading(false);
      }
    }

    void loadInitialSnapshot();

    return () => {
      cancelled = true;
    };
  }, [applySnapshot, sessionId]);

  useEffect(() => {
    if (!bootstrapped) {
      return;
    }

    const subscription = subscribeToRpsDraftSession({
      sessionId,
      onEvent: (event) => {
        if (event.snapshot) {
          applySnapshot(event.snapshot);
        }

        if (event.type === "RPS_RESOLVED" && event.roundResult === "DRAW") {
          setNotice({
            message: "무승부입니다. 다시 가위바위보를 냅니다.",
            tone: "info",
          });
        }
      },
      onStateChange: (nextState) => {
        if (nextState === "connected" && status === "authenticated") {
          void refreshSnapshot({
            background: true,
            keepMessage: true,
          });
        }
      },
      onError: () => {
        setNotice({
          message: "실시간 연결이 잠시 끊겼습니다. 화면을 다시 열면 최신 상태를 볼 수 있습니다.",
          tone: "danger",
        });
      },
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [applySnapshot, bootstrapped, refreshSnapshot, sessionId, status]);

  useEffect(() => {
    if (!bootstrapped) {
      return;
    }

    function handleVisibilityRefresh() {
      if (document.visibilityState !== "visible") {
        return;
      }

      void refreshSnapshot({
        background: true,
        keepMessage: true,
      });
    }

    window.addEventListener("focus", handleVisibilityRefresh);
    document.addEventListener("visibilitychange", handleVisibilityRefresh);

    return () => {
      window.removeEventListener("focus", handleVisibilityRefresh);
      document.removeEventListener("visibilitychange", handleVisibilityRefresh);
    };
  }, [bootstrapped, refreshSnapshot]);

  useEffect(() => {
    if (!notice) {
      return;
    }

    const timer = window.setTimeout(() => {
      setNotice(null);
    }, 5000);

    return () => {
      window.clearTimeout(timer);
    };
  }, [notice]);

  async function handleSubmitRps(choice: RpsChoice) {
    setPendingAction(`rps:${choice}`);
    setActionMessage(null);

    try {
      const nextSnapshot = await submitRpsDraftChoice(sessionId, { choice });
      applySnapshot(nextSnapshot);
      setActionMessage(`${formatChoice(choice)}를 냈습니다.`);
      setError(null);
    } catch (submitError) {
      setActionMessage(
        submitError instanceof Error
          ? submitError.message
          : "가위바위보를 제출하지 못했습니다.",
      );
    } finally {
      setPendingAction(null);
    }
  }

  async function handlePick(candidateId: number) {
    const pickedCandidate = liveState.snapshot?.availableCandidates.find(
      (candidate) => candidate.id === candidateId,
    );

    setPendingAction(`pick:${candidateId}`);
    setActionMessage(null);

    try {
      const nextSnapshot = await pickRpsDraftCandidate(sessionId, {
        candidateId,
      });
      applySnapshot(nextSnapshot);
      setActionMessage(
        pickedCandidate
          ? `${formatCandidateName(pickedCandidate.candidateName)} 후보를 선택했습니다.`
          : "후보를 선택했습니다.",
      );
      setError(null);
    } catch (pickError) {
      setActionMessage(
        pickError instanceof Error
          ? pickError.message
          : "후보를 선택하지 못했습니다.",
      );
    } finally {
      setPendingAction(null);
    }
  }

  function updateEntryForm(
    updater: (current: EntryFromRpsFormState) => EntryFromRpsFormState,
  ) {
    setEntryForm((current) => {
      if (!current) {
        return current;
      }
      return withAutoEntrySetCount(updater(current));
    });
  }

  function handleOpenEntryCreateDialog() {
    if (!snapshot) {
      return;
    }

    try {
      setEntryCreateError(null);
      setEntryForm(buildEntryFormFromRpsSnapshot(snapshot));
      setIsEntryCreateOpen(true);
    } catch (openError) {
      setNotice({
        message:
          openError instanceof Error
            ? openError.message
            : "엔트리 제출 정보를 준비하지 못했습니다.",
        tone: "danger",
      });
    }
  }

  function handleCloseEntryCreateDialog() {
    if (entryCreating) {
      return;
    }

    setIsEntryCreateOpen(false);
  }

  async function handleCreateEntrySession() {
    const currentEntryForm = entryForm;
    const validationMessage = validateEntryFromRpsForm(currentEntryForm);

    if (validationMessage) {
      setEntryCreateError(validationMessage);
      return;
    }
    if (!currentEntryForm) {
      return;
    }

    setEntryCreating(true);
    setEntryCreateError(null);

    try {
      const createdSnapshot = await createEntrySubmissionSession({
        title: currentEntryForm.title.trim(),
        team1CaptainUserId: currentEntryForm.team1Captain.id,
        team2CaptainUserId: currentEntryForm.team2Captain.id,
        team1PlayerNames: parsePlayerNames(currentEntryForm.team1PlayerNamesText),
        team2PlayerNames: parsePlayerNames(currentEntryForm.team2PlayerNamesText),
        setCount: Number(currentEntryForm.setCountText.trim()),
      });

      setIsEntryCreateOpen(false);
      setEntryForm(null);
      router.push(entrySubmissionSessionPath(createdSnapshot.session.id));
    } catch (createError) {
      setEntryCreateError(
        createError instanceof Error
          ? createError.message
          : "엔트리 제출을 생성하지 못했습니다.",
      );
    } finally {
      setEntryCreating(false);
    }
  }

  const snapshot = liveState.snapshot;
  const permissions = liveState.permissions;
  const sortedTeams = sortTeams(snapshot?.teams ?? []);
  const team1 = sortedTeams[0] ?? null;
  const team2 = sortedTeams[1] ?? null;
  const myTeamId = permissions?.myTeamId ?? null;
  const canSubmitRps = Boolean(permissions?.canSubmitRps);
  const canPick = Boolean(permissions?.canPick);
  const currentTeam = snapshot
    ? findTeamById(sortedTeams, snapshot.session.currentDraftTeamId)
    : null;
  const latestPick: RpsDraftPick | null = snapshot?.recentPicks[0] ?? null;
  const choicesRevealed = Boolean(
    snapshot?.rps.team1Choice && snapshot?.rps.team2Choice,
  );
  const canCreateEntryFromRps = Boolean(
    isAuthenticated &&
      snapshot?.session.status === "FINISHED" &&
      permissions?.canControl,
  );
  const loginHref = buildLoginHref({
    redirectTo: rpsDraftLivePath(sessionId),
  });

  return (
    <div className="grid gap-4">
      <SurfaceCard className="p-6 sm:p-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-accent">
              Draft
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {snapshot ? <StatusBadge status={snapshot.session.status} /> : null}
              {snapshot ? (
                <ValueBadge>{formatRelativePickNo(snapshot.session.currentPickNo)}</ValueBadge>
              ) : null}
            </div>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
              {snapshot?.session.title ?? "가위바위보 드래프트"}
            </h1>
            <p className="mt-4 text-base leading-8 text-muted">
              {snapshot ? describeTurn(snapshot) : "드래프트 진행 화면을 불러오는 중입니다."}
            </p>
            {latestPick ? (
              <p className="mt-3 text-sm text-muted">
                최근 선택: {latestPick.pickNo}번 {formatCandidateName(latestPick.candidateName)} · {latestPick.rpsDraftTeamName}
              </p>
            ) : null}
            {snapshot?.session.startedAt ? (
              <p className="mt-3 text-xs leading-6 text-muted">
                시작 {formatDateTime(snapshot.session.startedAt)}
                {snapshot.session.endedAt
                  ? ` · 종료 ${formatDateTime(snapshot.session.endedAt)}`
                  : ""}
              </p>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-2">
            {canCreateEntryFromRps ? (
              <Button variant="accent" onClick={handleOpenEntryCreateDialog}>
                엔트리 제출 이어서
              </Button>
            ) : null}
            <Link href={rpsDraftListPath()} className={secondaryLinkClassName}>
              목록
            </Link>
          </div>
        </div>

        {!isAuthenticated && status !== "loading" ? (
          <p className="mt-5 text-sm text-muted">
            <Link href={loginHref} className="font-semibold text-accent">
              로그인
            </Link>
            하면 팀장 권한으로 참여할 수 있습니다.
          </p>
        ) : null}

        {actionMessage ? (
          <div className="mt-5 rounded-lg border border-line bg-surface-strong px-5 py-4">
            <p className="text-sm text-foreground">{actionMessage}</p>
          </div>
        ) : null}
      </SurfaceCard>

      {notice ? (
        <SurfaceCard className={cn("p-5", buildNoticeClassName(notice.tone))}>
          <p className="text-sm font-medium">{notice.message}</p>
        </SurfaceCard>
      ) : null}

      {error ? (
        <SurfaceCard className="border-danger-ink/20 bg-danger-soft p-5">
          <p className="text-sm font-medium text-danger-ink">{error}</p>
          <div className="mt-4">
            <Button
              variant="outline"
              onClick={() => {
                void refreshSnapshot();
              }}
            >
              다시 불러오기
            </Button>
          </div>
        </SurfaceCard>
      ) : null}

      {loading ? (
        <div className="rounded-lg border border-dashed border-line px-6 py-10 text-sm text-muted">
          드래프트 진행 화면을 불러오는 중입니다.
        </div>
      ) : snapshot ? (
        <>
          <SurfaceCard className="p-6 sm:p-8">
            <div className="flex justify-end">
              {choicesRevealed ? (
                <ValueBadge>{formatRoundResult(snapshot.rps.result)}</ValueBadge>
              ) : null}
            </div>

            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              <div className="rounded-lg border border-line bg-surface-strong px-4 py-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-foreground">
                    {team1?.teamName ?? "1팀"}
                  </span>
                  <ValueBadge>
                    {snapshot.rps.team1Submitted ? "제출 완료" : "제출 대기"}
                  </ValueBadge>
                </div>
                {choicesRevealed ? (
                  <p className="mt-3 text-sm text-muted">
                    선택 {formatChoice(snapshot.rps.team1Choice)}
                  </p>
                ) : null}
              </div>

              <div className="rounded-lg border border-line bg-surface-strong px-4 py-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-foreground">
                    {team2?.teamName ?? "2팀"}
                  </span>
                  <ValueBadge>
                    {snapshot.rps.team2Submitted ? "제출 완료" : "제출 대기"}
                  </ValueBadge>
                </div>
                {choicesRevealed ? (
                  <p className="mt-3 text-sm text-muted">
                    선택 {formatChoice(snapshot.rps.team2Choice)}
                  </p>
                ) : null}
              </div>
            </div>

            <div className="mt-5 grid grid-cols-3 gap-3 sm:flex sm:flex-wrap">
              {RPS_CHOICES.map((choice) => {
                const actionKey = `rps:${choice.value}`;

                return (
                  <Button
                    key={choice.value}
                    variant={canSubmitRps ? "accent" : "outline"}
                    disabled={pendingAction !== null || !canSubmitRps}
                    className="h-20 min-w-0 rounded-lg px-3 py-0 text-base sm:h-24 sm:w-28"
                    title={choice.label}
                    aria-label={choice.label}
                    onClick={() => {
                      void handleSubmitRps(choice.value);
                    }}
                  >
                    {pendingAction === actionKey ? "제출 중" : choice.label}
                  </Button>
                );
              })}
            </div>
          </SurfaceCard>

          <SurfaceCard className="p-6 sm:p-8">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-xl font-semibold text-foreground">
                  지명 가능한 후보
                </h2>
                <p className="mt-3 text-sm leading-7 text-muted">
                  {describePickHelp({
                    canPick,
                    currentTeam,
                    status: snapshot.session.status,
                  })}
                </p>
              </div>
              <ValueBadge>남은 후보 {snapshot.availableCandidates.length}명</ValueBadge>
            </div>

            {snapshot.availableCandidates.length === 0 ? (
              <div className="mt-5 rounded-lg border border-dashed border-line px-6 py-8 text-sm text-muted">
                {snapshot.session.status === "FINISHED"
                  ? "모든 후보 선택이 끝났습니다."
                  : "지금 선택 가능한 후보가 없습니다."}
              </div>
            ) : (
              <div className="mt-5 grid gap-3">
                {snapshot.availableCandidates.map((candidate) => {
                  const actionKey = `pick:${candidate.id}`;

                  return (
                    <div
                      key={candidate.id}
                      className="rounded-lg border border-line bg-surface-strong px-4 py-4"
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex flex-wrap items-center gap-2">
                          <ValueBadge>{candidate.displayOrder}번</ValueBadge>
                          <span className="text-sm font-semibold text-foreground">
                            {formatCandidateName(candidate.candidateName)}
                          </span>
                        </div>

                        <Button
                          variant={canPick ? "accent" : "outline"}
                          disabled={pendingAction !== null || !canPick}
                          onClick={() => {
                            void handlePick(candidate.id);
                          }}
                        >
                          {pendingAction === actionKey ? "선택 중" : "선택"}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </SurfaceCard>

          <div className="grid gap-4 lg:grid-cols-2">
            {sortedTeams.map((team) => (
              <TeamPanel
                key={team.id}
                team={team}
                myTeamId={myTeamId}
                sessionCurrentTeamId={snapshot.session.currentDraftTeamId}
                sessionPendingTeamId={snapshot.session.pendingDraftTeamId}
              />
            ))}
          </div>
        </>
      ) : null}

      {entryForm ? (
        <OverlayDialog
          open={isEntryCreateOpen}
          onClose={handleCloseEntryCreateDialog}
          closeOnBackdropClick={false}
          closeOnEscape={false}
          title="엔트리 제출 생성"
          description="완료된 가위바위보 드래프트의 팀장과 지명 선수를 기준으로 세팅됩니다."
          panelClassName="max-w-[1120px] bg-white backdrop-blur-none"
        >
          <form
            className="grid gap-5"
            onSubmit={(event) => {
              event.preventDefault();
              void handleCreateEntrySession();
            }}
          >
            <div className="grid gap-5 lg:grid-cols-2">
              <div className="space-y-2">
                <p className="text-sm font-semibold text-foreground">제목</p>
                <Input
                  value={entryForm.title}
                  onChange={(event) => {
                    setEntryCreateError(null);
                    setEntryForm((current) =>
                      current ? { ...current, title: event.target.value } : current,
                    );
                  }}
                  placeholder="예: 드래프트 엔트리 제출"
                  disabled={entryCreating}
                />
              </div>

              <div className="space-y-2">
                <p className="text-sm font-semibold text-foreground">세트 수</p>
                <Input
                  value={entryForm.setCountText}
                  onChange={(event) => {
                    setEntryCreateError(null);
                    setEntryForm((current) =>
                      current
                        ? {
                            ...current,
                            setCountText: sanitizePositiveIntegerText(event.target.value),
                            setCountEdited: true,
                          }
                        : current,
                    );
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
                  disabled={entryCreating}
                />
              </div>
            </div>

            <div className="grid gap-5 lg:grid-cols-2">
              <SurfaceCard className="bg-surface-strong p-5 shadow-none">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-semibold text-foreground">1팀</h3>
                    <p className="mt-2 text-sm text-muted">
                      팀장 {entryForm.team1Captain.userId}
                    </p>
                  </div>
                  <ValueBadge>
                    팀장 포함 {countEntryPlayers(entryForm.team1Captain, entryForm.team1PlayerNamesText)}명
                  </ValueBadge>
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
                  className="mt-4 min-h-40 w-full resize-y rounded-lg border border-line-strong bg-white px-4 py-3 text-sm leading-7 text-foreground outline-none transition-colors placeholder:text-muted focus:border-accent"
                  placeholder="예: a, b, c"
                  disabled={entryCreating}
                />
              </SurfaceCard>

              <SurfaceCard className="bg-surface-strong p-5 shadow-none">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-semibold text-foreground">2팀</h3>
                    <p className="mt-2 text-sm text-muted">
                      팀장 {entryForm.team2Captain.userId}
                    </p>
                  </div>
                  <ValueBadge>
                    팀장 포함 {countEntryPlayers(entryForm.team2Captain, entryForm.team2PlayerNamesText)}명
                  </ValueBadge>
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
                  className="mt-4 min-h-40 w-full resize-y rounded-lg border border-line-strong bg-white px-4 py-3 text-sm leading-7 text-foreground outline-none transition-colors placeholder:text-muted focus:border-accent"
                  placeholder="예: e, f, g"
                  disabled={entryCreating}
                />
              </SurfaceCard>
            </div>

            <div className="space-y-3 border-t border-line/80 pt-4">
              {entryCreateError ? (
                <p className="text-sm text-danger-ink">{entryCreateError}</p>
              ) : null}

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
                <Button
                  type="button"
                  variant="outline"
                  disabled={entryCreating}
                  onClick={handleCloseEntryCreateDialog}
                >
                  취소
                </Button>
                <Button type="submit" variant="accent" disabled={entryCreating}>
                  {entryCreating ? "생성 중" : "생성하고 엔트리 화면 열기"}
                </Button>
              </div>
            </div>
          </form>
        </OverlayDialog>
      ) : null}
    </div>
  );
}
