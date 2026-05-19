"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { HomeScheduleMapSearch } from "@/components/admin/home-schedule-map-search";
import { useAuth } from "@/components/auth/auth-provider";
import { DuelTournamentBoard } from "@/components/tournament/duel-tournament-board";
import { TournamentScoreSubmissionPanel } from "@/components/tournament/tournament-score-submission-panel";
import { SurfaceCard } from "@/components/site/surface-card";
import {
  approveRaceSurvivalProgressSubmission,
  getTournament,
  listRaceSurvivalProgressSubmissions,
  listTournamentMatchScoreSubmissions,
  rejectRaceSurvivalProgressSubmission,
  submitRaceSurvivalProgressSubmission,
  updateTournamentMatchMap,
  updateTournamentMatchParticipants,
  type RaceSurvivalProgressSubmission,
  type TournamentMatchScoreSubmission,
} from "@/lib/api/tournament";
import type { HomeScheduleMapSearchResult } from "@/lib/api/home-schedule";
import type {
  Tournament,
  TournamentMatch,
  TournamentParticipant,
} from "@/lib/tournament/types";
import { isAdminRole } from "@/lib/auth/roles";

type TournamentProgressPageProps = {
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

export function TournamentProgressPage({
  tournamentId,
}: TournamentProgressPageProps) {
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pendingApprovalMatchIds, setPendingApprovalMatchIds] = useState<
    Set<string>
  >(() => new Set());
  const pendingApprovalLoadedTournamentIdRef = useRef<string | null>(null);
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null);
  const matches = useMemo(() => getMatches(tournament), [tournament]);
  const selectedMatch =
    matches.find((match) => match.id === selectedMatchId) ?? null;
  const updatePendingApprovalForMatch = useCallback((
    matchId: string,
    submissions: TournamentMatchScoreSubmission[],
  ) => {
    const hasPendingSubmission = submissions.some(
      (submission) => submission.status === "PENDING",
    );

    setPendingApprovalMatchIds((currentIds) => {
      const nextIds = new Set(currentIds);

      if (hasPendingSubmission) {
        nextIds.add(matchId);
      } else {
        nextIds.delete(matchId);
      }

      return nextIds;
    });
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadTournament() {
      setLoading(true);
      setLoadError(null);

      try {
        const nextTournament = await getTournament(tournamentId);

        if (!cancelled) {
          setTournament(nextTournament);
          pendingApprovalLoadedTournamentIdRef.current = null;
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
    if (
      !tournament ||
      tournament.bracketType === "RACE_SURVIVAL" ||
      pendingApprovalLoadedTournamentIdRef.current === tournamentId
    ) {
      return;
    }

    pendingApprovalLoadedTournamentIdRef.current = tournamentId;
    let cancelled = false;

    async function loadPendingApprovalMatches() {
      const nextPendingIds = new Set<string>();

      await Promise.all(
        matches.map(async (match) => {
          try {
            const submissions = await listTournamentMatchScoreSubmissions(
              tournamentId,
              match.id,
            );

            if (submissions.some((submission) => submission.status === "PENDING")) {
              nextPendingIds.add(match.id);
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
  }, [matches, tournament, tournamentId]);

  return (
    <div className="relative left-1/2 w-[calc(100vw-1.25rem)] max-w-[1600px] -translate-x-1/2 space-y-4 sm:w-[calc(100vw-2rem)]">
      <SurfaceCard className="p-5 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">
              Admin Tournament
            </p>
            <h1 className="mt-2 text-2xl font-semibold text-foreground sm:text-3xl">
              {tournament?.title ?? "토너먼트 진행 관리"}
            </h1>
          </div>
          <Link
            href={`/tournament/${tournamentId}`}
            className="inline-flex items-center justify-center rounded-full border border-line-strong bg-white px-5 py-3 text-sm font-semibold text-muted transition-colors hover:border-accent hover:bg-accent-soft hover:text-accent-ink"
          >
            시청자 화면
          </Link>
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
              pendingApprovalMatchIds={new Set()}
              readOnly
              selectedMatchId={selectedMatchId}
              tournament={tournament}
              tournamentId={tournamentId}
            />
          ) : isSpecialTournament(tournament) ? (
            <SpecialTournamentProgressBoard
              onMatchSelect={(match: TournamentMatch) =>
                setSelectedMatchId(match.id)
              }
              pendingApprovalMatchIds={pendingApprovalMatchIds}
              selectedMatchId={selectedMatchId}
              tournament={tournament}
            />
          ) : (
            <DuelTournamentBoard
              onMatchSelect={(match: TournamentMatch) =>
                setSelectedMatchId(match.id)
              }
              pendingApprovalMatchIds={pendingApprovalMatchIds}
              selectedMatchId={selectedMatchId}
              tournament={tournament}
            />
          )}

          {tournament.bracketType === "RACE_SURVIVAL" ? (
            <RaceSurvivalProgressSubmissionPanel
              mode="admin"
              tournament={tournament}
              tournamentId={tournamentId}
              onTournamentChange={setTournament}
            />
          ) : (
            <TournamentScoreSubmissionPanel
              key={selectedMatch?.id ?? "no-match"}
              mode="admin"
              selectedMatch={selectedMatch}
              tournament={tournament}
              tournamentId={tournamentId}
              onSubmissionsChange={updatePendingApprovalForMatch}
              onTournamentChange={setTournament}
            />
          )}
        </div>
      ) : null}
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

type RaceSurvivalDraftRow = {
  clientId: string;
  matchOrder: number;
  mapId: number | null;
  mapName: string;
  slot1ParticipantId: string;
  slot2ParticipantId: string;
  slot1Score: 0 | 1;
  slot2Score: 0 | 1;
};

function createRaceSurvivalDraftRow(matchOrder: number): RaceSurvivalDraftRow {
  return {
    clientId: `race-progress-${matchOrder}-${Date.now()}`,
    matchOrder,
    mapId: null,
    mapName: "",
    slot1ParticipantId: "",
    slot2ParticipantId: "",
    slot1Score: 1,
    slot2Score: 0,
  };
}

export function RaceSurvivalProgressSubmissionPanel({
  mode,
  onTournamentChange,
  tournament,
  tournamentId,
}: {
  mode: "admin" | "public";
  onTournamentChange: (tournament: Tournament) => void;
  tournament: Tournament;
  tournamentId: string;
}) {
  const { user, isAuthenticated } = useAuth();
  const [draftRows, setDraftRows] = useState<RaceSurvivalDraftRow[]>(() => [
    createRaceSurvivalDraftRow(1),
  ]);
  const [submissions, setSubmissions] = useState<RaceSurvivalProgressSubmission[]>([]);
  const [selectedSubmissionId, setSelectedSubmissionId] = useState<string | null>(null);
  const [loadingSubmissions, setLoadingSubmissions] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rejectNote, setRejectNote] = useState("");
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
  const raceByParticipantId = useMemo(() => {
    const next = new Map<string, string>();
    raceGroups.forEach((group) => {
      group.participants.forEach((participant) => {
        next.set(participant.id, String(group.groupCode));
      });
    });
    return next;
  }, [raceGroups]);
  const participantOptions = useMemo(
    () =>
      raceGroups.flatMap((group) =>
        group.participants.map((participant) => ({
          participant,
          race: String(group.groupCode),
        })),
      ),
    [raceGroups],
  );
  const isAdmin = isAdminRole(user?.role);
  const isTournamentParticipant =
    typeof user?.userPk === "number" &&
    participantOptions.some(({ participant }) => participant.userId === String(user.userPk));
  const canViewSubmissions = isAdmin || isTournamentParticipant;
  const canSubmitProgress =
    tournament.status !== "FINISHED" && canViewSubmissions;
  const canReview = mode === "admin" && isAdmin;
  const selectedSubmission =
    submissions.find((submission) => submission.id === selectedSubmissionId) ??
    submissions[0] ??
    null;

  const loadSubmissions = useCallback(async () => {
    if (!canViewSubmissions) {
      setSubmissions([]);
      setSelectedSubmissionId(null);
      return;
    }

    setLoadingSubmissions(true);
    setError(null);
    try {
      const nextSubmissions = await listRaceSurvivalProgressSubmissions(tournamentId);
      setSubmissions(nextSubmissions);
      setSelectedSubmissionId((currentId) =>
        currentId && nextSubmissions.some((submission) => submission.id === currentId)
          ? currentId
          : nextSubmissions[0]?.id ?? null,
      );
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "종족 최강전 진행안 목록을 불러오지 못했습니다.",
      );
    } finally {
      setLoadingSubmissions(false);
    }
  }, [canViewSubmissions, tournamentId]);

  useEffect(() => {
    void loadSubmissions();
  }, [loadSubmissions]);

  function updateDraftRow(
    clientId: string,
    updater: (row: RaceSurvivalDraftRow) => RaceSurvivalDraftRow,
  ) {
    setDraftRows((currentRows) =>
      currentRows.map((row) => (row.clientId === clientId ? updater(row) : row)),
    );
    setError(null);
    setMessage(null);
  }

  function addDraftRow() {
    setDraftRows((currentRows) => [
      ...currentRows,
      createRaceSurvivalDraftRow(currentRows.length + 1),
    ]);
  }

  function removeDraftRow(clientId: string) {
    setDraftRows((currentRows) =>
      currentRows
        .filter((row) => row.clientId !== clientId)
        .map((row, index) => ({ ...row, matchOrder: index + 1 })),
    );
  }

  function buildSubmissionPayload() {
    if (draftRows.length === 0) {
      throw new Error("최소 1경기 이상 입력해주세요.");
    }

    return {
      matches: draftRows.map((row, index) => {
        const slot1ParticipantId = getParticipantIdNumber(row.slot1ParticipantId);
        const slot2ParticipantId = getParticipantIdNumber(row.slot2ParticipantId);

        if (!slot1ParticipantId || !slot2ParticipantId) {
          throw new Error("모든 경기의 선수 A/B를 선택해주세요.");
        }
        if (slot1ParticipantId === slot2ParticipantId) {
          throw new Error("같은 선수를 양쪽 슬롯에 넣을 수 없습니다.");
        }

        return {
          matchOrder: index + 1,
          mapId: row.mapId,
          slot1ParticipantId,
          slot2ParticipantId,
          slot1Score: row.slot1Score,
          slot2Score: row.slot2Score,
        };
      }),
    };
  }

  async function submitProgress() {
    if (!canSubmitProgress) {
      return;
    }

    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const payload = buildSubmissionPayload();
      const submission = await submitRaceSurvivalProgressSubmission(tournamentId, payload);
      setMessage("진행안을 제출했습니다. 관리자 최종 승인 전까지 공식 결과에는 반영되지 않습니다.");
      setSelectedSubmissionId(submission.id);
      await loadSubmissions();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "종족 최강전 진행안을 제출하지 못했습니다.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function approveProgress(submissionId: string) {
    if (!canReview) {
      return;
    }

    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const nextTournament = await approveRaceSurvivalProgressSubmission(
        tournamentId,
        submissionId,
      );
      onTournamentChange(nextTournament);
      setMessage("진행안을 최종 승인했습니다. 공식 결과가 반영되었습니다.");
      await loadSubmissions();
    } catch (approveError) {
      setError(
        approveError instanceof Error
          ? approveError.message
          : "종족 최강전 진행안을 최종 승인하지 못했습니다.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function rejectProgress(submissionId: string) {
    if (!canReview) {
      return;
    }

    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await rejectRaceSurvivalProgressSubmission(tournamentId, submissionId, {
        adminNote: rejectNote.trim() || "관리자 반려",
      });
      setRejectNote("");
      setMessage("진행안을 반려했습니다.");
      await loadSubmissions();
    } catch (rejectError) {
      setError(
        rejectError instanceof Error
          ? rejectError.message
          : "종족 최강전 진행안을 반려하지 못했습니다.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <SurfaceCard className="space-y-5 p-5 sm:p-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">
          Race Progress
        </p>
        <h2 className="mt-2 text-xl font-semibold text-foreground">
          전체 진행안
        </h2>
        <p className="mt-2 text-sm leading-6 text-muted">
          출전 순서, 맵, 승패를 끝까지 입력한 뒤 한 번에 제출합니다.
        </p>
      </div>

      {!isAuthenticated ? (
        <div className="rounded-lg border border-line bg-surface-strong px-4 py-4 text-sm text-muted">
          로그인한 참가자 또는 관리자만 진행안을 제출할 수 있습니다.
        </div>
      ) : null}

      {isAuthenticated && !canViewSubmissions ? (
        <div className="rounded-lg border border-line bg-surface-strong px-4 py-4 text-sm text-muted">
          참가자가 아니면 공식 반영된 결과만 볼 수 있습니다.
        </div>
      ) : null}

      {message ? (
        <div className="rounded-lg border border-success-ink/20 bg-success-soft px-4 py-3 text-sm font-semibold text-success-ink">
          {message}
        </div>
      ) : null}

      {error ? (
        <div className="rounded-lg border border-danger-ink/20 bg-danger-soft px-4 py-3 text-sm font-semibold text-danger-ink">
          {error}
        </div>
      ) : null}

      {canSubmitProgress ? (
        <div className="space-y-3">
          <div className="overflow-x-auto rounded-lg border border-line bg-surface-strong">
            <table className="w-full min-w-[980px] border-collapse text-sm">
              <thead>
                <tr className="bg-surface text-left text-xs font-bold uppercase tracking-[0.08em] text-muted">
                  <th className="px-3 py-3">순서</th>
                  <th className="px-3 py-3">맵</th>
                  <th className="px-3 py-3">선수 A</th>
                  <th className="px-3 py-3">스코어</th>
                  <th className="px-3 py-3">선수 B</th>
                  <th className="px-3 py-3">관리</th>
                </tr>
              </thead>
              <tbody>
                {draftRows.map((row, index) => (
                  <tr key={row.clientId} className="border-t border-line">
                    <td className="px-3 py-3 align-top">
                      <span className="inline-flex size-8 items-center justify-center rounded-full bg-surface text-sm font-bold text-accent-ink">
                        {index + 1}
                      </span>
                    </td>
                    <td className="min-w-[220px] px-3 py-3 align-top">
                      <HomeScheduleMapSearch
                        disabled={busy}
                        mapName={row.mapName}
                        onClear={() =>
                          updateDraftRow(row.clientId, (currentRow) => ({
                            ...currentRow,
                            mapId: null,
                            mapName: "",
                          }))
                        }
                        onSelect={(map) =>
                          updateDraftRow(row.clientId, (currentRow) => ({
                            ...currentRow,
                            mapId: map.id,
                            mapName: map.mapName,
                          }))
                        }
                      />
                    </td>
                    <td className="min-w-[190px] px-3 py-3 align-top">
                      <select
                        className="min-h-11 w-full rounded-lg border border-line-strong bg-white px-3 text-sm text-foreground outline-none focus:border-accent"
                        value={row.slot1ParticipantId}
                        onChange={(event) =>
                          updateDraftRow(row.clientId, (currentRow) => ({
                            ...currentRow,
                            slot1ParticipantId: event.target.value,
                          }))
                        }
                      >
                        <option value="">선수 선택</option>
                        {participantOptions.map(({ participant, race }) => (
                          <option key={participant.id} value={participant.id}>
                            {participant.displayName} · {race}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-3 align-top">
                      <select
                        className="min-h-11 rounded-lg border border-line-strong bg-white px-3 text-sm font-bold text-foreground outline-none focus:border-accent"
                        value={`${row.slot1Score}:${row.slot2Score}`}
                        onChange={(event) => {
                          const [leftScore, rightScore] = event.target.value
                            .split(":")
                            .map(Number) as [0 | 1, 0 | 1];
                          updateDraftRow(row.clientId, (currentRow) => ({
                            ...currentRow,
                            slot1Score: leftScore,
                            slot2Score: rightScore,
                          }));
                        }}
                      >
                        <option value="1:0">1 : 0</option>
                        <option value="0:1">0 : 1</option>
                      </select>
                    </td>
                    <td className="min-w-[190px] px-3 py-3 align-top">
                      <select
                        className="min-h-11 w-full rounded-lg border border-line-strong bg-white px-3 text-sm text-foreground outline-none focus:border-accent"
                        value={row.slot2ParticipantId}
                        onChange={(event) =>
                          updateDraftRow(row.clientId, (currentRow) => ({
                            ...currentRow,
                            slot2ParticipantId: event.target.value,
                          }))
                        }
                      >
                        <option value="">선수 선택</option>
                        {participantOptions.map(({ participant, race }) => (
                          <option key={participant.id} value={participant.id}>
                            {participant.displayName} · {race}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-3 align-top">
                      <button
                        type="button"
                        className="rounded-full border border-danger-ink/20 bg-danger-soft px-3 py-2 text-xs font-bold text-danger-ink disabled:opacity-40"
                        disabled={draftRows.length === 1 || busy}
                        onClick={() => removeDraftRow(row.clientId)}
                      >
                        삭제
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              className="rounded-full border border-line-strong bg-white px-4 py-2 text-sm font-bold text-muted transition-colors hover:border-accent hover:bg-accent-soft hover:text-accent-ink"
              disabled={busy}
              onClick={addDraftRow}
            >
              경기 추가
            </button>
            <button
              type="button"
              className="rounded-full bg-accent px-5 py-2 text-sm font-bold text-white transition-colors hover:bg-accent-ink disabled:cursor-not-allowed disabled:opacity-50"
              disabled={busy}
              onClick={() => {
                void submitProgress();
              }}
            >
              {busy ? "처리 중" : "결과 제출"}
            </button>
          </div>
        </div>
      ) : null}

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-semibold text-foreground">제출안</p>
          {loadingSubmissions ? (
            <span className="text-xs font-semibold text-muted">불러오는 중</span>
          ) : null}
        </div>

        {submissions.length > 0 ? (
          <div className="grid gap-2">
            {submissions.map((submission) => (
              <button
                key={submission.id}
                type="button"
                className={[
                  "rounded-lg border px-4 py-3 text-left transition-colors",
                  selectedSubmission?.id === submission.id
                    ? "border-accent bg-accent-soft"
                    : "border-line bg-surface-strong hover:border-accent hover:bg-accent-soft",
                ].join(" ")}
                onClick={() => setSelectedSubmissionId(submission.id)}
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-bold text-foreground">
                    {submission.submitterLoginId ?? "제출자"} 제출
                  </p>
                  <span
                    className={[
                      "rounded-full px-3 py-1 text-xs font-bold",
                      submission.status === "PENDING"
                        ? "bg-warning-soft text-warning-ink"
                        : submission.status === "APPROVED"
                          ? "bg-success-soft text-success-ink"
                          : "bg-danger-soft text-danger-ink",
                    ].join(" ")}
                  >
                    {submission.status === "PENDING"
                      ? "최종 승인 대기"
                      : submission.status === "APPROVED"
                        ? "승인"
                        : "반려"}
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted">
                  {submission.matches.length}경기 · {submission.regDate ?? "-"}
                </p>
              </button>
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-line bg-surface-strong px-4 py-5 text-sm text-muted">
            제출된 진행안이 없습니다.
          </div>
        )}
      </div>

      {selectedSubmission ? (
        <div className="space-y-3 rounded-lg border border-line bg-surface-strong p-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm font-semibold text-foreground">
              진행안 미리보기
            </p>
            <span className="text-xs font-semibold text-muted">
              {selectedSubmission.submitterLoginId ?? "제출자"}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[620px] text-sm">
              <thead>
                <tr className="text-left text-xs font-bold uppercase tracking-[0.08em] text-muted">
                  <th className="py-2">순서</th>
                  <th className="py-2">맵</th>
                  <th className="py-2">선수 A</th>
                  <th className="py-2">스코어</th>
                  <th className="py-2">선수 B</th>
                  <th className="py-2">승자</th>
                </tr>
              </thead>
              <tbody>
                {selectedSubmission.matches.map((match) => (
                  <tr key={match.id} className="border-t border-line">
                    <td className="py-2 font-bold text-accent-ink">
                      {match.matchOrder}
                    </td>
                    <td className="py-2 text-muted">
                      {match.mapName ?? "맵 미정"}
                    </td>
                    <td className="py-2 font-semibold text-foreground">
                      {match.slot1Participant?.displayName ?? match.slot1ParticipantId}
                      <span className="ml-1 text-xs text-muted">
                        {match.slot1Race}
                      </span>
                    </td>
                    <td className="py-2 font-bold text-foreground">
                      {match.slot1Score} : {match.slot2Score}
                    </td>
                    <td className="py-2 font-semibold text-foreground">
                      {match.slot2Participant?.displayName ?? match.slot2ParticipantId}
                      <span className="ml-1 text-xs text-muted">
                        {match.slot2Race}
                      </span>
                    </td>
                    <td className="py-2 font-bold text-success-ink">
                      {match.winnerParticipant?.displayName ?? "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {canReview && selectedSubmission.status === "PENDING" ? (
            <div className="grid gap-3">
              <textarea
                className="min-h-20 rounded-lg border border-line-strong bg-white px-4 py-3 text-sm text-foreground outline-none focus:border-accent"
                placeholder="반려 사유"
                value={rejectNote}
                onChange={(event) => setRejectNote(event.target.value)}
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  className="rounded-full border border-danger-ink/20 bg-danger-soft px-4 py-2 text-sm font-bold text-danger-ink disabled:opacity-50"
                  disabled={busy}
                  onClick={() => {
                    void rejectProgress(selectedSubmission.id);
                  }}
                >
                  반려
                </button>
                <button
                  type="button"
                  className="rounded-full bg-accent px-5 py-2 text-sm font-bold text-white transition-colors hover:bg-accent-ink disabled:opacity-50"
                  disabled={busy}
                  onClick={() => {
                    void approveProgress(selectedSubmission.id);
                  }}
                >
                  최종 승인
                </button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </SurfaceCard>
  );
}

export function RaceSurvivalProgressBoard({
  allowParticipantAssignment = false,
  onMatchSelect,
  onTournamentChange,
  pendingApprovalMatchIds,
  readOnly = false,
  selectedMatchId,
  tournament,
  tournamentId,
}: {
  allowParticipantAssignment?: boolean;
  onMatchSelect?: (match: TournamentMatch) => void;
  onTournamentChange?: (tournament: Tournament) => void;
  pendingApprovalMatchIds?: ReadonlySet<string>;
  readOnly?: boolean;
  selectedMatchId?: string | null;
  tournament: Tournament;
  tournamentId?: string;
}) {
  const { user } = useAuth();
  const [editingMapMatchId, setEditingMapMatchId] = useState<string | null>(null);
  const [updatingMapMatchId, setUpdatingMapMatchId] = useState<string | null>(null);
  const [mapError, setMapError] = useState<string | null>(null);
  const [assignmentError, setAssignmentError] = useState<string | null>(null);
  const [savingAssignmentMatchId, setSavingAssignmentMatchId] = useState<string | null>(null);
  const [slot1ParticipantId, setSlot1ParticipantId] = useState("");
  const [slot2ParticipantId, setSlot2ParticipantId] = useState("");
  const canCallUpdate = Boolean(tournamentId && onTournamentChange);
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
  const isTournamentParticipant = useMemo(() => {
    if (typeof user?.userPk !== "number") {
      return false;
    }
    const currentUserId = String(user.userPk);
    return raceGroups.some((group) =>
      group.participants.some((participant) => participant.userId === currentUserId),
    );
  }, [raceGroups, user?.userPk]);
  const canEditMaps = !readOnly && canCallUpdate;
  const canEditParticipants =
    canCallUpdate && (!readOnly || (allowParticipantAssignment && isTournamentParticipant));
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
    canEditParticipants &&
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

  async function saveMatchMap(match: TournamentMatch, mapId: number | null) {
    if (!canEditMaps || !tournamentId || !onTournamentChange) {
      return;
    }

    setUpdatingMapMatchId(match.id);
    setMapError(null);

    try {
      const nextTournament = await updateTournamentMatchMap(
        tournamentId,
        match.id,
        mapId,
      );
      onTournamentChange(nextTournament);
      setEditingMapMatchId(null);
    } catch (error) {
      setMapError(
        error instanceof Error ? error.message : "경기 맵을 저장하지 못했습니다.",
      );
    } finally {
      setUpdatingMapMatchId(null);
    }
  }

  function handleMapSelect(match: TournamentMatch, map: HomeScheduleMapSearchResult) {
    void saveMatchMap(match, map.id);
  }

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

      {canEditParticipants ? (
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

      {mapError ? (
        <div className="rounded-lg border border-danger-ink/20 bg-danger-soft px-4 py-3 text-sm font-semibold text-danger-ink">
          {mapError}
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
              const isEditingMap = editingMapMatchId === match.id;
              const isUpdatingMap = updatingMapMatchId === match.id;
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
                    <div
                      className="grid gap-2"
                      onClick={(event) => {
                        if (canEditMaps) {
                          event.stopPropagation();
                        }
                      }}
                      onKeyDown={(event) => {
                        if (canEditMaps) {
                          event.stopPropagation();
                        }
                      }}
                    >
                      {canEditMaps && isEditingMap ? (
                        <div className="grid gap-2">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-bold text-muted">
                              맵 선택
                            </span>
                            <button
                              type="button"
                              className="text-xs font-bold text-accent-ink hover:text-accent"
                              onClick={() => setEditingMapMatchId(null)}
                            >
                              닫기
                            </button>
                          </div>
                          <HomeScheduleMapSearch
                            disabled={isUpdatingMap}
                            mapName={match.mapName ?? ""}
                            onClear={() => {
                              void saveMatchMap(match, null);
                            }}
                            onSelect={(map) => handleMapSelect(match, map)}
                          />
                        </div>
                      ) : canEditMaps ? (
                        <button
                          type="button"
                          className={[
                            "inline-flex min-h-9 w-fit items-center rounded-full border px-3 text-xs font-bold transition-colors",
                            match.mapName
                              ? "border-line-strong bg-white text-foreground hover:border-accent hover:bg-accent-soft"
                              : "border-warning-ink/20 bg-warning-soft text-warning-ink hover:border-warning-ink/40",
                          ].join(" ")}
                          onClick={() => setEditingMapMatchId(match.id)}
                        >
                          {match.mapName ?? "맵 미정"}
                        </button>
                      ) : (
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
                      )}
                      {isUpdatingMap ? (
                        <span className="text-xs font-semibold text-muted">
                          저장 중입니다.
                        </span>
                      ) : null}
                    </div>
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
