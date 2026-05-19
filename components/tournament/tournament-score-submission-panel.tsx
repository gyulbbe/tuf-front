"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
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
  onTournamentChange: (tournament: Tournament) => void;
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

  async function reloadSubmissions(match: TournamentMatch) {
    const nextSubmissions = await listTournamentMatchScoreSubmissions(
      tournamentId,
      match.id,
    );
    setSubmissions(nextSubmissions);
    onSubmissionsChange?.(match.id, nextSubmissions);
  }

  async function submitScore() {
    if (!selectedMatch || !canSubmitScore || (!canAdmin && myPendingSubmission)) {
      return;
    }

    const payload: TournamentSubmitScoreRequest = {
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
        error instanceof Error
          ? error.message
          : "경기 점수를 제출하지 못했습니다.",
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
      const nextSubmissions: TournamentMatchScoreSubmission[] = submissions.map(
        (item) =>
          item.id === submission.id
            ? { ...item, status: "APPROVED" as const }
            : item,
      );
      setSubmissions(nextSubmissions);
      onSubmissionsChange?.(selectedMatch.id, nextSubmissions);
    } catch (error) {
      setSubmissionError(
        error instanceof Error
          ? error.message
          : "경기 점수 제출을 승인하지 못했습니다.",
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
    } catch (error) {
      setSubmissionError(
        error instanceof Error
          ? error.message
          : "경기 점수 제출을 반려하지 못했습니다.",
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

      {selectedMatch?.status === "FINISHED" ? (
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
        </div>
      ) : null}

      {selectedMatch && isScoreSubmittableMatch(selectedMatch) ? (
        <>
          {canSubmitScore ? (
            <>
              <ScoreStepper
                disabled={submitting || Boolean(!canAdmin && myPendingSubmission)}
                match={selectedMatch}
                preset={selectedPreset}
                presetIndex={selectedPresetIndex}
                presets={presets}
                onMoveScore={moveScore}
              />

              {!canAdmin && myPendingSubmission ? (
                <div className="rounded-lg border border-warning-ink/20 bg-warning-soft px-4 py-3 text-sm leading-6 text-warning-ink">
                  내 제출: {getSubmissionScores(myPendingSubmission)} · 관리자 승인
                  대기
                </div>
              ) : null}

              <Button
                variant="accent"
                fullWidth
                disabled={submitting || Boolean(!canAdmin && myPendingSubmission)}
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
