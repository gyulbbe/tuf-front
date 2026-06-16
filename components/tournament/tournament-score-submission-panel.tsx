"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { HomeScheduleMapSearch } from "@/components/admin/home-schedule-map-search";
import { SurfaceCard } from "@/components/site/surface-card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  approveTournamentMatchScoreSubmission,
  listTournamentMatchScoreSubmissions,
  rejectTournamentMatchScoreSubmission,
  submitTournamentMatchScore,
  type TournamentMatchScoreSubmission,
  type TournamentSubmitScoreRequest,
} from "@/lib/api/tournament";
import { isAdminRole } from "@/lib/auth/roles";
import type { HomeScheduleMapSearchResult } from "@/lib/api/home-schedule";
import {
  buildScorePresets,
  clampScorePresetIndex,
  getScoreButtonTargetIndex,
  type TournamentScorePreset,
} from "@/lib/tournament/score-presets";
import type {
  Tournament,
  TournamentMatch,
  TournamentMatchSlot,
} from "@/lib/tournament/types";
import { cn } from "@/lib/utils";

type TournamentScoreSubmissionPanelProps = {
  mode: "public" | "admin";
  selectedMatch: TournamentMatch | null;
  tournament: Tournament;
  tournamentId: string;
  onSubmissionsChange?: (
    matchId: string,
    submissions: TournamentMatchScoreSubmission[],
  ) => void;
  onApprovedMatchReadyForClanShare?: (
    matchId: string,
    tournament: Tournament,
  ) => void;
  onTournamentChange: (tournament: Tournament) => void;
};

type MatchMapSelection = {
  mapId: number | null;
  mapName: string;
};

type SetResultSelection = {
  winnerSlotNo: 1 | 2 | null;
  mapId: number | null;
  mapName: string;
};

type SetSubmissionDecision = {
  completed: boolean;
  winnerSlotNo: 1 | 2 | null;
  slot1Score: number;
  slot2Score: number;
  playedSets: Array<{
    setNo: number;
    winnerSlotNo: 1 | 2;
    mapId: number;
  }>;
  missingMap: boolean;
};

function isActualPlayableSlot(slot: TournamentMatchSlot) {
  return Boolean(slot.participant) && !slot.isBye;
}

function isScoreSubmittableMatch(match: TournamentMatch) {
  return (
    match.status === "READY" &&
    match.slots.length === 2 &&
    match.slots.every(isActualPlayableSlot)
  );
}

function hasByeSlot(match: TournamentMatch) {
  return match.slots.some((slot) => slot.isBye);
}

function findPresetIndex(match: TournamentMatch, presets: TournamentScorePreset[]) {
  const firstScore = match.slots[0]?.score;
  const secondScore = match.slots[1]?.score;

  if (typeof firstScore !== "number" || typeof secondScore !== "number") {
    return 0;
  }

  const presetIndex = presets.findIndex(
    ([left, right]) => left === firstScore && right === secondScore,
  );

  return presetIndex >= 0 ? presetIndex : 0;
}

function getWinnerSlot(match: TournamentMatch, preset: TournamentScorePreset) {
  return preset[0] > preset[1] ? match.slots[0] : match.slots[1];
}

function getConfirmedWinnerSlot(match: TournamentMatch) {
  const explicitWinner = match.slots.find((slot) => slot.isWinner);

  if (explicitWinner) {
    return explicitWinner;
  }

  const [firstSlot, secondSlot] = match.slots;

  if (
    typeof firstSlot?.score === "number" &&
    typeof secondSlot?.score === "number"
  ) {
    return firstSlot.score >= secondSlot.score ? firstSlot : secondSlot;
  }

  return null;
}

function formatScore(score: number | null | undefined) {
  return typeof score === "number" ? String(score) : "-";
}

function normalizeBestOfInput(value: number) {
  if (!Number.isFinite(value)) {
    return 3;
  }

  const rounded = Math.max(1, Math.round(value));
  return rounded % 2 === 1 ? rounded : rounded + 1;
}

function getRequiredWins(bestOf: number) {
  return Math.floor(bestOf / 2) + 1;
}

function isSetBasedBracket(tournament: Tournament) {
  return (
    tournament.bracketType === "SINGLE_ELIMINATION" ||
    tournament.bracketType === "DUAL_GROUP" ||
    tournament.bracketType === "ULTIMATE_BATTLE"
  );
}

function createEmptySetSelection(): SetResultSelection {
  return {
    winnerSlotNo: null,
    mapId: null,
    mapName: "",
  };
}

function getInitialSetSelection(match: TournamentMatch, setNo: number) {
  const setResult = match.setResults.find((item) => item.setNo === setNo);

  if (setResult) {
    return {
      winnerSlotNo: setResult.winnerSlotNo ?? null,
      mapId: setResult.mapId ?? null,
      mapName: setResult.mapName ?? "",
    };
  }

  return {
    winnerSlotNo: null,
    mapId: match.mapId,
    mapName: match.mapName ?? "",
  };
}

function getSetSubmissionDecision(
  bestOf: number,
  selections: SetResultSelection[],
  requireAllSets = false,
): SetSubmissionDecision {
  const requiredWins = getRequiredWins(bestOf);
  let slot1Score = 0;
  let slot2Score = 0;
  let missingMap = false;
  const playedSets: SetSubmissionDecision["playedSets"] = [];

  if (requireAllSets) {
    for (let index = 0; index < bestOf; index += 1) {
      const selection = selections[index] ?? createEmptySetSelection();

      if (!selection.mapId) {
        missingMap = true;
      }

      if (!selection.winnerSlotNo) {
        return {
          completed: false,
          winnerSlotNo: null,
          slot1Score,
          slot2Score,
          playedSets,
          missingMap,
        };
      }

      if (selection.winnerSlotNo === 1) {
        slot1Score += 1;
      } else {
        slot2Score += 1;
      }

      if (selection.mapId) {
        playedSets.push({
          setNo: index + 1,
          winnerSlotNo: selection.winnerSlotNo,
          mapId: selection.mapId,
        });
      }
    }

    return {
      completed: !missingMap && playedSets.length === bestOf && slot1Score !== slot2Score,
      winnerSlotNo: slot1Score > slot2Score ? 1 : 2,
      slot1Score,
      slot2Score,
      playedSets,
      missingMap,
    };
  }

  for (let index = 0; index < bestOf; index += 1) {
    const selection = selections[index] ?? createEmptySetSelection();

    if (!selection.winnerSlotNo) {
      break;
    }

    if (!selection.mapId) {
      missingMap = true;
    }

    if (selection.winnerSlotNo === 1) {
      slot1Score += 1;
    } else {
      slot2Score += 1;
    }

    if (selection.mapId) {
      playedSets.push({
        setNo: index + 1,
        winnerSlotNo: selection.winnerSlotNo,
        mapId: selection.mapId,
      });
    }

    if (slot1Score === requiredWins || slot2Score === requiredWins) {
      return {
        completed: !missingMap,
        winnerSlotNo: slot1Score > slot2Score ? 1 : 2,
        slot1Score,
        slot2Score,
        playedSets,
        missingMap,
      };
    }
  }

  return {
    completed: false,
    winnerSlotNo: null,
    slot1Score,
    slot2Score,
    playedSets,
    missingMap,
  };
}

function getSubmissionScores(submission: TournamentMatchScoreSubmission) {
  return `${submission.slot1Score}:${submission.slot2Score}`;
}

function getStatusLabel(status: TournamentMatchScoreSubmission["status"]) {
  switch (status) {
    case "APPROVED":
      return "승인됨";
    case "REJECTED":
      return "반려됨";
    case "PENDING":
    default:
      return "관리자 승인 대기";
  }
}

function getReadableSubmissionError(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : "";

  if (message.includes("Only READY matches can accept score submissions.")) {
    return "결과 입력 가능한 상태의 경기에서만 처리할 수 있습니다.";
  }

  if (message.includes("Only READY matches can reject score submissions.")) {
    return "결과 입력 가능한 경기에서만 반려할 수 있습니다.";
  }

  if (message.includes("Only READY matches can approve score submissions.")) {
    return "결과 입력 가능한 경기에서만 승인할 수 있습니다.";
  }

  if (message.includes("Finished tournament cannot approve score submissions.")) {
    return "이미 종료된 토너먼트의 결과는 승인할 수 없습니다.";
  }

  if (message.includes("Finished match result is already fixed.")) {
    return "이미 공식 결과가 확정된 경기입니다.";
  }

  return message || fallback;
}

function getSubmitterLabel(
  submission: TournamentMatchScoreSubmission,
  match: TournamentMatch,
) {
  const submitterLoginId =
    submission.submitterLoginId ?? submission.submitterDisplayName;

  if (submitterLoginId) {
    return `${submitterLoginId} 제출`;
  }

  if (submission.submitterRole === "ADMIN") {
    return "관리자 입력";
  }

  const participant = match.slots.find(
    (slot) => slot.participant?.id === submission.submittedByParticipantId,
  )?.participant;

  if (participant) {
    return participant.displayName;
  }

  return "참가자 제출";
}

function getSubmissionWinnerName(
  submission: TournamentMatchScoreSubmission,
  match: TournamentMatch,
) {
  const winnerSlot = match.slots.find(
    (slot) => slot.slotNo === submission.winnerSlotNo,
  );

  return winnerSlot?.participant?.displayName ?? "미정";
}

function isSingleEliminationMatch(match: TournamentMatch) {
  return (
    match.matchRole === "ROUND" ||
    match.matchRole === "FINAL" ||
    /^R\d+M\d+$/i.test(match.matchKey) ||
    match.matchKey.toUpperCase() === "FINAL"
  );
}

function getPanelMatchTitle(match: TournamentMatch) {
  return isSingleEliminationMatch(match)
    ? match.displayName
    : `${match.matchKey} · ${match.displayName}`;
}

function getTournamentParticipantIdsForUser(
  tournament: Tournament,
  userPk: number | undefined,
) {
  if (typeof userPk !== "number") {
    return [];
  }

  const currentUserId = String(userPk);
  const participantIds = new Set<string>();

  tournament.groups.forEach((group) => {
    group.participants.forEach((participant) => {
      if (participant.userId === currentUserId) {
        participantIds.add(participant.id);
      }
    });
  });

  return Array.from(participantIds);
}

function isSubmissionFromCurrentUser(
  submission: TournamentMatchScoreSubmission,
  tournamentParticipantIds: string[],
  userPk: number | undefined,
) {
  if (typeof userPk !== "number") {
    return false;
  }

  const currentUserId = String(userPk);

  return (
    submission.submittedByUserId === currentUserId ||
    tournamentParticipantIds.includes(submission.submittedByParticipantId ?? "")
  );
}

function ScoreStepper({
  disabled,
  match,
  preset,
  presetIndex,
  presets,
  onMoveScore,
}: {
  disabled: boolean;
  match: TournamentMatch;
  preset: TournamentScorePreset;
  presetIndex: number;
  presets: TournamentScorePreset[];
  onMoveScore: (playerIndex: number, scoreDelta: -1 | 1) => void;
}) {
  const winnerSlot = getWinnerSlot(match, preset);

  return (
    <div className="rounded-lg border border-line bg-surface-strong p-4">
      <p className="text-sm font-semibold text-foreground">점수 입력</p>
      <div className="mt-3 grid gap-2">
        {match.slots.map((slot, index) => {
          const participant = slot.participant;
          const score = preset[index];
          const minusTarget = getScoreButtonTargetIndex(index, -1, presetIndex);
          const plusTarget = getScoreButtonTargetIndex(index, 1, presetIndex);

          return (
            <div
              key={slot.slotNo}
              className={cn(
                "grid grid-cols-[minmax(0,1fr)_38px_34px_34px] items-center gap-2 rounded-md border px-3 py-2",
                winnerSlot?.slotNo === slot.slotNo
                  ? "border-accent/40 bg-accent-soft"
                  : "border-line bg-white",
              )}
            >
              <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-sm font-semibold text-foreground">
                {participant?.displayName ?? "미정"}
              </span>
              <span className="text-center text-lg font-black text-foreground">
                {score}
              </span>
              <Button
                size="sm"
                variant="outline"
                className="h-8 px-0"
                disabled={disabled || minusTarget < 0 || minusTarget >= presets.length}
                onClick={() => onMoveScore(index, -1)}
              >
                -
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-8 px-0"
                disabled={disabled || plusTarget < 0 || plusTarget >= presets.length}
                onClick={() => onMoveScore(index, 1)}
              >
                +
              </Button>
            </div>
          );
        })}
      </div>
      <div className="mt-3 rounded-lg border border-success-ink/20 bg-success-soft px-4 py-3 text-sm text-success-ink">
        현재 승자:{" "}
        <strong>{winnerSlot?.participant?.displayName ?? "미정"}</strong>
      </div>
    </div>
  );
}

function SetScoreEditor({
  bestOf,
  decision,
  disabled,
  match,
  requireAllSets = false,
  selections,
  onBestOfChange,
  onSetMapChange,
  onSetWinnerChange,
}: {
  bestOf: number;
  decision: SetSubmissionDecision;
  disabled: boolean;
  match: TournamentMatch;
  requireAllSets?: boolean;
  selections: SetResultSelection[];
  onBestOfChange: (bestOf: number) => void;
  onSetMapChange: (
    setIndex: number,
    map: HomeScheduleMapSearchResult | null,
  ) => void;
  onSetWinnerChange: (setIndex: number, winnerSlotNo: 1 | 2) => void;
}) {
  const winnerSlot = decision.winnerSlotNo
    ? match.slots.find((slot) => slot.slotNo === decision.winnerSlotNo)
    : null;
  const summary = winnerSlot
    ? `${winnerSlot.participant?.displayName ?? "미정"} ${decision.slot1Score}:${decision.slot2Score} 승`
    : `${decision.slot1Score}:${decision.slot2Score}`;
  let slot1WinsBefore = 0;
  let slot2WinsBefore = 0;
  const requiredWins = getRequiredWins(bestOf);

  return (
    <div className="rounded-lg border border-line bg-surface-strong p-4">
      <div className="grid gap-3">
        <div>
          <p className="text-sm font-semibold text-foreground">세트 결과</p>
          <p className="mt-1 text-xs leading-5 text-muted">{summary}</p>
        </div>
        <label className="grid gap-1 text-xs font-semibold text-muted">
          BO
          <input
            className="h-10 w-full rounded-md border border-line bg-white px-3 text-sm font-semibold text-foreground outline-none focus:border-accent"
            type="number"
            min={1}
            step={2}
            value={bestOf}
            disabled={disabled}
            onBlur={(event) => onBestOfChange(Number(event.target.value))}
            onChange={(event) => onBestOfChange(Number(event.target.value))}
          />
        </label>
      </div>

      <div className="mt-4 grid gap-3">
        {Array.from({ length: bestOf }, (_, index) => {
          const selection = selections[index] ?? createEmptySetSelection();
          const ignored =
            !requireAllSets &&
            (slot1WinsBefore >= requiredWins || slot2WinsBefore >= requiredWins);
          if (!ignored) {
            if (selection.winnerSlotNo === 1) {
              slot1WinsBefore += 1;
            } else if (selection.winnerSlotNo === 2) {
              slot2WinsBefore += 1;
            }
          }

          return (
            <div
              key={index}
              className={cn(
                "grid gap-2 rounded-md border p-3",
                ignored ? "border-line bg-surface-muted opacity-60" : "border-line bg-white",
              )}
            >
              <div className="grid gap-2 sm:grid-cols-[80px_minmax(0,1fr)_minmax(0,1fr)] sm:items-center">
                <span className="text-xs font-black uppercase tracking-[0.12em] text-muted">
                  {index + 1}세트
                </span>
                {match.slots.map((slot) => (
                  <Button
                    key={slot.slotNo}
                    size="sm"
                    variant={
                      selection.winnerSlotNo === slot.slotNo ? "accent" : "outline"
                    }
                    disabled={disabled || ignored}
                    onClick={() =>
                      onSetWinnerChange(index, slot.slotNo === 2 ? 2 : 1)
                    }
                  >
                    {slot.participant?.displayName ?? "미정"} 승
                  </Button>
                ))}
              </div>
              <HomeScheduleMapSearch
                disabled={disabled || ignored}
                mapName={selection.mapName}
                onClear={() => onSetMapChange(index, null)}
                onSelect={(map) => onSetMapChange(index, map)}
              />
            </div>
          );
        })}
      </div>
      {decision.missingMap ? (
        <p className="mt-3 text-xs leading-5 text-warning-ink">
          플레이한 세트의 맵을 모두 선택해야 합니다.
        </p>
      ) : requireAllSets && !decision.completed ? (
        <p className="mt-3 text-xs leading-5 text-warning-ink">
          끝장전은 모든 세트의 승자와 맵을 입력해야 합니다.
        </p>
      ) : !decision.completed ? (
        <p className="mt-3 text-xs leading-5 text-warning-ink">
          BO 승리 조건을 만족할 때까지 세트 승자를 선택해 주세요.
        </p>
      ) : null}
    </div>
  );
}

function SubmissionList({
  canAdmin,
  loading,
  match,
  pendingActionId,
  rejectingSubmissionId,
  rejectNote,
  submissions,
  onApprove,
  onCancelReject,
  onReject,
  onRejectNoteChange,
  onStartReject,
}: {
  canAdmin: boolean;
  loading: boolean;
  match: TournamentMatch;
  pendingActionId: string | null;
  rejectingSubmissionId: string | null;
  rejectNote: string;
  submissions: TournamentMatchScoreSubmission[];
  onApprove: (submission: TournamentMatchScoreSubmission) => void;
  onCancelReject: () => void;
  onReject: (submission: TournamentMatchScoreSubmission) => void;
  onRejectNoteChange: (note: string) => void;
  onStartReject: (submissionId: string) => void;
}) {
  return (
    <div className="rounded-lg border border-line bg-surface-strong p-4">
      <p className="text-sm font-semibold text-foreground">제출 내역</p>
      {loading ? (
        <p className="mt-3 text-sm text-muted">제출 내역을 불러오는 중입니다.</p>
      ) : submissions.length > 0 ? (
        <div className="mt-3 grid gap-2">
          {submissions.map((submission) => (
            <div
              key={submission.id}
              className="rounded-md border border-line bg-white p-3"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground">
                    {getSubmitterLabel(submission, match)}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-muted">
                    {getSubmissionScores(submission)} · 승자{" "}
                    {getSubmissionWinnerName(submission, match)} ·{" "}
                    {getStatusLabel(submission.status)}
                  </p>
                </div>
                <span
                  className={cn(
                    "rounded-full px-2.5 py-1 text-xs font-semibold",
                    submission.status === "PENDING"
                      ? "bg-warning-soft text-warning-ink"
                      : submission.status === "APPROVED"
                        ? "bg-success-soft text-success-ink"
                        : "bg-danger-soft text-danger-ink",
                  )}
                >
                  {getStatusLabel(submission.status)}
                </span>
              </div>

              {submission.adminNote ? (
                <p className="mt-2 rounded-md bg-surface-muted px-3 py-2 text-xs leading-5 text-muted">
                  {submission.adminNote}
                </p>
              ) : null}

              {canAdmin && submission.status === "PENDING" ? (
                <div className="mt-3 grid gap-2">
                  {rejectingSubmissionId === submission.id ? (
                    <>
                      <Textarea
                        rows={3}
                        value={rejectNote}
                        placeholder="반려 사유"
                        onChange={(event) =>
                          onRejectNoteChange(event.target.value)
                        }
                      />
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="danger"
                          disabled={pendingActionId === submission.id}
                          onClick={() => onReject(submission)}
                        >
                          반려
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={pendingActionId === submission.id}
                          onClick={onCancelReject}
                        >
                          취소
                        </Button>
                      </div>
                    </>
                  ) : (
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="accent"
                        disabled={pendingActionId === submission.id}
                        onClick={() => onApprove(submission)}
                      >
                        승인
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={pendingActionId === submission.id}
                        onClick={() => onStartReject(submission.id)}
                      >
                        반려 메모
                      </Button>
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-3 text-sm text-muted">제출 내역이 없습니다.</p>
      )}
    </div>
  );
}

export function TournamentScoreSubmissionPanel({
  mode,
  selectedMatch,
  tournament,
  tournamentId,
  onApprovedMatchReadyForClanShare,
  onSubmissionsChange,
  onTournamentChange,
}: TournamentScoreSubmissionPanelProps) {
  const { user } = useAuth();
  const [presetIndexByMatchId, setPresetIndexByMatchId] = useState<
    Record<string, number>
  >({});
  const [submissions, setSubmissions] = useState<
    TournamentMatchScoreSubmission[]
  >([]);
  const [selectedMap, setSelectedMap] = useState<MatchMapSelection>({
    mapId: null,
    mapName: "",
  });
  const [bestOfByMatchId, setBestOfByMatchId] = useState<Record<string, number>>(
    {},
  );
  const [setSelectionsByMatchId, setSetSelectionsByMatchId] = useState<
    Record<string, SetResultSelection[]>
  >({});
  const [loadingSubmissions, setLoadingSubmissions] = useState(false);
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [pendingActionId, setPendingActionId] = useState<string | null>(null);
  const [rejectingSubmissionId, setRejectingSubmissionId] = useState<
    string | null
  >(null);
  const [rejectNote, setRejectNote] = useState("");

  const isAdminMode = mode === "admin";
  const canAdmin = isAdminMode && isAdminRole(user?.role);
  const currentUserId =
    typeof user?.userPk === "number" ? String(user.userPk) : null;
  const tournamentParticipantIds = useMemo(
    () => getTournamentParticipantIdsForUser(tournament, user?.userPk),
    [tournament, user?.userPk],
  );
  const isTournamentParticipant = tournamentParticipantIds.length > 0;
  const isMatchParticipant = Boolean(
    selectedMatch?.slots.some(
      (slot) => slot.participant?.userId === currentUserId,
    ),
  );
  const canParticipantSubmit =
    tournament.bracketType === "RACE_SURVIVAL"
      ? isTournamentParticipant
      : isMatchParticipant;
  const canViewSubmissions = Boolean(
    selectedMatch && (canAdmin || canParticipantSubmit),
  );
  const canSubmitScore = Boolean(
    selectedMatch &&
      isScoreSubmittableMatch(selectedMatch) &&
      (canAdmin || canParticipantSubmit),
  );
  const visibleSubmissions =
    canAdmin || !selectedMatch
      ? submissions
      : submissions.filter((submission) =>
          isSubmissionFromCurrentUser(
            submission,
            tournamentParticipantIds,
            user?.userPk,
          ),
        );
  const myPendingSubmission = selectedMatch
    ? visibleSubmissions.find(
        (submission) =>
          submission.status === "PENDING" &&
          isSubmissionFromCurrentUser(
            submission,
            tournamentParticipantIds,
            user?.userPk,
          ),
      )
    : null;
  const hasPendingScoreSubmission = submissions.some(
    (submission) => submission.status === "PENDING",
  );
  const hasLockedScoreSubmission = submissions.some(
    (submission) =>
      submission.status === "PENDING" || submission.status === "APPROVED",
  );
  const mapSelectionDisabled =
    submitting ||
    loadingSubmissions ||
    hasLockedScoreSubmission ||
    Boolean(!canAdmin && myPendingSubmission);
  const usesSetEditor = Boolean(selectedMatch && isSetBasedBracket(tournament));
  const selectedBestOf = selectedMatch
    ? normalizeBestOfInput(
        bestOfByMatchId[selectedMatch.id] ?? selectedMatch.bestOf ?? 3,
      )
    : 3;
  const selectedSetSelections = selectedMatch
    ? setSelectionsByMatchId[selectedMatch.id] ??
      Array.from({ length: selectedBestOf }, (_, index) =>
        getInitialSetSelection(selectedMatch, index + 1),
      )
    : [];
  const selectedSetDecision = getSetSubmissionDecision(
    selectedBestOf,
    selectedSetSelections,
    tournament.bracketType === "ULTIMATE_BATTLE",
  );
  const canSubmitSelectedScore =
    canSubmitScore &&
    (usesSetEditor
      ? selectedSetDecision.completed &&
        !selectedSetDecision.missingMap &&
        selectedSetDecision.playedSets.length > 0
      : Boolean(selectedMap.mapId)) &&
    !loadingSubmissions &&
    !Boolean(!canAdmin && myPendingSubmission);
  const presets = useMemo(
    () =>
      buildScorePresets(
        selectedMatch?.bestOf ?? 3,
        tournament.bracketType === "ULTIMATE_BATTLE"
          ? "ULTIMATE_BATTLE"
          : "BEST_OF",
      ),
    [selectedMatch?.bestOf, tournament.bracketType],
  );
  const selectedPresetIndex = selectedMatch
    ? clampScorePresetIndex(
        presetIndexByMatchId[selectedMatch.id] ??
          findPresetIndex(selectedMatch, presets),
        presets,
      )
    : 0;
  const selectedPreset = presets[selectedPresetIndex] ?? presets[0] ?? [0, 0];

  useEffect(() => {
    setSelectedMap({
      mapId: selectedMatch?.mapId ?? null,
      mapName: selectedMatch?.mapName ?? "",
    });
    if (selectedMatch) {
      const nextBestOf = normalizeBestOfInput(selectedMatch.bestOf);
      setBestOfByMatchId((current) => ({
        ...current,
        [selectedMatch.id]: current[selectedMatch.id] ?? nextBestOf,
      }));
      setSetSelectionsByMatchId((current) => ({
        ...current,
        [selectedMatch.id]:
          current[selectedMatch.id] ??
          Array.from({ length: nextBestOf }, (_, index) =>
            getInitialSetSelection(selectedMatch, index + 1),
          ),
      }));
    }
    setSubmissionError(null);
  }, [selectedMatch]);

  useEffect(() => {
    setSubmissions([]);
    setRejectingSubmissionId(null);
    setRejectNote("");
  }, [selectedMatch?.id]);

  useEffect(() => {
    if (!selectedMatch || selectedMatch.status !== "READY") {
      setSubmissionError(null);
      setRejectingSubmissionId(null);
      setRejectNote("");
    }
  }, [selectedMatch?.id, selectedMatch?.status]);

  useEffect(() => {
    if (!selectedMatch || !canViewSubmissions) {
      return;
    }

    const match = selectedMatch;
    let cancelled = false;

    async function loadSubmissions() {
      setLoadingSubmissions(true);

      try {
        const nextSubmissions = await listTournamentMatchScoreSubmissions(
          tournamentId,
          match.id,
        );

        if (!cancelled) {
          setSubmissions(nextSubmissions);
          onSubmissionsChange?.(match.id, nextSubmissions);
        }
      } catch (error) {
        if (!cancelled) {
          setSubmissions([]);
          setSubmissionError(
            error instanceof Error
              ? error.message
              : "제출 내역을 불러오지 못했습니다.",
          );
        }
      } finally {
        if (!cancelled) {
          setLoadingSubmissions(false);
        }
      }
    }

    void loadSubmissions();

    return () => {
      cancelled = true;
    };
  }, [canViewSubmissions, onSubmissionsChange, selectedMatch, tournamentId]);

  function setPresetIndex(match: TournamentMatch, nextIndex: number) {
    setPresetIndexByMatchId((current) => ({
      ...current,
      [match.id]: clampScorePresetIndex(nextIndex, presets),
    }));
  }

  function moveScore(playerIndex: number, scoreDelta: -1 | 1) {
    if (!selectedMatch) {
      return;
    }

    setPresetIndex(
      selectedMatch,
      getScoreButtonTargetIndex(playerIndex, scoreDelta, selectedPresetIndex),
    );
  }

  function changeSelectedBestOf(nextBestOf: number) {
    if (!selectedMatch) {
      return;
    }

    const normalizedBestOf = normalizeBestOfInput(nextBestOf);
    setBestOfByMatchId((current) => ({
      ...current,
      [selectedMatch.id]: normalizedBestOf,
    }));
    setSetSelectionsByMatchId((current) => {
      const previous =
        current[selectedMatch.id] ??
        Array.from({ length: selectedBestOf }, (_, index) =>
          getInitialSetSelection(selectedMatch, index + 1),
        );

      return {
        ...current,
        [selectedMatch.id]: Array.from(
          { length: normalizedBestOf },
          (_, index) =>
            previous[index] ??
            getInitialSetSelection(selectedMatch, index + 1),
        ),
      };
    });
    setSubmissionError(null);
  }

  function updateSetWinner(setIndex: number, winnerSlotNo: 1 | 2) {
    if (!selectedMatch) {
      return;
    }

    setSetSelectionsByMatchId((current) => {
      const previous =
        current[selectedMatch.id] ??
        Array.from({ length: selectedBestOf }, (_, index) =>
          getInitialSetSelection(selectedMatch, index + 1),
        );
      const next = [...previous];
      next[setIndex] = {
        ...(next[setIndex] ?? createEmptySetSelection()),
        winnerSlotNo,
      };

      return {
        ...current,
        [selectedMatch.id]: next,
      };
    });
    setSubmissionError(null);
  }

  function updateSetMap(
    setIndex: number,
    map: HomeScheduleMapSearchResult | null,
  ) {
    if (!selectedMatch) {
      return;
    }

    setSetSelectionsByMatchId((current) => {
      const previous =
        current[selectedMatch.id] ??
        Array.from({ length: selectedBestOf }, (_, index) =>
          getInitialSetSelection(selectedMatch, index + 1),
        );
      const next = [...previous];
      next[setIndex] = {
        ...(next[setIndex] ?? createEmptySetSelection()),
        mapId: map?.id ?? null,
        mapName: map?.mapName ?? "",
      };

      return {
        ...current,
        [selectedMatch.id]: next,
      };
    });
    setSubmissionError(null);
  }

  async function reloadSubmissions(match: TournamentMatch) {
    const nextSubmissions = await listTournamentMatchScoreSubmissions(
      tournamentId,
      match.id,
    );
    setSubmissions(nextSubmissions);
    onSubmissionsChange?.(match.id, nextSubmissions);
  }

  async function submitScore() {
    if (
      !selectedMatch ||
      !canSubmitScore ||
      loadingSubmissions ||
      (!canAdmin && myPendingSubmission)
    ) {
      return;
    }

    if (usesSetEditor) {
      if (!selectedSetDecision.completed) {
        setSubmissionError("BO에 맞게 승리 세트를 입력해 주세요.");
        return;
      }
      if (selectedSetDecision.missingMap) {
        setSubmissionError("플레이한 모든 세트의 맵을 선택해 주세요.");
        return;
      }

      const payload: TournamentSubmitScoreRequest = {
        bestOf: selectedBestOf,
        sets: selectedSetDecision.playedSets,
      };

      setSubmitting(true);
      setSubmissionError(null);

      try {
        await submitTournamentMatchScore(tournamentId, selectedMatch.id, payload);
        await reloadSubmissions(selectedMatch);
      } catch (error) {
        setSubmissionError(
          getReadableSubmissionError(error, "경기 점수를 제출하지 못했습니다."),
        );
      } finally {
        setSubmitting(false);
      }
      return;
    }

    if (!selectedMap.mapId) {
      setSubmissionError("맵을 선택한 뒤 결과를 제출해 주세요.");
      return;
    }

    const payload: TournamentSubmitScoreRequest = {
      mapId: selectedMap.mapId,
      scores: selectedMatch.slots.map((slot, index) => ({
        slotNo: slot.slotNo === 2 ? 2 : 1,
        score: selectedPreset[index],
      })),
    };

    setSubmitting(true);
    setSubmissionError(null);

    try {
      await submitTournamentMatchScore(tournamentId, selectedMatch.id, payload);
      await reloadSubmissions(selectedMatch);
    } catch (error) {
      setSubmissionError(
        getReadableSubmissionError(error, "경기 점수를 제출하지 못했습니다."),
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function approveSubmission(submission: TournamentMatchScoreSubmission) {
    if (!selectedMatch) {
      return;
    }

    setPendingActionId(submission.id);
    setSubmissionError(null);

    try {
      const nextTournament = await approveTournamentMatchScoreSubmission(
        tournamentId,
        selectedMatch.id,
        submission.id,
      );
      onTournamentChange(nextTournament);
      onApprovedMatchReadyForClanShare?.(selectedMatch.id, nextTournament);
      const nextSubmissions: TournamentMatchScoreSubmission[] = submissions.map(
        (item) =>
          item.id === submission.id
            ? { ...item, status: "APPROVED" as const }
            : item,
      );
      setSubmissions(nextSubmissions);
      onSubmissionsChange?.(selectedMatch.id, nextSubmissions);
      setRejectingSubmissionId(null);
      setRejectNote("");
      setSubmissionError(null);
    } catch (error) {
      setSubmissionError(
        getReadableSubmissionError(error, "경기 점수 제출을 승인하지 못했습니다."),
      );
    } finally {
      setPendingActionId(null);
    }
  }

  async function rejectSubmission(submission: TournamentMatchScoreSubmission) {
    if (!selectedMatch) {
      return;
    }

    const adminNote = rejectNote.trim();

    if (!adminNote) {
      setSubmissionError("반려 사유를 입력해주세요.");
      return;
    }

    setPendingActionId(submission.id);
    setSubmissionError(null);

    try {
      await rejectTournamentMatchScoreSubmission(
        tournamentId,
        selectedMatch.id,
        submission.id,
        { adminNote },
      );
      await reloadSubmissions(selectedMatch);
      setRejectingSubmissionId(null);
      setRejectNote("");
      setSubmissionError(null);
    } catch (error) {
      setSubmissionError(
        getReadableSubmissionError(error, "경기 점수 제출을 반려하지 못했습니다."),
      );
    } finally {
      setPendingActionId(null);
    }
  }

  return (
    <SurfaceCard className="space-y-4 p-5 sm:p-6 xl:sticky xl:top-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">
          Match Result
        </p>
        <h2 className="mt-2 text-xl font-semibold text-foreground">
          {selectedMatch
            ? getPanelMatchTitle(selectedMatch)
            : "경기를 선택해주세요"}
        </h2>
        {selectedMatch ? (
          <p className="mt-2 text-sm text-muted">Bo{selectedMatch.bestOf}</p>
        ) : null}
      </div>

      {!selectedMatch ? (
        <div className="rounded-lg border border-line bg-surface-strong px-4 py-5 text-sm leading-6 text-muted">
          대진표에서 경기를 선택하면 결과 처리 패널이 열립니다.
        </div>
      ) : null}

      {selectedMatch?.status === "PENDING" ? (
        <div className="rounded-lg border border-line bg-surface-strong px-4 py-5 text-sm leading-6 text-muted">
          선수 슬롯이 아직 채워지지 않았습니다.
        </div>
      ) : null}

      {selectedMatch && hasByeSlot(selectedMatch) ? (
        <div className="rounded-lg border border-line bg-surface-strong px-4 py-5 text-sm leading-6 text-muted">
          부전승으로 확정된 경기입니다.
        </div>
      ) : null}

      {selectedMatch?.status === "FINISHED" && !hasPendingScoreSubmission ? (
        <div className="rounded-lg border border-success-ink/20 bg-success-soft p-4">
          <p className="text-sm font-semibold text-success-ink">결과 확정</p>
          <div className="mt-3 grid gap-2">
            {selectedMatch.slots.map((slot) => (
              <div
                key={slot.slotNo}
                className={cn(
                  "grid grid-cols-[minmax(0,1fr)_40px] rounded-md border px-3 py-2 text-sm",
                  slot.isWinner
                    ? "border-accent/40 bg-white font-semibold text-foreground"
                    : "border-line bg-white text-muted",
                )}
              >
                <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">
                  {slot.participant?.displayName ?? "부전승"}
                </span>
                <span className="text-right font-black">
                  {formatScore(slot.score)}
                </span>
              </div>
            ))}
          </div>
          <p className="mt-3 text-sm text-success-ink">
            승자:{" "}
            <strong>
              {getConfirmedWinnerSlot(selectedMatch)?.participant?.displayName ??
                "미정"}
            </strong>
          </p>
          <p className="mt-2 text-sm text-success-ink">
            맵: <strong>{selectedMatch.mapName ?? "미지정"}</strong>
          </p>
        </div>
      ) : null}

      {selectedMatch && isScoreSubmittableMatch(selectedMatch) ? (
        <>
          {canSubmitScore ? (
            <>
              {usesSetEditor ? (
                <SetScoreEditor
                  bestOf={selectedBestOf}
                  decision={selectedSetDecision}
                  disabled={submitting || Boolean(!canAdmin && myPendingSubmission)}
                  match={selectedMatch}
                  requireAllSets={tournament.bracketType === "ULTIMATE_BATTLE"}
                  selections={selectedSetSelections}
                  onBestOfChange={changeSelectedBestOf}
                  onSetMapChange={updateSetMap}
                  onSetWinnerChange={updateSetWinner}
                />
              ) : (
                <>
              <div className="rounded-lg border border-line bg-surface-strong p-4">
                <div className="mb-3 space-y-1">
                  <p className="text-sm font-semibold text-foreground">맵</p>
                  <p className="text-xs leading-5 text-muted">
                    결과 제출 전에 경기 맵을 선택해 주세요.
                  </p>
                </div>
                <HomeScheduleMapSearch
                  disabled={mapSelectionDisabled}
                  mapName={selectedMap.mapName}
                  onClear={() => {
                    setSelectedMap({ mapId: null, mapName: "" });
                    setSubmissionError(null);
                  }}
                  onSelect={(map: HomeScheduleMapSearchResult) => {
                    setSelectedMap({
                      mapId: map.id,
                      mapName: map.mapName,
                    });
                    setSubmissionError(null);
                  }}
                />
                {hasLockedScoreSubmission ? (
                  <p className="mt-2 text-xs leading-5 text-muted">
                    제출된 결과가 있어 맵을 변경할 수 없습니다.
                  </p>
                ) : !selectedMap.mapId ? (
                  <p className="mt-2 text-xs leading-5 text-warning-ink">
                    맵을 선택해야 결과를 제출할 수 있습니다.
                  </p>
                ) : null}
              </div>

              <ScoreStepper
                disabled={submitting || Boolean(!canAdmin && myPendingSubmission)}
                match={selectedMatch}
                preset={selectedPreset}
                presetIndex={selectedPresetIndex}
                presets={presets}
                onMoveScore={moveScore}
              />
                </>
              )}

              {!canAdmin && myPendingSubmission ? (
                <div className="rounded-lg border border-warning-ink/20 bg-warning-soft px-4 py-3 text-sm leading-6 text-warning-ink">
                  내 제출: {getSubmissionScores(myPendingSubmission)} · 관리자 승인
                  대기
                </div>
              ) : null}

              <Button
                variant="accent"
                fullWidth
                disabled={submitting || !canSubmitSelectedScore}
                onClick={submitScore}
              >
                {submitting ? "제출 중..." : "결과 제출"}
              </Button>
            </>
          ) : (
            <div className="rounded-lg border border-line bg-surface-strong px-4 py-5 text-sm leading-6 text-muted">
              결과 입력 권한이 없습니다.
            </div>
          )}
        </>
      ) : null}

      {submissionError ? (
        <p className="rounded-lg border border-danger-ink/20 bg-danger-soft px-4 py-3 text-sm leading-6 text-danger-ink">
          {submissionError}
        </p>
      ) : null}

      {selectedMatch && canViewSubmissions ? (
        <SubmissionList
          canAdmin={canAdmin}
          loading={loadingSubmissions}
          match={selectedMatch}
          pendingActionId={pendingActionId}
          rejectingSubmissionId={rejectingSubmissionId}
          rejectNote={rejectNote}
          submissions={visibleSubmissions}
          onApprove={approveSubmission}
          onCancelReject={() => {
            setRejectingSubmissionId(null);
            setRejectNote("");
          }}
          onReject={rejectSubmission}
          onRejectNoteChange={setRejectNote}
          onStartReject={(submissionId) => {
            setRejectingSubmissionId(submissionId);
            setRejectNote("");
          }}
        />
      ) : null}

      <p className="sr-only">{tournament.title}</p>
    </SurfaceCard>
  );
}
