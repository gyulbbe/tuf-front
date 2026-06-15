"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { OverlayDialog } from "@/components/site/overlay-dialog";
import { DuelTournamentBoard } from "@/components/tournament/duel-tournament-board";
import { TournamentScoreSubmissionPanel } from "@/components/tournament/tournament-score-submission-panel";
import { SurfaceCard } from "@/components/site/surface-card";
import { Button } from "@/components/ui/button";
import {
  getClanShareLogSummary,
  submitClanShareMatches,
  type ClanShareMatchResult,
  type ClanShareMatchPayload,
} from "@/lib/api/clan-share";
import {
  getTournament,
  listTournamentMatchScoreSubmissions,
  type TournamentMatchScoreSubmission,
  updateTournamentMatchParticipants,
} from "@/lib/api/tournament";
import type {
  Tournament,
  TournamentMatch,
  TournamentParticipant,
} from "@/lib/tournament/types";

type TournamentProgressPageProps = {
  mode?: "public" | "admin";
  tournamentId: string;
};

function getMatches(tournament: Tournament | null) {
  return tournament?.groups.flatMap((group) => group.matches) ?? [];
}

function isSpecialTournament(tournament: Tournament) {
  return (
    tournament.bracketType === "ULTIMATE_BATTLE" ||
    tournament.bracketType === "RACE_SURVIVAL"
  );
}

function canPromptClanShare(tournament: Tournament) {
  return (
    tournament.bracketType === "SINGLE_ELIMINATION" ||
    tournament.bracketType === "DUAL_GROUP" ||
    tournament.bracketType === "ULTIMATE_BATTLE" ||
    tournament.bracketType === "RACE_SURVIVAL"
  );
}

function getClanShareMatchType(
  tournament: Tournament,
): ClanShareMatchPayload["matchType"] | null {
  switch (tournament.bracketType) {
    case "SINGLE_ELIMINATION":
    case "DUAL_GROUP":
      return "개인리그";
    case "ULTIMATE_BATTLE":
      return "끝장전";
    case "RACE_SURVIVAL":
      return "종족 최강전";
    default:
      return null;
  }
}

function getKoreaDate() {
  return new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Asia/Seoul",
    year: "numeric",
  }).format(new Date());
}

function getMatchSlot(match: TournamentMatch, slotNo: 1 | 2) {
  return (
    match.slots.find((slot) => slot.slotNo === slotNo) ??
    match.slots[slotNo - 1] ??
    null
  );
}

function buildClanShareMatches(tournament: Tournament) {
  const matchType = getClanShareMatchType(tournament);

  if (!matchType) {
    return [];
  }

  const playedDate = getKoreaDate();
  const matchName = tournament.title.trim() || "이름 없는 토너먼트";

  return getMatches(tournament)
    .map((match): ClanShareMatchPayload | null => {
      if (match.status !== "FINISHED") {
        return null;
      }

      const slot1 = getMatchSlot(match, 1);
      const slot2 = getMatchSlot(match, 2);

      if (
        !slot1?.participant ||
        !slot2?.participant ||
        slot1.isBye ||
        slot2.isBye
      ) {
        return null;
      }

      const winnerSlot = [slot1, slot2].find(
        (slot) => slot.isWinner && slot.participant,
      );

      if (!winnerSlot?.participant) {
        return null;
      }

      const loserSlot = winnerSlot.slotNo === slot1.slotNo ? slot2 : slot1;

      if (!loserSlot.participant) {
        return null;
      }

      return {
        tournamentId: tournament.id,
        matchId: match.id,
        player1: slot1.participant.displayName,
        player2: slot2.participant.displayName,
        winner: winnerSlot.participant.displayName,
        loser: loserSlot.participant.displayName,
        map: match.mapName ?? "",
        matchType,
        matchName,
        playedDate,
      };
    })
    .filter((match): match is ClanShareMatchPayload => match !== null);
}

export function TournamentProgressPage({
  mode = "admin",
  tournamentId,
}: TournamentProgressPageProps) {
  const isAdminMode = mode === "admin";
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pendingApprovalMatchIds, setPendingApprovalMatchIds] = useState<
    Set<string>
  >(() => new Set());
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null);
  const previousTournamentRef = useRef<{
    id: string;
    status: Tournament["status"];
  } | null>(null);
  const promptedTournamentIdsRef = useRef<Set<string>>(new Set());
  const [clanShareDialogOpen, setClanShareDialogOpen] = useState(false);
  const [clanShareHistoryChecking, setClanShareHistoryChecking] = useState(false);
  const [clanShareHistoryCheckFailed, setClanShareHistoryCheckFailed] =
    useState(false);
  const [clanShareHasHistory, setClanShareHasHistory] = useState(false);
  const [clanShareSending, setClanShareSending] = useState(false);
  const [clanShareSuccess, setClanShareSuccess] = useState(false);
  const [clanShareError, setClanShareError] = useState<string | null>(null);
  const [clanShareResultMessage, setClanShareResultMessage] = useState<
    string | null
  >(null);
  const [clanShareHasFailure, setClanShareHasFailure] = useState(false);
  const [clanShareResults, setClanShareResults] = useState<
    ClanShareMatchResult[]
  >([]);
  const matches = useMemo(() => getMatches(tournament), [tournament]);
  const matchIdsKey = useMemo(
    () => matches.map((match) => match.id).join("|"),
    [matches],
  );
  const selectedMatch =
    matches.find((match) => match.id === selectedMatchId) ?? null;
  const canManuallyOpenClanShare =
    isAdminMode &&
    tournament?.status === "FINISHED" &&
    canPromptClanShare(tournament);
  const clanShareSuccessResults = clanShareResults.filter(
    (result) => result.eloOk,
  );
  const clanShareFailureResults = clanShareResults.filter(
    (result) => !result.eloOk,
  );
  const clanShareSheetFailures = clanShareResults.filter(
    (result) => !result.sheetOk,
  );
  const clanShareLogFailures = clanShareResults.filter(
    (result) => !result.logOk,
  );
  const clanShareDialogTitle = clanShareHistoryCheckFailed
    ? "연동 이력 확인 실패"
    : clanShareHasHistory
      ? "이미 연동한 이력이 있습니다"
      : "ELO와 시트에 반영하시겠습니까?";
  const clanShareDialogDescription = clanShareHistoryCheckFailed
    ? "전송 이력 확인에 실패해 연동을 시작하지 않았습니다."
    : clanShareHasHistory
      ? "계속 진행하면 완료된 모든 경기 결과를 다시 전송합니다."
      : "완료된 경기 결과를 ELO API와 Google Sheet에 전송합니다.";
  const handleSubmissionsChange = useCallback((
    matchId: string,
    submissions: TournamentMatchScoreSubmission[],
  ) => {
    if (!isAdminMode) {
      return;
    }

    const hasPending = submissions.some(
      (submission) => submission.status === "PENDING",
    );

    setPendingApprovalMatchIds((current) => {
      const next = new Set(current);

      if (hasPending) {
        next.add(matchId);
      } else {
        next.delete(matchId);
      }

      return next;
    });
  }, [isAdminMode]);

  function closeClanShareDialog() {
    if (clanShareSending) {
      return;
    }

    setClanShareDialogOpen(false);
    setClanShareHistoryCheckFailed(false);
    setClanShareHasHistory(false);
    setClanShareSuccess(false);
    setClanShareError(null);
    setClanShareResultMessage(null);
    setClanShareHasFailure(false);
    setClanShareResults([]);
  }

  async function openClanShareDialog() {
    if (clanShareSending || clanShareHistoryChecking || !tournament) {
      return;
    }

    setClanShareHistoryChecking(true);
    setClanShareHistoryCheckFailed(false);
    setClanShareHasHistory(false);
    setClanShareSuccess(false);
    setClanShareError(null);
    setClanShareResultMessage(null);
    setClanShareHasFailure(false);
    setClanShareResults([]);

    try {
      const summary = await getClanShareLogSummary(tournament.id);

      setClanShareHasHistory(summary.hasHistory);
      setClanShareDialogOpen(true);
    } catch (error) {
      setClanShareHistoryCheckFailed(true);
      setClanShareError(
        error instanceof Error
          ? error.message
          : "ELO/시트 연동 이력을 확인하지 못했습니다.",
      );
      setClanShareDialogOpen(true);
    } finally {
      setClanShareHistoryChecking(false);
    }
  }

  async function submitClanShare() {
    if (clanShareSending || !tournament) {
      return;
    }

    setClanShareSending(true);
    setClanShareSuccess(false);
    setClanShareError(null);
    setClanShareResultMessage(null);
    setClanShareHasFailure(false);
    setClanShareResults([]);

    try {
      const result = await submitClanShareMatches(buildClanShareMatches(tournament));

      setClanShareResultMessage(
        [
          `ELO 전송 결과: 성공 ${result.successCount}건, 실패 ${result.failureCount}건.`,
          result.sheetFailureCount > 0
            ? `시트 기록 실패 ${result.sheetFailureCount}건.`
            : null,
          result.logFailureCount > 0
            ? `DB 로그 저장 실패 ${result.logFailureCount}건.`
            : null,
        ]
          .filter(Boolean)
          .join(" "),
      );
      setClanShareHasFailure(
        result.failureCount > 0 ||
          result.sheetFailureCount > 0 ||
          result.logFailureCount > 0,
      );
      setClanShareResults(result.results);
      setClanShareSuccess(true);
    } catch (error) {
      setClanShareError(
        error instanceof Error
          ? error.message
          : "clan-share 전송에 실패했습니다.",
      );
    } finally {
      setClanShareSending(false);
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function loadTournament() {
      setLoading(true);
      setLoadError(null);

      try {
        const nextTournament = await getTournament(tournamentId);

        if (!cancelled) {
          setTournament(nextTournament);
          setPendingApprovalMatchIds(new Set());
          setSelectedMatchId(null);
        }
      } catch (error) {
        if (!cancelled) {
          setTournament(null);
          setPendingApprovalMatchIds(new Set());
          setLoadError(
            error instanceof Error
              ? error.message
              : "토너먼트 정보를 불러오지 못했습니다.",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadTournament();

    return () => {
      cancelled = true;
    };
  }, [tournamentId]);

  useEffect(() => {
    if (!isAdminMode) {
      return;
    }

    if (!tournament) {
      previousTournamentRef.current = null;
      return;
    }

    const previousTournament = previousTournamentRef.current;
    previousTournamentRef.current = {
      id: tournament.id,
      status: tournament.status,
    };

    if (
      previousTournament?.id === tournament.id &&
      previousTournament.status === "LIVE" &&
      tournament.status === "FINISHED" &&
      canPromptClanShare(tournament) &&
      !promptedTournamentIdsRef.current.has(tournament.id)
    ) {
      promptedTournamentIdsRef.current.add(tournament.id);
      void openClanShareDialog();
    }
  }, [isAdminMode, tournament]);

  useEffect(() => {
    if (!isAdminMode || !tournament) {
      setPendingApprovalMatchIds(new Set());
      return;
    }

    let cancelled = false;

    async function loadPendingApprovalMatches() {
      const nextPendingIds = new Set<string>();
      const matchIds = matchIdsKey ? matchIdsKey.split("|") : [];

      await Promise.all(
        matchIds.map(async (matchId) => {
          try {
            const submissions = await listTournamentMatchScoreSubmissions(
              tournamentId,
              matchId,
            );

            if (submissions.some((submission) => submission.status === "PENDING")) {
              nextPendingIds.add(matchId);
            }
          } catch {
            // Keep the board usable even if one match submission lookup fails.
          }
        }),
      );

      if (!cancelled) {
        setPendingApprovalMatchIds(nextPendingIds);
      }
    }

    void loadPendingApprovalMatches();

    return () => {
      cancelled = true;
    };
  }, [isAdminMode, matchIdsKey, tournament?.id, tournamentId]);

  return (
    <div className="relative left-1/2 w-[calc(100vw-1.25rem)] max-w-[1600px] -translate-x-1/2 space-y-4 sm:w-[calc(100vw-2rem)]">
      <SurfaceCard className="p-5 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">
              {isAdminMode ? "Admin Tournament" : "Tournament"}
            </p>
            <h1 className="mt-2 text-2xl font-semibold text-foreground sm:text-3xl">
              {tournament?.title ?? "토너먼트 진행 관리"}
            </h1>
          </div>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center lg:justify-end">
            {isAdminMode ? (
              <Link
                href={`/tournament/${tournamentId}`}
                className="inline-flex items-center justify-center rounded-full border border-line-strong bg-white px-5 py-3 text-sm font-semibold text-muted transition-colors hover:border-accent hover:bg-accent-soft hover:text-accent-ink"
              >
                시청자 화면
              </Link>
            ) : null}
            {canManuallyOpenClanShare ? (
              <Button
                disabled={clanShareSending || clanShareHistoryChecking}
                onClick={() => {
                  void openClanShareDialog();
                }}
                variant="accent"
              >
                {clanShareHistoryChecking ? "이력 확인 중..." : "ELO/시트 연동"}
              </Button>
            ) : null}
          </div>
        </div>
      </SurfaceCard>

      {loading ? (
        <SurfaceCard className="px-6 py-12 text-center text-sm text-muted">
          토너먼트 정보를 불러오는 중입니다.
        </SurfaceCard>
      ) : null}

      {!loading && loadError ? (
        <SurfaceCard className="border-danger-ink/20 bg-danger-soft px-5 py-4">
          <p className="text-sm font-medium text-danger-ink">{loadError}</p>
        </SurfaceCard>
      ) : null}

      {!loading && !loadError && tournament ? (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px] xl:items-start">
          {tournament.bracketType === "RACE_SURVIVAL" ? (
            <RaceSurvivalProgressBoard
              onMatchSelect={(match: TournamentMatch) =>
                setSelectedMatchId(match.id)
              }
              onTournamentChange={setTournament}
              pendingApprovalMatchIds={
                isAdminMode ? pendingApprovalMatchIds : new Set<string>()
              }
              readOnly={!isAdminMode}
              selectedMatchId={selectedMatchId}
              tournament={tournament}
              tournamentId={tournamentId}
            />
          ) : isSpecialTournament(tournament) ? (
            <SpecialTournamentProgressBoard
              onMatchSelect={(match: TournamentMatch) =>
                setSelectedMatchId(match.id)
              }
              pendingApprovalMatchIds={
                isAdminMode ? pendingApprovalMatchIds : new Set<string>()
              }
              selectedMatchId={selectedMatchId}
              tournament={tournament}
            />
          ) : (
            <DuelTournamentBoard
              onMatchSelect={(match: TournamentMatch) =>
                setSelectedMatchId(match.id)
              }
              pendingApprovalMatchIds={
                isAdminMode ? pendingApprovalMatchIds : new Set<string>()
              }
              selectedMatchId={selectedMatchId}
              tournament={tournament}
            />
          )}

          <TournamentScoreSubmissionPanel
            key={selectedMatch?.id ?? "no-match"}
            mode={mode}
            selectedMatch={selectedMatch}
            tournament={tournament}
            tournamentId={tournamentId}
            onSubmissionsChange={handleSubmissionsChange}
            onTournamentChange={setTournament}
          />
        </div>
      ) : null}

      <OverlayDialog
        closeOnBackdropClick={!clanShareSending}
        closeOnEscape={!clanShareSending}
        description={clanShareDialogDescription}
        onClose={closeClanShareDialog}
        open={clanShareDialogOpen}
        title={clanShareDialogTitle}
      >
        <div className="space-y-4">
          <div className="rounded-lg border border-line bg-surface-strong px-4 py-4 text-sm leading-6 text-muted">
            <p className="font-semibold text-foreground">
              {clanShareHasHistory ? "완료 경기 재전송" : "완료 경기 전송"}
            </p>
            {clanShareHistoryCheckFailed ? (
              <p className="mt-2">
                연동 이력을 확인하지 못했습니다. 중복 전송을 막기 위해 전송을
                시작하지 않았습니다.
              </p>
            ) : clanShareHasHistory ? (
              <p className="mt-2">
                이미 연동한 이력이 있습니다. 계속 진행하면 현재 완료된 모든
                경기 결과를 다시 1건씩 ELO API와 시트에 전송합니다.
              </p>
            ) : (
              <p className="mt-2">
                예를 누르면 완료된 모든 경기 결과를 ELO API와 시트에 전송합니다.
                시트 H열에는 경기별 결과가 기록됩니다.
              </p>
            )}
          </div>

          {clanShareSuccess ? (
            <div
              className={
                clanShareHasFailure
                  ? "rounded-lg border border-warning-ink/20 bg-warning-soft px-4 py-3 text-sm font-semibold text-warning-ink"
                  : "rounded-lg border border-success-ink/20 bg-success-soft px-4 py-3 text-sm font-semibold text-success-ink"
              }
            >
              {clanShareResultMessage ?? "clan-share 전송이 완료되었습니다."}
            </div>
          ) : null}

          {clanShareSuccess && clanShareResults.length > 0 ? (
            <div className="space-y-3 rounded-lg border border-line bg-surface-strong px-4 py-4 text-sm">
              {clanShareSuccessResults.length > 0 ? (
                <div>
                  <p className="font-semibold text-success-ink">성공</p>
                  <ul className="mt-2 space-y-1 text-muted">
                    {clanShareSuccessResults.map((result) => (
                      <li key={`success-${result.matchId}`}>
                        {result.player1} vs {result.player2} 성공
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {clanShareFailureResults.length > 0 ? (
                <div>
                  <p className="font-semibold text-danger-ink">실패</p>
                  <ul className="mt-2 space-y-1 text-muted">
                    {clanShareFailureResults.map((result) => (
                      <li key={`failure-${result.matchId}`}>
                        {result.player1} vs {result.player2} 실패:{" "}
                        {result.eloMessage || "ELO 전송 실패"}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {clanShareSheetFailures.length > 0 ||
              clanShareLogFailures.length > 0 ? (
                <div>
                  <p className="font-semibold text-warning-ink">추가 경고</p>
                  <ul className="mt-2 space-y-1 text-muted">
                    {clanShareSheetFailures.map((result) => (
                      <li key={`sheet-${result.matchId}`}>
                        {result.player1} vs {result.player2} 시트 기록 실패:{" "}
                        {result.sheetMessage || "Google Sheets 기록 실패"}
                      </li>
                    ))}
                    {clanShareLogFailures.map((result) => (
                      <li key={`log-${result.matchId}`}>
                        {result.player1} vs {result.player2} DB 로그 저장 실패:{" "}
                        {result.logMessage || "DB 로그 저장 실패"}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : null}

          {clanShareError ? (
            <div className="rounded-lg border border-danger-ink/20 bg-danger-soft px-4 py-3 text-sm font-semibold text-danger-ink">
              {clanShareError}
            </div>
          ) : null}

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              disabled={clanShareSending}
              onClick={closeClanShareDialog}
              variant="outline"
            >
              {clanShareSuccess || clanShareHistoryCheckFailed ? "닫기" : "아니오"}
            </Button>
            {!clanShareSuccess && !clanShareHistoryCheckFailed ? (
              <Button
                disabled={clanShareSending}
                onClick={() => {
                  void submitClanShare();
                }}
                variant="accent"
              >
                {clanShareSending
                  ? "전송 중..."
                  : clanShareError
                    ? "다시 전송"
                    : clanShareHasHistory
                      ? "계속 진행"
                      : "예"}
              </Button>
            ) : null}
          </div>
        </div>
      </OverlayDialog>
    </div>
  );
}

const raceOrder = ["TERRAN", "ZERG", "PROTOSS"] as const;

function getRaceClassName(groupCode: string) {
  switch (groupCode) {
    case "TERRAN":
      return "text-sky-700";
    case "ZERG":
      return "text-amber-700";
    case "PROTOSS":
      return "text-emerald-700";
    default:
      return "text-foreground";
  }
}

function getSlotName(match: TournamentMatch, slotIndex: number) {
  return match.slots[slotIndex]?.participant?.displayName ?? "대기";
}

function getSlotSubText(match: TournamentMatch, slotIndex: number) {
  const slot = match.slots[slotIndex];
  const participant = slot?.participant;
  if (participant) {
    return participant.seedLabel ? `${participant.seedLabel}번` : "참가자";
  }

  return slot?.placeholderLabel ?? "자동 배정";
}

function getMatchScoreText(match: TournamentMatch) {
  const left = match.slots[0];
  const right = match.slots[1];
  const leftScore = left?.score ?? "-";
  const rightScore = right?.score ?? "-";

  return `${leftScore} : ${rightScore}`;
}

function getMatchWinnerText(match: TournamentMatch) {
  const winnerSlot = match.slots.find((slot) => slot.isWinner);

  return winnerSlot?.participant?.displayName ?? "미정";
}

function getMatchWinnerParticipant(match: TournamentMatch) {
  return match.slots.find((slot) => slot.isWinner)?.participant ?? null;
}

function getParticipantIdNumber(participantId: string | null | undefined) {
  if (!participantId) {
    return null;
  }
  const numericId = Number(participantId);
  return Number.isFinite(numericId) ? numericId : null;
}

function getStatusLabel(status: TournamentMatch["status"]) {
  switch (status) {
    case "READY":
      return "진행 가능";
    case "FINISHED":
      return "완료";
    case "CANCELLED":
      return "취소";
    case "PENDING":
    default:
      return "대기";
  }
}

function getStatusClassName(status: TournamentMatch["status"]) {
  switch (status) {
    case "READY":
      return "bg-accent text-white";
    case "FINISHED":
      return "bg-success-soft text-success-ink";
    case "CANCELLED":
      return "bg-danger-soft text-danger-ink";
    case "PENDING":
    default:
      return "bg-warning-soft text-warning-ink";
  }
}

export function RaceSurvivalProgressBoard({
  onMatchSelect,
  onTournamentChange,
  pendingApprovalMatchIds,
  readOnly = false,
  selectedMatchId,
  tournament,
  tournamentId,
}: {
  onMatchSelect?: (match: TournamentMatch) => void;
  onTournamentChange?: (tournament: Tournament) => void;
  pendingApprovalMatchIds?: ReadonlySet<string>;
  readOnly?: boolean;
  selectedMatchId?: string | null;
  tournament: Tournament;
  tournamentId?: string;
}) {
  const [assignmentError, setAssignmentError] = useState<string | null>(null);
  const [savingAssignmentMatchId, setSavingAssignmentMatchId] = useState<string | null>(null);
  const [slot1ParticipantId, setSlot1ParticipantId] = useState("");
  const [slot2ParticipantId, setSlot2ParticipantId] = useState("");
  const canEditTournament = !readOnly && Boolean(tournamentId && onTournamentChange);
  const matches = useMemo(
    () =>
      getMatches(tournament).sort((left, right) => {
        const leftOrder = left.displayOrder || Number.MAX_SAFE_INTEGER;
        const rightOrder = right.displayOrder || Number.MAX_SAFE_INTEGER;

        return leftOrder - rightOrder || left.id.localeCompare(right.id);
      }),
    [tournament],
  );
  const raceGroups = useMemo(
    () =>
      tournament.groups
        .filter((group) => raceOrder.includes(String(group.groupCode) as typeof raceOrder[number]))
        .sort((left, right) => {
          const leftOrder = raceOrder.indexOf(String(left.groupCode) as typeof raceOrder[number]);
          const rightOrder = raceOrder.indexOf(String(right.groupCode) as typeof raceOrder[number]);

          return leftOrder - rightOrder;
        }),
    [tournament],
  );
  const champion = tournament.groups
    .flatMap((group) => group.resultSlots)
    .find((slot) => slot.rankNo === 1)?.participant;
  const selectedMatch = matches.find((match) => match.id === selectedMatchId) ?? null;
  const participantRaceById = useMemo(() => {
    const next = new Map<string, string>();
    raceGroups.forEach((group) => {
      group.participants.forEach((participant) => {
        next.set(participant.id, String(group.groupCode));
      });
    });
    return next;
  }, [raceGroups]);
  const aliveParticipants = useMemo(
    () =>
      raceGroups.flatMap((group) =>
        group.participants
          .filter((participant) => participant.status !== "DROPPED")
          .map((participant) => ({
            participant,
            race: String(group.groupCode),
          })),
      ),
    [raceGroups],
  );
  const fixedWinnerParticipant = useMemo(() => {
    if (!selectedMatch || selectedMatch.displayOrder <= 1) {
      return null;
    }
    return (
      matches
        .filter(
          (match) =>
            match.id !== selectedMatch.id &&
            match.displayOrder < selectedMatch.displayOrder &&
            match.status === "FINISHED",
        )
        .sort((left, right) => right.displayOrder - left.displayOrder)
        .map(getMatchWinnerParticipant)
        .find((participant): participant is TournamentParticipant =>
          Boolean(participant),
        ) ?? null
    );
  }, [matches, selectedMatch]);
  const selectedMatchEditable =
    canEditTournament &&
    selectedMatch !== null &&
    selectedMatch.status !== "FINISHED" &&
    selectedMatch.status !== "CANCELLED";
  const slot1Race = slot1ParticipantId
    ? participantRaceById.get(slot1ParticipantId) ?? null
    : null;
  const slot2Options = aliveParticipants.filter(({ participant, race }) => {
    if (participant.id === slot1ParticipantId) {
      return false;
    }
    if (slot1Race && race === slot1Race) {
      return false;
    }
    return true;
  });
  const canSaveAssignment =
    selectedMatchEditable &&
    slot1ParticipantId !== "" &&
    slot2ParticipantId !== "" &&
    savingAssignmentMatchId !== selectedMatch?.id;

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!selectedMatch) {
      setSlot1ParticipantId("");
      setSlot2ParticipantId("");
      setAssignmentError(null);
      return;
    }

    const nextSlot1 = fixedWinnerParticipant?.id ?? selectedMatch.slots[0]?.participant?.id ?? "";
    const nextSlot2 = selectedMatch.slots[1]?.participant?.id ?? "";
    setSlot1ParticipantId(nextSlot1);
    setSlot2ParticipantId(nextSlot2);
    setAssignmentError(null);
  }, [fixedWinnerParticipant, selectedMatch]);
  /* eslint-enable react-hooks/set-state-in-effect */

  async function saveMatchParticipants() {
    if (!selectedMatch || !tournamentId || !onTournamentChange || !canSaveAssignment) {
      return;
    }

    setSavingAssignmentMatchId(selectedMatch.id);
    setAssignmentError(null);

    try {
      const nextTournament = await updateTournamentMatchParticipants(
        tournamentId,
        selectedMatch.id,
        {
          slot1ParticipantId: getParticipantIdNumber(slot1ParticipantId),
          slot2ParticipantId: getParticipantIdNumber(slot2ParticipantId),
        },
      );
      onTournamentChange(nextTournament);
    } catch (error) {
      setAssignmentError(
        error instanceof Error ? error.message : "경기 선수를 저장하지 못했습니다.",
      );
    } finally {
      setSavingAssignmentMatchId(null);
    }
  }

  return (
    <SurfaceCard className="space-y-5 p-5 sm:p-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">
            Race Survival
          </p>
          <h2 className="mt-2 text-xl font-semibold text-foreground">
            종족 최강전 진행
          </h2>
          <p className="mt-2 text-sm text-muted">
            출전 순서, 승패, 맵을 한 표에서 확인합니다.
          </p>
        </div>
        {champion ? (
          <span className="rounded-full bg-success-soft px-4 py-2 text-sm font-semibold text-success-ink">
            우승 {champion.displayName}
          </span>
        ) : null}
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        {raceGroups.map((group) => {
          const aliveCount = group.participants.filter(
            (participant) => participant.status !== "DROPPED",
          ).length;

          return (
            <div key={group.id} className="rounded-lg border border-line bg-surface-strong p-4">
              <div className="flex items-center justify-between gap-3">
                <p className={`text-sm font-semibold ${getRaceClassName(String(group.groupCode))}`}>
                  {group.groupCode}
                </p>
                <span className="rounded-full bg-surface px-3 py-1 text-xs font-semibold text-muted">
                  {aliveCount}명 생존
                </span>
              </div>
              <div className="mt-4 grid gap-2">
                {group.participants.map((participant, index) => {
                  const dropped = participant.status === "DROPPED";
                  return (
                    <div
                      key={participant.id}
                      className={[
                        "flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm",
                        dropped
                          ? "border-line bg-surface text-muted opacity-60"
                          : "border-accent/30 bg-accent-soft text-foreground",
                      ].join(" ")}
                    >
                      <span className={dropped ? "font-semibold line-through" : "font-semibold"}>
                        {index + 1}. {participant.displayName}
                      </span>
                      <span className="text-xs font-semibold">
                        {dropped ? "탈락" : "생존"}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {canEditTournament ? (
        <div className="rounded-lg border border-line bg-surface-strong p-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-foreground">
                경기 선수 지정
              </p>
              <p className="mt-1 text-xs leading-5 text-muted">
                대기/진행 가능 경기만 지정할 수 있습니다. 서로 다른 팀의 생존 선수만 선택됩니다.
              </p>
            </div>
            {selectedMatch ? (
              <span className="rounded-full bg-surface px-3 py-1 text-xs font-bold text-muted">
                {selectedMatch.displayName}
              </span>
            ) : null}
          </div>

          {!selectedMatch ? (
            <div className="mt-4 rounded-md border border-dashed border-line bg-surface px-4 py-5 text-sm text-muted">
              테이블에서 선수를 지정할 경기를 선택해주세요.
            </div>
          ) : !selectedMatchEditable ? (
            <div className="mt-4 rounded-md border border-line bg-surface px-4 py-5 text-sm text-muted">
              완료되었거나 취소된 경기는 선수 지정을 변경할 수 없습니다.
            </div>
          ) : (
            <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] lg:items-end">
              <label className="grid gap-2 text-sm font-semibold text-foreground">
                선수 A
                {fixedWinnerParticipant ? (
                  <div className="min-h-11 rounded-lg border border-line bg-surface px-4 py-3 text-sm text-muted">
                    {fixedWinnerParticipant.displayName} · 직전 경기 승자
                  </div>
                ) : (
                  <select
                    className="min-h-11 rounded-lg border border-line-strong bg-white px-4 text-sm text-foreground outline-none transition-colors focus:border-accent"
                    value={slot1ParticipantId}
                    onChange={(event) => {
                      const nextSlot1 = event.target.value;
                      const nextRace = participantRaceById.get(nextSlot1) ?? null;
                      const currentSlot2Race = participantRaceById.get(slot2ParticipantId) ?? null;
                      setSlot1ParticipantId(nextSlot1);
                      if (nextSlot1 === slot2ParticipantId || (nextRace && nextRace === currentSlot2Race)) {
                        setSlot2ParticipantId("");
                      }
                      setAssignmentError(null);
                    }}
                  >
                    <option value="">선수 선택</option>
                    {aliveParticipants.map(({ participant, race }) => (
                      <option key={participant.id} value={participant.id}>
                        {participant.displayName} · {race}
                      </option>
                    ))}
                  </select>
                )}
              </label>

              <label className="grid gap-2 text-sm font-semibold text-foreground">
                선수 B
                <select
                  className="min-h-11 rounded-lg border border-line-strong bg-white px-4 text-sm text-foreground outline-none transition-colors focus:border-accent"
                  value={slot2ParticipantId}
                  onChange={(event) => {
                    setSlot2ParticipantId(event.target.value);
                    setAssignmentError(null);
                  }}
                >
                  <option value="">선수 선택</option>
                  {slot2Options.map(({ participant, race }) => (
                    <option key={participant.id} value={participant.id}>
                      {participant.displayName} · {race}
                    </option>
                  ))}
                </select>
              </label>

              <button
                type="button"
                className="min-h-11 rounded-full bg-accent px-5 text-sm font-bold text-white transition-colors hover:bg-accent-ink disabled:cursor-not-allowed disabled:opacity-50"
                disabled={!canSaveAssignment}
                onClick={() => {
                  void saveMatchParticipants();
                }}
              >
                {savingAssignmentMatchId === selectedMatch.id ? "저장 중" : "선수 저장"}
              </button>
            </div>
          )}

          {assignmentError ? (
            <div className="mt-3 rounded-md border border-danger-ink/20 bg-danger-soft px-4 py-3 text-sm font-semibold text-danger-ink">
              {assignmentError}
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-lg border border-line bg-surface-strong">
        <table className="w-full min-w-[940px] border-collapse text-sm">
          <thead>
            <tr className="bg-surface text-left text-xs font-bold uppercase tracking-[0.08em] text-muted">
              <th className="px-4 py-3">순서</th>
              <th className="px-4 py-3">맵</th>
              <th className="px-4 py-3">선수 A</th>
              <th className="px-4 py-3">스코어</th>
              <th className="px-4 py-3">선수 B</th>
              <th className="px-4 py-3">승자</th>
              <th className="px-4 py-3">상태</th>
            </tr>
          </thead>
          <tbody>
            {matches.map((match, index) => {
              const isSelected = selectedMatchId === match.id;
              const hasPendingApproval = pendingApprovalMatchIds?.has(match.id) ?? false;
              const order = match.displayOrder || index + 1;

              return (
                <tr
                  key={match.id}
                  tabIndex={0}
                  className={[
                    "border-t border-line transition-colors hover:bg-accent-soft/70 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-accent",
                    onMatchSelect ? "cursor-pointer" : "",
                    isSelected ? "bg-accent-soft ring-2 ring-inset ring-accent/40" : "",
                  ].join(" ")}
                  onClick={() => onMatchSelect?.(match)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      onMatchSelect?.(match);
                    }
                  }}
                >
                  <td className="px-4 py-4 align-top">
                    <span className="inline-flex size-9 items-center justify-center rounded-full bg-surface text-sm font-bold text-accent-ink">
                      {order}
                    </span>
                  </td>
                  <td className="min-w-[220px] px-4 py-4 align-top">
                    <span
                      className={[
                        "inline-flex min-h-9 w-fit items-center rounded-full border px-3 text-xs font-bold",
                        match.mapName
                          ? "border-line-strong bg-white text-foreground"
                          : "border-warning-ink/20 bg-warning-soft text-warning-ink",
                      ].join(" ")}
                    >
                      {match.mapName ?? "맵 미정"}
                    </span>
                  </td>
                  <td className="px-4 py-4 align-top">
                    <div className="grid gap-1">
                      <strong className="text-foreground">{getSlotName(match, 0)}</strong>
                      <span className="text-xs font-semibold text-muted">
                        {getSlotSubText(match, 0)}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-4 align-top">
                    <span className="inline-flex min-h-8 min-w-16 items-center justify-center rounded-full bg-surface px-3 text-sm font-bold text-foreground">
                      {getMatchScoreText(match)}
                    </span>
                  </td>
                  <td className="px-4 py-4 align-top">
                    <div className="grid gap-1">
                      <strong className="text-foreground">{getSlotName(match, 1)}</strong>
                      <span className="text-xs font-semibold text-muted">
                        {getSlotSubText(match, 1)}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-4 align-top">
                    <span className="inline-flex min-h-8 items-center rounded-full bg-success-soft px-3 text-xs font-bold text-success-ink">
                      {getMatchWinnerText(match)}
                    </span>
                  </td>
                  <td className="px-4 py-4 align-top">
                    {hasPendingApproval ? (
                      <span className="inline-flex animate-pulse items-center rounded-full bg-yellow-300 px-3 py-1 text-xs font-bold text-yellow-950 shadow-[0_0_18px_rgba(250,204,21,0.95)] ring-2 ring-yellow-200">
                        승인 대기
                      </span>
                    ) : (
                      <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold ${getStatusClassName(match.status)}`}>
                        {getStatusLabel(match.status)}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {matches.length === 0 ? (
        <div className="rounded-lg border border-line bg-surface-strong px-4 py-8 text-center text-sm text-muted">
          생성된 경기가 없습니다.
        </div>
      ) : null}
    </SurfaceCard>
  );
}

function SpecialTournamentProgressBoard({
  onMatchSelect,
  pendingApprovalMatchIds,
  selectedMatchId,
  tournament,
}: {
  onMatchSelect: (match: TournamentMatch) => void;
  pendingApprovalMatchIds: Set<string>;
  selectedMatchId: string | null;
  tournament: Tournament;
}) {
  const matches = getMatches(tournament);
  const raceGroups = tournament.groups.filter((group) =>
    ["TERRAN", "ZERG", "PROTOSS"].includes(String(group.groupCode)),
  );
  const champion = tournament.groups
    .flatMap((group) => group.resultSlots)
    .find((slot) => slot.rankNo === 1)?.participant;

  return (
    <SurfaceCard className="space-y-5 p-5 sm:p-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">
            {tournament.bracketType === "ULTIMATE_BATTLE"
              ? "Ultimate Battle"
              : "Race Survival"}
          </p>
          <h2 className="mt-2 text-xl font-semibold text-foreground">
            {tournament.bracketType === "ULTIMATE_BATTLE"
              ? "끝장전 진행"
              : "종족 최강전 진행"}
          </h2>
        </div>
        {champion ? (
          <span className="rounded-full bg-success-soft px-4 py-2 text-sm font-semibold text-success-ink">
            우승 {champion.displayName}
          </span>
        ) : null}
      </div>

      {tournament.bracketType === "RACE_SURVIVAL" ? (
        <div className="grid gap-3 lg:grid-cols-3">
          {raceGroups.map((group) => (
            <div key={group.id} className="rounded-lg border border-line bg-surface-strong p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-foreground">
                  {group.groupCode}
                </p>
                <span className="rounded-full bg-surface px-3 py-1 text-xs font-semibold text-muted">
                  {group.participants.filter((participant) => participant.status !== "DROPPED").length}
                  명 생존
                </span>
              </div>
              <div className="mt-4 space-y-2">
                {group.participants.map((participant, index) => {
                  const dropped = participant.status === "DROPPED";
                  return (
                    <div
                      key={participant.id}
                      className={
                        dropped
                          ? "rounded-md border border-line bg-surface px-3 py-2 opacity-55"
                          : "rounded-md border border-accent/30 bg-accent-soft px-3 py-2"
                      }
                    >
                      <p className={dropped ? "text-sm font-semibold text-muted line-through" : "text-sm font-semibold text-foreground"}>
                        {index + 1}. {participant.displayName}
                      </p>
                      <p className="mt-1 text-xs text-muted">
                        {dropped ? "탈락" : "생존"}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      ) : null}

      <div className="space-y-3">
        {matches.map((match) => {
          const isSelected = selectedMatchId === match.id;
          const hasPendingApproval = pendingApprovalMatchIds.has(match.id);
          const [left, right] = match.slots;
          return (
            <button
              key={match.id}
              type="button"
              className={
                isSelected
                  ? "w-full rounded-lg border border-accent bg-accent-soft p-4 text-left ring-2 ring-accent/30"
                  : "w-full rounded-lg border border-line bg-surface-strong p-4 text-left transition-colors hover:border-accent hover:bg-accent-soft"
              }
              onClick={() => onMatchSelect(match)}
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm font-semibold text-foreground">
                  {match.displayName}
                </p>
                {hasPendingApproval ? (
                  <span className="animate-pulse rounded-full bg-yellow-300 px-3 py-1 text-xs font-bold text-yellow-950 shadow-[0_0_18px_rgba(250,204,21,0.95)] ring-2 ring-yellow-200">
                    승인 대기
                  </span>
                ) : (
                  <span className="rounded-full bg-surface px-3 py-1 text-xs font-semibold text-muted">
                    {match.status}
                  </span>
                )}
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {[left, right].map((slot, index) => (
                  <div
                    key={`${match.id}-${index}`}
                    className="rounded-md border border-line bg-surface px-3 py-2"
                  >
                    <p className="text-sm font-semibold text-foreground">
                      {slot?.participant?.displayName ?? "대기"}
                    </p>
                    <p className="mt-1 text-xs text-muted">
                      점수 {slot?.score ?? "-"}
                    </p>
                  </div>
                ))}
              </div>
            </button>
          );
        })}

        {matches.length === 0 ? (
          <div className="rounded-lg border border-line bg-surface-strong px-4 py-8 text-center text-sm text-muted">
            생성된 경기가 없습니다.
          </div>
        ) : null}
      </div>
    </SurfaceCard>
  );
}
