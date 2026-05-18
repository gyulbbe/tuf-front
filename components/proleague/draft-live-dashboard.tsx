"use client";

import Link from "next/link";
import {
  startTransition,
  type PointerEvent as ReactPointerEvent,
  useDeferredValue,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  extendDraftTurn,
  getDraftSnapshot,
  isDraftApiError,
  listDraftSessions,
  pauseDraftSession,
  pickDraftCandidate,
  resumeDraftSession,
  skipDraftTurn,
  startDraftSession,
  type DraftAiAdvice,
  type DraftCandidate,
  type DraftLiveEvent,
  type DraftLiveNormalizedPosition,
  type DraftLivePermissions,
  type DraftLivePreviewEndReason,
  type DraftLiveSessionInfo,
  type DraftLiveSnapshot,
  type DraftLiveTeam,
  type DraftSessionSummary,
} from "@/lib/api/draft";
import { subscribeToDraftSession } from "@/lib/draft/live-events";
import { useAuth } from "@/components/auth/auth-provider";
import type { AuthUser } from "@/lib/auth/auth-types";
import { buildLoginHref } from "@/lib/auth/auth-navigation";
import { proleagueDraftLivePath } from "@/lib/proleague-draft/routes";
import { SurfaceCard } from "@/components/site/surface-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type NoticeTone = "error" | "neutral" | "success";

type ConnectionState =
  | "connecting"
  | "connected"
  | "reconnecting"
  | "disconnected"
  | "error";

type NoticeState = {
  tone: NoticeTone;
  text: string;
};

type ActivityLogItem = {
  id: string;
  message: string;
  occurredAt: string | null;
};

type AiAdviceDisplayItem = {
  id: string;
  message: string;
  occurredAt: string | null;
  pickNo: number | null;
  nextPickNo: number | null;
  evaluatedCandidateName: string | null;
  evaluatedTeamName: string | null;
  recommendedCandidateName: string | null;
  recommendedTeamName: string | null;
};

type DraftLiveAuxiliaryState = {
  sessionId: number | null;
  activityLog: ActivityLogItem[];
};

type CandidateDisplayInfo = {
  candidateName: string;
  tier: string | null;
  race: string | null;
};

type CandidateDisplaySource = CandidateDisplayInfo & {
  candidateUserId: number;
};

const STATUS_LABELS: Record<string, string> = {
  READY: "준비",
  LIVE: "진행 중",
  PAUSED: "일시정지",
  FINISHED: "종료",
};

const CONNECTION_LABELS: Record<ConnectionState, string> = {
  connecting: "소켓 연결 중",
  connected: "실시간 연결됨",
  reconnecting: "재연결 시도 중",
  disconnected: "연결 종료",
  error: "연결 오류",
};

const AI_ADVISOR_NAME = "훈수충";
const AI_PICK_REVIEW_READY = "AI_PICK_REVIEW_READY";
const AI_RECOMMENDATION_READY = "AI_RECOMMENDATION_READY";

const ACTIVITY_LOG_EVENT_TYPES = new Set([
  "PICK_COMPLETED",
  "PICK_SKIPPED",
  "SESSION_STARTED",
  "SESSION_PAUSED",
  "SESSION_RESUMED",
  "SESSION_FINISHED",
  "TIMER_EXTENDED",
]);

function formatDraftStatus(status: string | null | undefined) {
  if (!status) {
    return "미정";
  }

  return STATUS_LABELS[status] ?? status;
}

function readErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return "요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.";
}

function readTrimmedText(value: string | null | undefined) {
  return value?.trim() || null;
}

function isAiAdviceEvent(event: DraftLiveEvent) {
  return (
    event.type === AI_PICK_REVIEW_READY ||
    event.type === AI_RECOMMENDATION_READY
  );
}

function readAiAdviceMessage(event: DraftLiveEvent) {
  return readTrimmedText(event.aiAdvice?.message) ?? readTrimmedText(event.message);
}

function readAiAdviceNumber(value: number | null | undefined) {
  return typeof value === "number" ? value : null;
}

function buildAiAdviceId(event: DraftLiveEvent) {
  return [
    event.type,
    event.sessionId,
    event.occurredAt ?? event.serverNow ?? "no-time",
    event.aiAdvice?.pickNo ?? "no-pick",
    event.aiAdvice?.nextPickNo ?? "no-next",
    event.aiAdvice?.evaluatedCandidateUserId ?? "no-evaluated",
    event.aiAdvice?.recommendedCandidateUserId ?? "no-recommended",
    readAiAdviceMessage(event) ?? "",
  ].join(":");
}

function buildAiAdviceDisplayItem(event: DraftLiveEvent) {
  const message = readAiAdviceMessage(event);

  if (!message) {
    return null;
  }

  const advice: DraftAiAdvice | null = event.aiAdvice ?? null;

  return {
    id: buildAiAdviceId(event),
    message,
    occurredAt: event.occurredAt ?? event.serverNow,
    pickNo: readAiAdviceNumber(advice?.pickNo),
    nextPickNo: readAiAdviceNumber(advice?.nextPickNo),
    evaluatedCandidateName: readTrimmedText(advice?.evaluatedCandidateName),
    evaluatedTeamName: readTrimmedText(advice?.evaluatedTeamName),
    recommendedCandidateName: readTrimmedText(advice?.recommendedCandidateName),
    recommendedTeamName: readTrimmedText(advice?.recommendedTeamName),
  } satisfies AiAdviceDisplayItem;
}

function isCurrentTurnRecommendation(
  item: AiAdviceDisplayItem,
  snapshot: DraftLiveSnapshot | null,
) {
  return (
    typeof item.nextPickNo === "number" &&
    snapshot?.currentTurn?.pickNo === item.nextPickNo
  );
}

function formatAiAdviceLogMessage(
  item: AiAdviceDisplayItem,
  options?: {
    staleRecommendation?: boolean;
  },
) {
  const label = options?.staleRecommendation
    ? `${AI_ADVISOR_NAME} 지난 추천`
    : AI_ADVISOR_NAME;

  return `${label}: ${item.message}`;
}

function createDraftLiveAuxiliaryState(
  sessionId: number | null,
): DraftLiveAuxiliaryState {
  return {
    sessionId,
    activityLog: [],
  };
}

function isFinalPickMessage(message: string) {
  const normalized = message.toLowerCase();
  return normalized.includes("final pick") || message.includes("마지막 지명");
}

function hasKoreanText(message: string) {
  return /[ㄱ-ㅎㅏ-ㅣ가-힣]/.test(message);
}

function formatDraftEventMessage(event: DraftLiveEvent) {
  const message = event.message?.trim() ?? "";
  const normalizedMessage = message.toLowerCase();

  if (normalizedMessage.includes("timeout")) {
    return "지명 시간이 초과하였습니다.";
  }

  if (isFinalPickMessage(message)) {
    return "마지막 지명이 완료되어 드래프트가 종료되었습니다.";
  }

  if (message && hasKoreanText(message)) {
    return message;
  }

  if (event.type === "SESSION_STARTED") {
    return "드래프트를 시작했습니다.";
  }

  if (event.type === "SESSION_PAUSED") {
    return "드래프트를 일시정지했습니다.";
  }

  if (event.type === "SESSION_RESUMED") {
    return "드래프트를 재개했습니다.";
  }

  if (event.type === "TIMER_EXTENDED") {
    return "제한 시간을 연장했습니다.";
  }

  if (event.type === "PICK_SKIPPED") {
    return normalizedMessage.includes("timeout")
      ? "지명 시간이 초과하였습니다."
      : "현재 턴을 스킵했습니다.";
  }

  if (event.type === "PICK_COMPLETED") {
    return "지명을 완료했습니다.";
  }

  if (event.type === "SESSION_FINISHED") {
    return "드래프트가 종료되었습니다.";
  }

  return message || null;
}

function buildActivityLogId(event: DraftLiveEvent) {
  return [
    event.type,
    event.sessionId,
    event.occurredAt ?? event.serverNow ?? "no-time",
    event.actorUserId ?? "system",
    event.message ?? "",
    event.aiAdvice?.message ?? "",
  ].join(":");
}

function formatActivityActorSubject(event: DraftLiveEvent) {
  const actor =
    event.actorUserLoginId?.trim() ||
    event.actorName?.trim() ||
    (typeof event.actorUserId === "number" ? `user_${event.actorUserId}` : "");

  return actor ? `${actor}님이` : "";
}

function isTimeoutEvent(event: DraftLiveEvent) {
  const message = event.message?.trim() ?? "";
  const normalizedMessage = message.toLowerCase();

  return normalizedMessage.includes("timeout") || message.includes("시간이 초과");
}

function findActivityPickCandidateName(
  event: DraftLiveEvent,
  currentSnapshot: DraftLiveSnapshot | null,
) {
  const pick =
    event.snapshot?.recentPicks?.[0] ?? currentSnapshot?.recentPicks?.[0] ?? null;

  return pick ? formatCandidateLoginId(pick) : null;
}

function formatActivityLogMessage(
  event: DraftLiveEvent,
  currentSnapshot: DraftLiveSnapshot | null,
) {
  if (!ACTIVITY_LOG_EVENT_TYPES.has(event.type)) {
    return null;
  }

  if (event.type === "PICK_SKIPPED" && isTimeoutEvent(event)) {
    return "제한 시간이 초과되어 현재 턴이 넘어갔습니다.";
  }

  const actorSubject = formatActivityActorSubject(event);
  const fallbackMessage = formatDraftEventMessage(event);

  if (event.type === "PICK_COMPLETED") {
    const candidateName = findActivityPickCandidateName(event, currentSnapshot);

    if (actorSubject && candidateName) {
      return `${actorSubject} ${candidateName}를 지명했습니다.`;
    }

    return fallbackMessage;
  }

  if (event.type === "PICK_SKIPPED") {
    return actorSubject
      ? `${actorSubject} 지명 포기했습니다.`
      : fallbackMessage;
  }

  if (event.type === "SESSION_STARTED") {
    return actorSubject
      ? `${actorSubject} 드래프트를 시작했습니다.`
      : fallbackMessage;
  }

  if (event.type === "SESSION_PAUSED") {
    return actorSubject
      ? `${actorSubject} 드래프트를 일시정지했습니다.`
      : fallbackMessage;
  }

  if (event.type === "SESSION_RESUMED") {
    return actorSubject
      ? `${actorSubject} 드래프트를 재개했습니다.`
      : fallbackMessage;
  }

  if (event.type === "TIMER_EXTENDED") {
    return actorSubject
      ? `${actorSubject} 제한 시간을 연장했습니다.`
      : fallbackMessage;
  }

  if (event.type === "SESSION_FINISHED") {
    return actorSubject
      ? `${actorSubject} 드래프트를 종료했습니다.`
      : fallbackMessage;
  }

  return fallbackMessage;
}

function formatCandidateId(value: string | null | undefined) {
  return value?.trim() || "-";
}

function formatCandidateLoginId(candidate: {
  candidateName?: string | null;
  candidateUserLoginId?: string | null;
}) {
  return formatCandidateId(candidate.candidateUserLoginId ?? candidate.candidateName);
}

function formatCandidateTier(value: string | null | undefined) {
  return value?.trim() || "-";
}

function formatCandidateRace(value: string | null | undefined) {
  return value?.trim().toLowerCase() || "-";
}

function buildCandidateDisplay(candidate: DraftCandidate) {
  return [
    formatCandidateLoginId(candidate),
    formatCandidateTier(candidate.tier),
    formatCandidateRace(candidate.race),
  ].join(" ");
}

function isMissingSessionError(error: unknown) {
  if (!isDraftApiError(error)) {
    return false;
  }

  const status = error.info.responseStatus ?? error.info.httpStatus;
  return status === 404;
}

function toTimestamp(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const timestamp = Date.parse(value);

  if (Number.isNaN(timestamp)) {
    return null;
  }

  return timestamp;
}

function formatDateTime(value: string | null | undefined) {
  const timestamp = toTimestamp(value);

  if (timestamp === null) {
    return "-";
  }

  return new Intl.DateTimeFormat("ko-KR", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(timestamp);
}

function formatCountdown(totalSeconds: number) {
  const safeSeconds = Math.max(totalSeconds, 0);
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function getStatusPriority(status: string) {
  switch (status) {
    case "LIVE":
      return 0;
    case "PAUSED":
      return 1;
    case "READY":
      return 2;
    case "FINISHED":
      return 3;
    default:
      return 4;
  }
}

function sortSessions(sessions: DraftSessionSummary[]) {
  return [...sessions].sort((left, right) => {
    const priorityGap = getStatusPriority(left.status) - getStatusPriority(right.status);

    if (priorityGap !== 0) {
      return priorityGap;
    }

    const leftActivity =
      toTimestamp(left.startedAt) ??
      toTimestamp(left.endedAt) ??
      toTimestamp(left.deadlineAt) ??
      left.id;
    const rightActivity =
      toTimestamp(right.startedAt) ??
      toTimestamp(right.endedAt) ??
      toTimestamp(right.deadlineAt) ??
      right.id;

    return rightActivity - leftActivity;
  });
}

function filterSessionsForView(
  sessions: DraftSessionSummary[],
  adminMode: boolean,
) {
  if (adminMode) {
    return sortSessions(sessions);
  }

  return sortSessions(
    sessions.filter((session) => session.status !== "FINISHED"),
  );
}

function sortTeams(teams: DraftLiveTeam[]) {
  return [...teams].sort((left, right) => {
    if (left.displayOrder !== right.displayOrder) {
      return left.displayOrder - right.displayOrder;
    }

    return left.id - right.id;
  });
}

function isDraftAdminRole(role: string | null | undefined) {
  return role === "ROLE_MASTER" || role === "ROLE_MANAGER" || role === "ROLE_ADMIN";
}

function buildLocalPermissions(
  snapshot: DraftLiveSnapshot,
  user: AuthUser | null,
): DraftLivePermissions {
  const canControl = Boolean(
    user &&
      (isDraftAdminRole(user.role) ||
        snapshot.session.ownerUserId === user.userPk),
  );

  if (!user) {
    return {
      canControl,
      canPick: false,
      myRole: null,
      myTeamId: null,
    };
  }

  const myTeam =
    snapshot.teams.find((team) => team.pickerUserId === user.userPk) ?? null;
  const canPick = Boolean(
    myTeam &&
      snapshot.currentTurn &&
      myTeam.id === snapshot.currentTurn.teamId &&
      myTeam.pickerUserId === user.userPk,
  );

  return {
    canControl,
    canPick,
    myRole: myTeam ? "PICKER" : null,
    myTeamId: myTeam?.id ?? null,
  };
}

function chooseInitialSessionId(sessions: DraftSessionSummary[]) {
  return sessions[0]?.id ?? null;
}

function mergeSessionSummary(
  currentSessions: DraftSessionSummary[],
  session: DraftLiveSessionInfo,
  adminMode: boolean,
) {
  const nextSessions = currentSessions.filter((item) => item.id !== session.id);

  if (!adminMode && session.status === "FINISHED") {
    return filterSessionsForView(nextSessions, adminMode);
  }

  return filterSessionsForView(
    [
      ...nextSessions,
      {
        id: session.id,
        title: session.title,
        ownerUserId: session.ownerUserId,
        ownerUserLoginId: session.ownerUserLoginId,
        ownerName: session.ownerName,
        orderMode: session.orderMode,
        status: session.status,
        teamCount: session.teamCount,
        pickTimeSeconds: session.pickTimeSeconds,
        currentPickNo: session.currentPickNo,
        currentDraftTeamId: session.currentDraftTeamId,
        deadlineAt: session.deadlineAt,
        startedAt: session.startedAt,
        endedAt: session.endedAt,
      },
    ],
    adminMode,
  );
}

function calculateRemainingSeconds(
  snapshot: DraftLiveSnapshot | null,
  nowTickMs: number,
  serverOffsetMs: number,
) {
  if (!snapshot) {
    return 0;
  }

  const deadlineAt = toTimestamp(snapshot.session.deadlineAt);

  if (deadlineAt === null) {
    return Math.max(snapshot.currentTurn?.remainingSeconds ?? 0, 0);
  }

  const referenceNow = nowTickMs + serverOffsetMs;
  return Math.max(Math.ceil((deadlineAt - referenceNow) / 1000), 0);
}

function readServerOffsetMs(serverNow: string | null | undefined) {
  const timestamp = toTimestamp(serverNow);

  if (timestamp === null) {
    return 0;
  }

  return timestamp - Date.now();
}

function isStaleDraftSnapshot(
  currentSnapshot: DraftLiveSnapshot | null,
  incomingSnapshot: DraftLiveSnapshot,
) {
  if (!currentSnapshot || currentSnapshot.session.id !== incomingSnapshot.session.id) {
    return false;
  }

  if (
    currentSnapshot.session.status === "FINISHED" &&
    incomingSnapshot.session.status !== "FINISHED"
  ) {
    return true;
  }

  const currentServerNow = toTimestamp(currentSnapshot.session.serverNow);
  const incomingServerNow = toTimestamp(incomingSnapshot.session.serverNow);

  if (
    currentServerNow !== null &&
    incomingServerNow !== null &&
    incomingServerNow < currentServerNow
  ) {
    return true;
  }

  const currentPickNo = currentSnapshot.session.currentPickNo;
  const incomingPickNo = incomingSnapshot.session.currentPickNo;

  return (
    incomingServerNow === null &&
    typeof currentPickNo === "number" &&
    typeof incomingPickNo === "number" &&
    incomingPickNo < currentPickNo
  );
}

function parsePositiveSeconds(value: string, fallback?: number) {
  const trimmed = value.trim();

  if (!trimmed) {
    if (typeof fallback === "number") {
      return fallback;
    }

    throw new Error("초 단위를 입력해 달라.");
  }

  const parsed = Number(trimmed);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error("1초 이상의 정수를 입력해 달라.");
  }

  return parsed;
}

function getToneClassName(tone: NoticeTone) {
  if (tone === "success") {
    return "border border-success-ink/15 bg-success-soft text-success-ink";
  }

  if (tone === "error") {
    return "border border-danger-ink/15 bg-danger-soft text-danger-ink";
  }

  return "border border-line bg-surface-muted text-foreground";
}

function getStatusBadgeClassName(status: string | null | undefined) {
  switch (status) {
    case "LIVE":
      return "bg-success-soft text-success-ink";
    case "PAUSED":
      return "bg-danger-soft text-danger-ink";
    case "FINISHED":
      return "bg-surface-muted text-muted";
    default:
      return "bg-accent-soft text-accent-ink";
  }
}

type LocalDraftPreviewState = {
  candidateUserId: number;
  candidateName: string;
  race: string | null;
  cursorPosition: DraftLiveNormalizedPosition;
  cardPosition: DraftLiveNormalizedPosition;
  cardWidth: number;
  pointerOffsetPx: {
    x: number;
    y: number;
  };
};

type RemoteDraftPreviewState = {
  actorUserId: number;
  candidateUserId: number;
  cursorPosition: DraftLiveNormalizedPosition | null;
  cardPosition: DraftLiveNormalizedPosition | null;
  turnKey: string;
};

const REMOTE_PREVIEW_CARD_WIDTH_PX = 248;
const MIN_PREVIEW_CARD_WIDTH_PX = 220;
const MAX_PREVIEW_CARD_WIDTH_PX = 320;

function clampNormalizedCoordinate(value: number) {
  return Math.min(1, Math.max(0, value));
}

function toViewportNormalizedPosition(
  clientX: number,
  clientY: number,
): DraftLiveNormalizedPosition {
  const viewportWidth = Math.max(window.innerWidth, 1);
  const viewportHeight = Math.max(window.innerHeight, 1);

  return {
    x: clampNormalizedCoordinate(clientX / viewportWidth),
    y: clampNormalizedCoordinate(clientY / viewportHeight),
  };
}

function toViewportCardPosition(
  clientX: number,
  clientY: number,
  pointerOffsetPx: {
    x: number;
    y: number;
  },
) {
  return toViewportNormalizedPosition(
    clientX - pointerOffsetPx.x,
    clientY - pointerOffsetPx.y,
  );
}

function resolvePreviewCardWidth(width: number) {
  return Math.min(
    MAX_PREVIEW_CARD_WIDTH_PX,
    Math.max(MIN_PREVIEW_CARD_WIDTH_PX, Math.round(width)),
  );
}

function readPreviewAutoEndReason(options: {
  canPick: boolean;
  hasCurrentTurn: boolean;
  connectionState: ConnectionState;
  sessionStatus: string | null | undefined;
}): DraftLivePreviewEndReason {
  if (options.sessionStatus === "PAUSED") {
    return "SESSION_PAUSED";
  }

  if (options.sessionStatus === "FINISHED") {
    return "SESSION_FINISHED";
  }

  if (options.connectionState !== "connected") {
    return "DISCONNECTED";
  }

  if (!options.canPick || !options.hasCurrentTurn) {
    return "TURN_CHANGED";
  }

  return "RELEASED";
}

function isBlockedPreviewTarget(target: EventTarget | null) {
  return (
    target instanceof HTMLElement &&
    Boolean(
      target.closest(
        "button, a, input, textarea, select, [data-no-preview-drag='true']",
      ),
    )
  );
}

function PreviewCursor({
  actorUserId,
  position,
}: {
  actorUserId: number;
  position: DraftLiveNormalizedPosition | null;
}) {
  if (!position) {
    return null;
  }

  return (
    <div
      className="pointer-events-none fixed z-50 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center"
      style={{
        left: `${position.x * 100}vw`,
        top: `${position.y * 100}vh`,
      }}
    >
      <div className="h-3.5 w-3.5 rounded-full border-2 border-white bg-accent shadow-[0_16px_50px_rgba(23,33,43,0.08)]" />
      <div className="mt-2 rounded-full bg-foreground px-2.5 py-1 text-[11px] font-semibold text-white">
        드래프트 진행자 #{actorUserId}
      </div>
    </div>
  );
}

function PreviewGhostCard({
  actorLabel,
  candidateName,
  cardWidth,
  position,
  race,
  tone = "remote",
}: {
  actorLabel: string;
  candidateName: string;
  cardWidth: number;
  position: DraftLiveNormalizedPosition | null;
  race: string | null;
  tone?: "local" | "remote";
}) {
  if (!position) {
    return null;
  }

  return (
    <div
      className="pointer-events-none fixed z-40"
      style={{
        left: `${position.x * 100}vw`,
        top: `${position.y * 100}vh`,
        width: `${cardWidth}px`,
      }}
    >
      <div
        className={cn(
          "rounded-lg border px-4 py-4 shadow-[0_16px_50px_rgba(23,33,43,0.08)] backdrop-blur-sm",
          tone === "local"
            ? "border-accent/30 bg-white/92"
            : "border-line/80 bg-white/90",
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
              {actorLabel}
            </p>
            <p className="mt-1 truncate text-base font-semibold text-foreground">
              {candidateName}
            </p>
          </div>
          <span className="rounded-full bg-surface px-3 py-1 text-xs font-semibold text-muted">
            {race || "-"}
          </span>
        </div>
      </div>
    </div>
  );
}

function CompactTeamCard({
  candidateLookup,
  currentTeamId,
  draftTeam,
}: {
  candidateLookup: Record<number, CandidateDisplayInfo>;
  currentTeamId: number | null;
  draftTeam: DraftLiveTeam;
}) {
  const isCurrentTeam = draftTeam.id === currentTeamId;
  const pickerDisplayId = draftTeam.pickerUserLoginId?.trim() || "미지정";

  return (
    <article
      className={cn(
        "rounded-lg border px-4 py-4 shadow-[0_16px_50px_rgba(23,33,43,0.08)]",
        isCurrentTeam
          ? "border-accent/20 bg-[linear-gradient(180deg,rgba(217,238,247,0.72)_0%,rgba(255,255,255,0.95)_100%)]"
          : "border-line bg-surface-strong",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="truncate text-sm font-semibold text-foreground">{draftTeam.teamName}</p>
        <span className="text-[11px] text-muted">{draftTeam.roster.length}</span>
      </div>

      <p className="mt-2 text-[11px] text-muted">
        드래프트 진행자 : {pickerDisplayId}
      </p>

      <div className="mt-3 space-y-1.5">
        {draftTeam.roster.length === 0 ? (
          <p className="rounded-xl border border-dashed border-line px-3 py-3 text-xs text-muted">
            비어 있음
          </p>
        ) : (
          draftTeam.roster.map((player) => {
            const candidate = candidateLookup[player.candidateUserId];
            const candidateName = formatCandidateId(
              candidate?.candidateName ??
                player.candidateUserLoginId ??
                player.candidateName,
            );
            const tier = formatCandidateTier(candidate?.tier ?? player.tier);
            const race = formatCandidateRace(candidate?.race ?? player.race);

            return (
              <div
                key={`${draftTeam.id}-${player.pickNo}`}
                className="grid grid-cols-[minmax(0,1fr)_56px_56px] items-center gap-2 rounded-xl bg-surface-muted px-3 py-2 text-[11px]"
              >
                <span className="truncate font-semibold text-foreground">
                  {candidateName}
                </span>
                <span className="truncate text-muted">{tier}</span>
                <span className="truncate text-muted">{race}</span>
              </div>
            );
          })
        )}
      </div>
    </article>
  );
}

function CompactCandidateCard({
  canPick,
  canPreviewDrag,
  candidate,
  isDragging,
  pendingAction,
  onPick,
  onPreviewPointerDown,
}: {
  canPick: boolean;
  canPreviewDrag: boolean;
  candidate: DraftCandidate;
  isDragging: boolean;
  pendingAction: string | null;
  onPick: (candidateUserId: number) => Promise<void>;
  onPreviewPointerDown: (
    event: ReactPointerEvent<HTMLElement>,
    candidate: DraftCandidate,
  ) => void;
}) {
  const actionKey = `pick-${candidate.candidateUserId}`;
  const canInteractPreview = canPreviewDrag && pendingAction === null;

  return (
    <article
      className={cn(
        "rounded-lg border border-line bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(238,243,247,0.86)_100%)] px-4 py-4 shadow-[0_16px_50px_rgba(23,33,43,0.08)]",
        canInteractPreview && "cursor-grab touch-none select-none",
        isDragging && "cursor-grabbing opacity-45",
      )}
      onPointerDown={(event) => {
        if (!canInteractPreview) {
          return;
        }

        onPreviewPointerDown(event, candidate);
      }}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="min-w-0 truncate text-base font-semibold text-foreground">
          {buildCandidateDisplay(candidate)}
        </p>
        <Button
          data-no-preview-drag="true"
          variant="accent"
          disabled={!canPick || pendingAction !== null}
          onClick={() => {
            void onPick(candidate.candidateUserId);
          }}
          className="shrink-0 min-w-20 whitespace-nowrap"
        >
          {pendingAction === actionKey ? "지명 중" : "지명"}
        </Button>
      </div>
    </article>
  );
}

type DraftLiveDashboardProps = {
  adminMode?: boolean;
  hideSessionPicker?: boolean;
  refreshSignal?: number;
  sessionId?: number | null;
  variant?: "content" | "generic" | "proleague";
};

export function DraftLiveDashboard({
  adminMode = false,
  hideSessionPicker = false,
  refreshSignal = 0,
  sessionId = null,
  variant = "generic",
}: DraftLiveDashboardProps) {
  const { isAuthenticated, status, user } = useAuth();
  const fixedSessionId = typeof sessionId === "number" ? sessionId : null;
  const [sessions, setSessions] = useState<DraftSessionSummary[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(
    fixedSessionId,
  );
  const [snapshot, setSnapshot] = useState<DraftLiveSnapshot | null>(null);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [loadingSnapshot, setLoadingSnapshot] = useState(false);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [notice, setNotice] = useState<NoticeState | null>(null);
  const [auxiliaryState, setAuxiliaryState] =
    useState<DraftLiveAuxiliaryState>(() =>
      createDraftLiveAuxiliaryState(fixedSessionId),
    );
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [extendSeconds, setExtendSeconds] = useState("30");
  const [connectionState, setConnectionState] =
    useState<ConnectionState>("disconnected");
  const [serverOffsetMs, setServerOffsetMs] = useState(0);
  const [nowTickMs, setNowTickMs] = useState(() => Date.now());
  const [remotePreviews, setRemotePreviews] = useState<
    Record<number, RemoteDraftPreviewState>
  >({});
  const [localPreview, setLocalPreview] = useState<LocalDraftPreviewState | null>(
    null,
  );
  const sessionsRequestRef = useRef(0);
  const snapshotRequestRef = useRef(0);
  const draftSessionConnectionRef =
    useRef<ReturnType<typeof subscribeToDraftSession> | null>(null);
  const localPreviewRef = useRef<LocalDraftPreviewState | null>(null);
  const pendingLocalPreviewRef = useRef<LocalDraftPreviewState | null>(null);
  const localPreviewAnimationFrameRef = useRef<number | null>(null);
  const localPreviewCleanupRef = useRef<(() => void) | null>(null);
  const snapshotRef = useRef<DraftLiveSnapshot | null>(null);
  const canPickRef = useRef(false);
  const currentPreviewKeyRef = useRef<string | null>(null);
  const dashboardLabel =
    variant === "content"
      ? "팀배/컨텐츠 드래프트"
      : variant === "proleague"
        ? "프로리그 드래프트"
        : "드래프트 라이브";
  const loginHref = buildLoginHref({
    redirectTo:
      selectedSessionId !== null
        ? proleagueDraftLivePath(selectedSessionId)
        : "/proleague/draft",
  });
  const scopedAuxiliaryState =
    auxiliaryState.sessionId === selectedSessionId
      ? auxiliaryState
      : createDraftLiveAuxiliaryState(selectedSessionId);
  const activityLog = scopedAuxiliaryState.activityLog;

  function readCurrentAuxiliaryState(currentState: DraftLiveAuxiliaryState) {
    return currentState.sessionId === selectedSessionId
      ? currentState
      : createDraftLiveAuxiliaryState(selectedSessionId);
  }

  function clearLocalPreviewAnimationFrame() {
    if (localPreviewAnimationFrameRef.current === null) {
      return;
    }

    window.cancelAnimationFrame(localPreviewAnimationFrameRef.current);
    localPreviewAnimationFrameRef.current = null;
  }

  function clearLocalPreviewListeners() {
    if (!localPreviewCleanupRef.current) {
      return;
    }

    localPreviewCleanupRef.current();
    localPreviewCleanupRef.current = null;
  }

  function resetLocalPreviewState() {
    clearLocalPreviewAnimationFrame();
    clearLocalPreviewListeners();
    pendingLocalPreviewRef.current = null;
    localPreviewRef.current = null;
    setLocalPreview(null);
  }

  function pushActivityLog(item: ActivityLogItem) {
    setAuxiliaryState((currentState) => {
      const nextState = readCurrentAuxiliaryState(currentState);

      if (
        nextState.activityLog.some((currentItem) => currentItem.id === item.id)
      ) {
        return nextState;
      }

      return {
        ...nextState,
        activityLog: [item, ...nextState.activityLog].slice(0, 10),
      };
    });
  }

  function handleAiAdviceEvent(event: DraftLiveEvent) {
    const adviceItem = buildAiAdviceDisplayItem(event);

    if (!adviceItem) {
      return;
    }

    if (event.type === AI_PICK_REVIEW_READY) {
      pushActivityLog({
        id: adviceItem.id,
        message: formatAiAdviceLogMessage(adviceItem),
        occurredAt: adviceItem.occurredAt,
      });
      return;
    }

    if (event.type === AI_RECOMMENDATION_READY) {
      const matchesCurrentTurn = isCurrentTurnRecommendation(
        adviceItem,
        snapshotRef.current,
      );

      if (matchesCurrentTurn) {
        pushActivityLog({
          id: adviceItem.id,
          message: formatAiAdviceLogMessage(adviceItem),
          occurredAt: adviceItem.occurredAt,
        });
        return;
      }

      pushActivityLog({
        id: adviceItem.id,
        message: formatAiAdviceLogMessage(adviceItem, {
          staleRecommendation: !matchesCurrentTurn,
        }),
        occurredAt: adviceItem.occurredAt,
      });
    }
  }

  function endLocalPreview(endReason: DraftLivePreviewEndReason) {
    const activePreview = localPreviewRef.current;

    clearLocalPreviewAnimationFrame();
    clearLocalPreviewListeners();
    pendingLocalPreviewRef.current = null;
    localPreviewRef.current = null;
    setLocalPreview(null);

    if (!activePreview) {
      return;
    }

    draftSessionConnectionRef.current?.sendPreview({
      candidateUserId: activePreview.candidateUserId,
      phase: "END",
      endReason,
      cursorPosition: activePreview.cursorPosition,
      cardPosition: activePreview.cardPosition,
    });
  }

  function scheduleLocalPreviewMove(clientX: number, clientY: number) {
    const activePreview = localPreviewRef.current;

    if (!activePreview) {
      return;
    }

    pendingLocalPreviewRef.current = {
      ...activePreview,
      cursorPosition: toViewportNormalizedPosition(clientX, clientY),
      cardPosition: toViewportCardPosition(
        clientX,
        clientY,
        activePreview.pointerOffsetPx,
      ),
    };

    if (localPreviewAnimationFrameRef.current !== null) {
      return;
    }

    localPreviewAnimationFrameRef.current = window.requestAnimationFrame(() => {
      localPreviewAnimationFrameRef.current = null;
      const nextPreview = pendingLocalPreviewRef.current;

      if (!nextPreview) {
        return;
      }

      pendingLocalPreviewRef.current = null;
      localPreviewRef.current = nextPreview;
      setLocalPreview(nextPreview);
      draftSessionConnectionRef.current?.sendPreview({
        candidateUserId: nextPreview.candidateUserId,
        phase: "MOVE",
        cursorPosition: nextPreview.cursorPosition,
        cardPosition: nextPreview.cardPosition,
      });
    });
  }

  function handleCandidatePreviewPointerDown(
    event: ReactPointerEvent<HTMLElement>,
    candidate: DraftCandidate,
  ) {
    if (isBlockedPreviewTarget(event.target)) {
      return;
    }

    if (!event.isPrimary || event.button !== 0) {
      return;
    }

    const cardElement = event.currentTarget;
    const cardRect = cardElement.getBoundingClientRect();
    const pointerOffsetPx = {
      x: event.clientX - cardRect.left,
      y: event.clientY - cardRect.top,
    };
    const nextPreview: LocalDraftPreviewState = {
      candidateUserId: candidate.candidateUserId,
      candidateName: formatCandidateLoginId(candidate),
      race: candidate.race,
      cursorPosition: toViewportNormalizedPosition(event.clientX, event.clientY),
      cardPosition: toViewportCardPosition(
        event.clientX,
        event.clientY,
        pointerOffsetPx,
      ),
      cardWidth: resolvePreviewCardWidth(cardRect.width),
      pointerOffsetPx,
    };

    event.preventDefault();
    clearLocalPreviewAnimationFrame();
    clearLocalPreviewListeners();
    pendingLocalPreviewRef.current = null;
    localPreviewRef.current = nextPreview;
    setLocalPreview(nextPreview);
    draftSessionConnectionRef.current?.sendPreview({
      candidateUserId: nextPreview.candidateUserId,
      phase: "START",
      cursorPosition: nextPreview.cursorPosition,
      cardPosition: nextPreview.cardPosition,
    });

    const handlePointerMove = (moveEvent: PointerEvent) => {
      scheduleLocalPreviewMove(moveEvent.clientX, moveEvent.clientY);
    };
    const handlePointerUp = () => {
      endLocalPreview("RELEASED");
    };
    const handlePointerCancel = () => {
      endLocalPreview("CURSOR_LEFT");
    };
    const handleWindowMouseOut = (moveEvent: MouseEvent) => {
      if (moveEvent.relatedTarget === null) {
        endLocalPreview("CURSOR_LEFT");
      }
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        endLocalPreview("CURSOR_LEFT");
      }
    };
    const handleBlur = () => {
      endLocalPreview("CURSOR_LEFT");
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerCancel);
    window.addEventListener("mouseout", handleWindowMouseOut);
    window.addEventListener("blur", handleBlur);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    localPreviewCleanupRef.current = () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerCancel);
      window.removeEventListener("mouseout", handleWindowMouseOut);
      window.removeEventListener("blur", handleBlur);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }

  useEffect(() => {
    if (fixedSessionId === null) {
      return;
    }

    startTransition(() => {
      setSelectedSessionId(fixedSessionId);
    });
  }, [fixedSessionId]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNowTickMs(Date.now());
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, [refreshSignal]);

  useEffect(() => {
    snapshotRef.current = snapshot;
  }, [snapshot]);

  useEffect(() => {
    if (fixedSessionId !== null) {
      startTransition(() => {
        setLoadingSessions(false);
        setSessions([]);
        setSelectedSessionId(fixedSessionId);
      });
      return;
    }

    let cancelled = false;
    const requestId = sessionsRequestRef.current + 1;
    sessionsRequestRef.current = requestId;

    async function loadSessions() {
      try {
        const nextSessions = filterSessionsForView(
          await listDraftSessions(),
          adminMode,
        );

        if (cancelled || sessionsRequestRef.current !== requestId) {
          return;
        }

        startTransition(() => {
          setSessions(nextSessions);
          setSelectedSessionId((currentSessionId) => {
            if (nextSessions.length === 0) {
              return null;
            }

            if (currentSessionId !== null) {
              const stillExists = nextSessions.some(
                (session) => session.id === currentSessionId,
              );

              if (stillExists) {
                return currentSessionId;
              }
            }

            return chooseInitialSessionId(nextSessions);
          });
        });

        if (nextSessions.length === 0) {
          setNotice({
            tone: "neutral",
            text:
              variant === "content"
                ? "등록된 팀배/컨텐츠 드래프트가 없다. 관리자 화면에서 먼저 드래프트를 만들어 달라."
                : "등록된 드래프트가 없다. 관리자 화면에서 먼저 드래프트를 만들어 달라.",
          });
        }
      } catch (error) {
        if (cancelled || sessionsRequestRef.current !== requestId) {
          return;
        }

        setNotice({
          tone: "error",
          text: readErrorMessage(error),
        });
      } finally {
        if (!cancelled && sessionsRequestRef.current === requestId) {
          setLoadingSessions(false);
        }
      }
    }

    void loadSessions();

    return () => {
      cancelled = true;
    };
  }, [adminMode, fixedSessionId, refreshSignal, variant]);

  useEffect(() => {
    if (fixedSessionId !== null) {
      return;
    }

    if (selectedSessionId === null) {
      return;
    }

    const stillExists = sessions.some((session) => session.id === selectedSessionId);

    if (stillExists) {
      return;
    }

    const nextSelectedSessionId = chooseInitialSessionId(sessions);

    startTransition(() => {
      setSelectedSessionId(nextSelectedSessionId);
      setSnapshot((currentSnapshot) =>
        currentSnapshot?.session.id === selectedSessionId ? null : currentSnapshot,
      );
      setServerOffsetMs(0);
      setConnectionState("disconnected");
      setRemotePreviews({});
    });
    const resetTimer = window.setTimeout(() => {
      resetLocalPreviewState();
    }, 0);

    return () => {
      window.clearTimeout(resetTimer);
    };
  }, [fixedSessionId, selectedSessionId, sessions]);

  async function syncAfterSessionRemoval(missingSessionId: number) {
    if (fixedSessionId !== null) {
      startTransition(() => {
        setSelectedSessionId(null);
        setSnapshot((currentSnapshot) =>
          currentSnapshot?.session.id === missingSessionId ? null : currentSnapshot,
        );
        setServerOffsetMs(0);
        setConnectionState("disconnected");
        setRemotePreviews({});
      });
      resetLocalPreviewState();
      return;
    }

    const nextSessions = filterSessionsForView(await listDraftSessions(), adminMode);
    const nextSelectedSessionId = chooseInitialSessionId(nextSessions);

    startTransition(() => {
      setSessions(nextSessions);
      setSelectedSessionId((currentSessionId) =>
        currentSessionId === missingSessionId ? nextSelectedSessionId : currentSessionId,
      );
      setSnapshot((currentSnapshot) =>
        currentSnapshot?.session.id === missingSessionId ? null : currentSnapshot,
      );
      setServerOffsetMs(0);
      setConnectionState("disconnected");
      setRemotePreviews({});
    });
    resetLocalPreviewState();
  }

  useEffect(() => {
    if (selectedSessionId === null) {
      startTransition(() => {
        setSnapshot(null);
      });
      return;
    }

    const sessionId = selectedSessionId;
    let cancelled = false;
    const requestId = snapshotRequestRef.current + 1;
    snapshotRequestRef.current = requestId;
    startTransition(() => {
      setLoadingSnapshot(true);
    });

    async function loadSnapshot() {
      try {
        const nextSnapshot = await getDraftSnapshot(sessionId);

        if (cancelled || snapshotRequestRef.current !== requestId) {
          return;
        }

        snapshotRef.current = nextSnapshot;
        startTransition(() => {
          setSnapshot(nextSnapshot);
          setServerOffsetMs(readServerOffsetMs(nextSnapshot.session.serverNow));
          setSessions((currentSessions) =>
            mergeSessionSummary(currentSessions, nextSnapshot.session, adminMode),
          );
        });
      } catch (error) {
        if (cancelled || snapshotRequestRef.current !== requestId) {
          return;
        }

        if (fixedSessionId !== null && isMissingSessionError(error)) {
          setSnapshot(null);
          setSelectedSessionId(null);
          setNotice({
            tone: "neutral",
            text: "선택한 드래프트를 찾을 수 없습니다.",
          });
          return;
        }

        if (isMissingSessionError(error)) {
          await syncAfterSessionRemoval(sessionId).catch(() => undefined);
          setNotice({
            tone: "neutral",
            text: "선택한 드래프트가 삭제되어 목록에서 제거했습니다.",
          });
          return;
        }

        setNotice({
          tone: "error",
          text: readErrorMessage(error),
        });
      } finally {
        if (!cancelled && snapshotRequestRef.current === requestId) {
          setLoadingSnapshot(false);
        }
      }
    }

    void loadSnapshot();

    return () => {
      cancelled = true;
    };
  }, [fixedSessionId, selectedSessionId, refreshSignal]);

  useEffect(() => {
    if (selectedSessionId === null) {
      return;
    }

    const sessionId = selectedSessionId;

    const connection = subscribeToDraftSession({
      sessionId,
      onStateChange: (state) => {
        setConnectionState(state);

        if (state !== "connected" && localPreviewRef.current) {
          endLocalPreview("DISCONNECTED");
        }
      },
      onError: (message) => {
        setNotice({
          tone: "error",
          text: message,
        });
      },
      onEvent: (event) => {
        if (event.type === "DRAG_PREVIEW" && event.preview) {
          const actorUserId = event.actorUserId;
          const preview = event.preview;

          if (typeof actorUserId !== "number" || canPickRef.current) {
            return;
          }

          if (preview.phase === "END") {
            setRemotePreviews((currentPreviews) => {
              if (!currentPreviews[actorUserId]) {
                return currentPreviews;
              }

              const nextPreviews = { ...currentPreviews };
              delete nextPreviews[actorUserId];
              return nextPreviews;
            });
            return;
          }

          const turnKey = currentPreviewKeyRef.current;

          if (!turnKey) {
            return;
          }

          setRemotePreviews((currentPreviews) => ({
            ...currentPreviews,
            [actorUserId]: {
              actorUserId,
              candidateUserId: preview.candidateUserId,
              cursorPosition: preview.cursorPosition,
              cardPosition: preview.cardPosition,
              turnKey,
            },
          }));
          return;
        }

        if (isAiAdviceEvent(event)) {
          handleAiAdviceEvent(event);
          return;
        }

        if (event.snapshot) {
          const broadcastSnapshot = event.snapshot;
          const nextPermissions =
            broadcastSnapshot.permissions ??
            buildLocalPermissions(broadcastSnapshot, user);
          const nextSnapshot = {
            ...broadcastSnapshot,
            permissions: nextPermissions ?? snapshotRef.current?.permissions ?? null,
          };

          if (isStaleDraftSnapshot(snapshotRef.current, nextSnapshot)) {
            return;
          }

          if (
            localPreviewRef.current &&
            (nextSnapshot.session.status !== "LIVE" ||
              !nextPermissions.canPick ||
              nextSnapshot.currentTurn === null)
          ) {
            endLocalPreview(
              readPreviewAutoEndReason({
                canPick: nextPermissions.canPick,
                hasCurrentTurn: nextSnapshot.currentTurn !== null,
                connectionState: "connected",
                sessionStatus: nextSnapshot.session.status,
              }),
            );
          }

          snapshotRef.current = nextSnapshot;
          startTransition(() => {
            setSnapshot(nextSnapshot);
            setServerOffsetMs(readServerOffsetMs(nextSnapshot.session.serverNow));
            setSessions((currentSessions) =>
              mergeSessionSummary(
                currentSessions,
                nextSnapshot.session,
                adminMode,
              ),
            );
          });

        }

        const activityMessage = formatActivityLogMessage(
          event,
          event.snapshot ?? snapshotRef.current,
        );

        if (activityMessage) {
          pushActivityLog({
            id: buildActivityLogId(event),
            message: activityMessage,
            occurredAt: event.occurredAt ?? event.serverNow,
          });
        }
      },
    });
    draftSessionConnectionRef.current = connection;

    return () => {
      if (draftSessionConnectionRef.current === connection) {
        endLocalPreview("DISCONNECTED");
        draftSessionConnectionRef.current = null;
      } else {
        resetLocalPreviewState();
      }

      setRemotePreviews({});
      connection.unsubscribe();
    };
  }, [adminMode, selectedSessionId, user]);

  async function runSnapshotAction(
    actionKey: string,
    request: () => Promise<DraftLiveSnapshot>,
  ) {
    setPendingAction(actionKey);
    setNotice(null);

    try {
      const nextSnapshot = await request();

      if (isStaleDraftSnapshot(snapshotRef.current, nextSnapshot)) {
        return;
      }

      snapshotRef.current = nextSnapshot;
      startTransition(() => {
        setSnapshot(nextSnapshot);
        setServerOffsetMs(readServerOffsetMs(nextSnapshot.session.serverNow));
        setSessions((currentSessions) =>
          mergeSessionSummary(currentSessions, nextSnapshot.session, adminMode),
        );
      });
    } catch (error) {
      if (selectedSessionId !== null && isMissingSessionError(error)) {
        await syncAfterSessionRemoval(selectedSessionId).catch(() => undefined);
        setNotice({
          tone: "neutral",
          text: "선택한 드래프트가 삭제되어 목록에서 제거했습니다.",
        });
        return;
      }

      setNotice({
        tone: "error",
        text: readErrorMessage(error),
      });
    } finally {
      setPendingAction(null);
    }
  }

  async function handlePick(candidateUserId: number) {
    if (selectedSessionId === null) {
      return;
    }

    if (!snapshot?.currentTurn) {
      return;
    }

    endLocalPreview("RELEASED");
    const sessionId = selectedSessionId;
    await runSnapshotAction(
      `pick-${candidateUserId}`,
      () => pickDraftCandidate(sessionId, candidateUserId),
    );
  }

  const filteredCandidates = snapshot?.availableCandidates.filter((candidate) => {
    const keyword = deferredSearch.trim().toLowerCase();

    if (!keyword) {
      return true;
    }

    return (candidate.candidateUserLoginId ?? candidate.candidateName)
      .toLowerCase()
      .includes(keyword);
  }) ?? [];

  const teams = sortTeams(snapshot?.teams ?? []);
  const totalCandidates =
    (snapshot?.availableCandidates.length ?? 0) +
    (snapshot?.pickedCandidates.length ?? 0);
  const currentTeamId =
    snapshot?.currentTurn?.teamId ?? snapshot?.session.currentDraftTeamId ?? null;
  const currentTeam = teams.find((team) => team.id === currentTeamId) ?? null;
  const currentPickerDisplayId = currentTeam?.pickerUserLoginId?.trim() || null;
  const canPick = snapshot?.permissions?.canPick ?? false;
  const canAdminControl = isDraftAdminRole(user?.role);
  const isBusy = pendingAction !== null;
  const canSkipCurrentTurn =
    Boolean(snapshot?.currentTurn) &&
    snapshot?.session.status === "LIVE" &&
    canPick;
  const remainingSeconds = calculateRemainingSeconds(
    snapshot,
    nowTickMs,
    serverOffsetMs,
  );
  const timerProgressPercent =
    snapshot?.session.status === "LIVE" && snapshot.currentTurn
      ? Math.max(
          0,
          Math.min(
            100,
            (remainingSeconds / Math.max(snapshot.session.pickTimeSeconds, 1)) *
              100,
          ),
        )
      : 0;
  const canPreviewDrag =
    canPick &&
    !isBusy &&
    snapshot?.session.status === "LIVE" &&
    snapshot?.currentTurn !== null &&
    connectionState === "connected";
  const currentPreviewKey =
    selectedSessionId !== null &&
    snapshot?.session.status === "LIVE" &&
    snapshot?.currentTurn !== null &&
    typeof snapshot.session.currentPickNo === "number"
      ? `${selectedSessionId}:${snapshot.session.currentPickNo}`
      : null;
  const candidateSources = [
    ...(snapshot?.availableCandidates ?? []).map((candidate) => ({
      candidateUserId: candidate.candidateUserId,
      candidateName: formatCandidateLoginId(candidate),
      tier: candidate.tier ?? null,
      race: candidate.race ?? null,
    })),
    ...(snapshot?.pickedCandidates ?? []).map((candidate) => ({
      candidateUserId: candidate.candidateUserId,
      candidateName: formatCandidateLoginId(candidate),
      tier: candidate.tier ?? null,
      race: candidate.race ?? null,
    })),
    ...teams.flatMap((team) =>
      team.roster.map((player) => ({
        candidateUserId: player.candidateUserId,
        candidateName: formatCandidateLoginId(player),
        tier: player.tier ?? null,
        race: player.race ?? null,
      })),
    ),
  ].reduce<CandidateDisplaySource[]>((sources, source) => {
    if (
      sources.some(
        (current) => current.candidateUserId === source.candidateUserId,
      )
    ) {
      return sources;
    }

    sources.push(source);
    return sources;
  }, []);
  const candidateLookup = candidateSources.reduce<
    Record<number, CandidateDisplayInfo>
  >((lookup, candidate) => {
    lookup[candidate.candidateUserId] = {
      candidateName: candidate.candidateName,
      tier: candidate.tier,
      race: candidate.race,
    };
    return lookup;
  }, {});
  const remotePreviewEntries = currentPreviewKey
    ? Object.values(remotePreviews).filter(
        (preview) => preview.turnKey === currentPreviewKey,
      )
    : [];

  useEffect(() => {
    canPickRef.current = canPick;
  }, [canPick]);

  useEffect(() => {
    currentPreviewKeyRef.current = currentPreviewKey;
  }, [currentPreviewKey]);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <SurfaceCard className="p-6">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-3">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-accent">
                  {dashboardLabel}
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={cn(
                      "rounded-full px-3 py-1 text-xs font-semibold",
                      getStatusBadgeClassName(snapshot?.session.status),
                    )}
                  >
                    {snapshot
                      ? formatDraftStatus(snapshot.session.status)
                      : "드래프트 선택 대기"}
                  </span>
                  <span className="rounded-full bg-surface-muted px-3 py-1 text-xs text-muted">
                    {CONNECTION_LABELS[connectionState]}
                  </span>
                </div>
              </div>
              <h2 className="mt-4 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
                {snapshot?.currentTurn
                  ? `${currentPickerDisplayId ?? "드래프트 진행자 미지정"} 차례`
                  : "진행 중인 차례 없음"}
              </h2>
              {!isAuthenticated && status !== "loading" ? (
                <p className="mt-3 text-sm text-muted">
                  <Link href={loginHref} className="font-semibold text-accent">
                    로그인
                  </Link>
                  하면 팀장 권한으로 참여할 수 있습니다.
                </p>
              ) : null}
            </div>

            <div className="w-full max-w-sm space-y-3">
              {hideSessionPicker ? null : (
                <select
                  className="w-full rounded-lg border border-line-strong bg-surface px-4 py-3 text-sm text-foreground outline-none transition-colors focus:border-accent focus:bg-white"
                  value={selectedSessionId ?? ""}
                  onChange={(event) => {
                    const nextSessionId = event.target.value
                      ? Number(event.target.value)
                      : null;
                    setSelectedSessionId(nextSessionId);
                  }}
                >
                  {loadingSessions && sessions.length === 0 ? (
                    <option value="">드래프트 목록 불러오는 중</option>
                  ) : sessions.length === 0 ? (
                    <option value="">드래프트 없음</option>
                  ) : null}

                  {sessions.map((session) => (
                    <option key={session.id} value={session.id}>
                      {session.title} · {formatDraftStatus(session.status)}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>

          <div
            className="mt-7 rounded-lg border border-line/70 bg-white/70 px-6 py-5"
            aria-label={`남은 시간 ${remainingSeconds}초`}
          >
            <div className="flex items-center gap-5">
              <div className="relative h-16 w-16 shrink-0">
                <div className="absolute bottom-1 left-1 h-12 w-12 rounded-full bg-foreground shadow-[inset_-10px_-10px_0_rgba(255,255,255,0.12),0_10px_24px_-14px_rgba(23,33,43,0.24)]" />
                <div className="absolute left-11 top-2 h-5 w-3 rotate-45 rounded-full bg-foreground" />
                <div className="absolute left-12 top-0 h-4 w-5 rounded-full bg-danger-ink" />
              </div>
              <div className="relative h-12 min-w-0 flex-1 overflow-visible">
                <div className="absolute left-0 top-1/2 h-4 w-full -translate-y-1/2 rounded-full bg-[repeating-linear-gradient(90deg,#b9b0a7_0_12px,#8f867d_12px_22px)] opacity-45" />
                <div
                  className="absolute left-0 top-1/2 h-5 -translate-y-1/2 rounded-full bg-[repeating-linear-gradient(90deg,#41352d_0_12px,#2b221e_12px_22px)] shadow-[inset_0_2px_3px_rgba(255,255,255,0.18),0_0_18px_rgba(196,82,48,0.2)] transition-[width] duration-500"
                  style={{ width: `${timerProgressPercent}%` }}
                />
                {timerProgressPercent > 0 ? (
                  <span
                    className="draft-fuse-fire absolute top-1/2 h-12 w-12 -translate-y-1/2"
                    style={{
                      left: `clamp(0rem, calc(${timerProgressPercent}% - 1.5rem), calc(100% - 3rem))`,
                    }}
                  >
                    <span className="draft-flame draft-flame-outer" />
                    <span className="draft-flame draft-flame-inner" />
                    <span className="draft-spark draft-spark-one" />
                    <span className="draft-spark draft-spark-two" />
                    <span className="draft-spark draft-spark-three" />
                    <span className="draft-smoke draft-smoke-one" />
                    <span className="draft-smoke draft-smoke-two" />
                  </span>
                ) : null}
              </div>
            </div>
          </div>

          {notice ? (
            <div
              className={cn(
                "mt-5 rounded-lg px-4 py-3 text-sm",
                getToneClassName(notice.tone),
              )}
            >
              {notice.text}
            </div>
          ) : null}

          {activityLog.length > 0 ? (
            <div className="mt-6 space-y-2">
              {activityLog.map((item) => (
                <div
                  key={item.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-surface px-4 py-3"
                >
                  <p className="text-sm font-semibold text-foreground">
                    {item.message}
                  </p>
                  <span className="text-xs text-muted">
                    {formatDateTime(item.occurredAt)}
                  </span>
                </div>
              ))}
            </div>
          ) : null}
        </SurfaceCard>

        <SurfaceCard className="self-start p-6">
          <p className="text-sm font-semibold text-foreground">드래프트 제어</p>

          {snapshot ? (
            <div className="mt-5 space-y-4">
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
                <Button
                  variant="accent"
                  disabled={
                    !canAdminControl ||
                    isBusy ||
                    !["READY", "PAUSED"].includes(snapshot.session.status)
                  }
                  onClick={() => {
                    const sessionId = selectedSessionId;

                    if (sessionId === null) {
                      return;
                    }

                    if (snapshot.session.status === "PAUSED") {
                      void runSnapshotAction("resume", () =>
                        resumeDraftSession(sessionId),
                      );
                      return;
                    }

                    void runSnapshotAction("start", () =>
                      startDraftSession(sessionId),
                    );
                  }}
                >
                  {pendingAction === "resume"
                    ? "이어 진행 중"
                    : pendingAction === "start"
                      ? "시작 중"
                      : snapshot.session.status === "PAUSED"
                        ? "이어 진행"
                        : "시작"}
                </Button>

                <Button
                  disabled={
                    !canAdminControl ||
                    isBusy ||
                    snapshot.session.status !== "LIVE"
                  }
                  onClick={() => {
                    const sessionId = selectedSessionId;

                    if (sessionId === null) {
                      return;
                    }

                    void runSnapshotAction("pause", () =>
                      pauseDraftSession(sessionId),
                    );
                  }}
                >
                  {pendingAction === "pause" ? "정지 중" : "일시정지"}
                </Button>
              </div>

              <div className="rounded-lg border border-line bg-surface px-4 py-4">
                <p className="text-sm font-semibold text-foreground">현재 턴 연장</p>
                <div className="mt-3 flex gap-2">
                  <Input
                    type="number"
                    min={1}
                    value={extendSeconds}
                    onChange={(event) => setExtendSeconds(event.target.value)}
                    placeholder="30"
                  />
                  <Button
                    disabled={
                      !canAdminControl ||
                      isBusy ||
                      snapshot.session.status !== "LIVE"
                    }
                    onClick={() => {
                      const sessionId = selectedSessionId;

                      if (sessionId === null) {
                        return;
                      }

                      try {
                        const seconds = parsePositiveSeconds(extendSeconds);

                        void runSnapshotAction("extend", () =>
                          extendDraftTurn(sessionId, seconds),
                        );
                      } catch (error) {
                        setNotice({
                          tone: "error",
                          text: readErrorMessage(error),
                        });
                      }
                    }}
                  >
                    {pendingAction === "extend" ? "연장 중" : "연장"}
                  </Button>
                </div>
              </div>

              <Button
                className="w-full"
                variant="danger"
                disabled={!canSkipCurrentTurn || isBusy}
                onClick={() => {
                  const sessionId = selectedSessionId;

                  if (sessionId === null) {
                    return;
                  }

                  void runSnapshotAction("skip", () =>
                    skipDraftTurn(sessionId, "manual"),
                  );
                }}
              >
                {pendingAction === "skip" ? "처리 중" : "지명 포기"}
              </Button>

              {!canAdminControl ? (
                <p className="rounded-[18px] bg-surface-muted px-4 py-3 text-sm leading-7 text-muted">
                  관리자 권한 계정만 드래프트를 제어할 수 있습니다.
                </p>
              ) : null}
            </div>
          ) : (
            <p className="mt-4 text-sm leading-7 text-muted">
              드래프트를 선택해 달라.
            </p>
          )}
        </SurfaceCard>
      </div>

      {selectedSessionId !== null ? (
        <>
          <SurfaceCard className="p-5 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-xl font-semibold text-foreground">
                남아있는 선수
              </h2>

              <div className="w-full max-w-xs">
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="ID 검색"
                />
              </div>
            </div>

            {loadingSnapshot && !snapshot ? (
              <div className="mt-5 space-y-3">
                <div className="h-20 rounded-lg bg-surface-muted" />
                <div className="h-20 rounded-lg bg-surface-muted" />
              </div>
            ) : (
              <div className="mt-5 grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
                {filteredCandidates.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-line px-5 py-10 text-center text-sm leading-7 text-muted md:col-span-2 2xl:col-span-3">
                    {snapshot && snapshot.availableCandidates.length === 0
                      ? "남아 있는 드래프트 인원이 없다."
                      : "검색 조건에 맞는 드래프트 인원이 없다."}
                  </div>
                ) : (
                  filteredCandidates.map((candidate) => {
                    const displayInfo = candidateLookup[candidate.candidateUserId];

                    return (
                      <CompactCandidateCard
                        key={candidate.candidateUserId}
                        canPick={canPick}
                        canPreviewDrag={canPreviewDrag}
                        candidate={{
                          ...candidate,
                          candidateName:
                            displayInfo?.candidateName ??
                            formatCandidateLoginId(candidate),
                          tier: displayInfo?.tier ?? candidate.tier,
                          race: displayInfo?.race ?? candidate.race,
                        }}
                        isDragging={
                          localPreview?.candidateUserId ===
                          candidate.candidateUserId
                        }
                        pendingAction={pendingAction}
                        onPick={handlePick}
                        onPreviewPointerDown={handleCandidatePreviewPointerDown}
                      />
                    );
                  })
                )}
              </div>
            )}
          </SurfaceCard>

          <SurfaceCard className="p-5 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-xl font-semibold text-foreground">현황</h2>
              {snapshot ? (
                <span className="rounded-full bg-surface-muted px-3 py-1 text-xs text-muted">
                  지명 {snapshot.pickedCandidates.length} / {totalCandidates}
                </span>
              ) : null}
            </div>

            <div className="mt-5 grid gap-4 xl:grid-cols-2">
              {teams.length > 0 ? (
                teams.map((team) => (
                  <CompactTeamCard
                    candidateLookup={candidateLookup}
                    key={team.id}
                    currentTeamId={currentTeamId}
                    draftTeam={team}
                  />
                ))
              ) : (
                <p className="rounded-lg border border-dashed border-line px-5 py-10 text-center text-sm leading-7 text-muted xl:col-span-2">
                  표시할 팀이 없습니다.
                </p>
              )}
            </div>
          </SurfaceCard>
        </>
      ) : null}

      {localPreview ? (
        <PreviewGhostCard
          actorLabel="Preview"
          candidateName={localPreview.candidateName}
          cardWidth={localPreview.cardWidth}
          position={localPreview.cardPosition}
          race={localPreview.race}
          tone="local"
        />
      ) : null}

      {remotePreviewEntries.map((preview) => {
        const candidate = candidateLookup[preview.candidateUserId];

        return (
          <div key={preview.actorUserId}>
            <PreviewCursor
              actorUserId={preview.actorUserId}
              position={preview.cursorPosition}
            />
            <PreviewGhostCard
              actorLabel={`드래프트 진행자 #${preview.actorUserId}`}
              candidateName={
                candidate?.candidateName ?? `Candidate #${preview.candidateUserId}`
              }
              cardWidth={REMOTE_PREVIEW_CARD_WIDTH_PX}
              position={preview.cardPosition}
              race={candidate?.race ?? null}
            />
          </div>
        );
      })}
      <style>{`
        @keyframes draft-flame-outer {
          0% {
            transform: translate(-50%, -52%) rotate(-11deg) scale(0.9, 1.05);
            opacity: 0.88;
          }
          28% {
            transform: translate(-49%, -56%) rotate(7deg) scale(1.1, 0.94);
            opacity: 1;
          }
          58% {
            transform: translate(-52%, -50%) rotate(-3deg) scale(0.96, 1.18);
            opacity: 0.92;
          }
          100% {
            transform: translate(-50%, -52%) rotate(-11deg) scale(0.9, 1.05);
            opacity: 0.88;
          }
        }

        @keyframes draft-flame-inner {
          0% {
            transform: translate(-50%, -48%) rotate(8deg) scale(0.82, 1.04);
            opacity: 0.96;
          }
          40% {
            transform: translate(-51%, -55%) rotate(-9deg) scale(1.02, 0.88);
            opacity: 1;
          }
          72% {
            transform: translate(-48%, -49%) rotate(3deg) scale(0.88, 1.16);
            opacity: 0.9;
          }
          100% {
            transform: translate(-50%, -48%) rotate(8deg) scale(0.82, 1.04);
            opacity: 0.96;
          }
        }

        @keyframes draft-spark-fly {
          0% {
            transform: translate(0, 0) scale(0.35);
            opacity: 0;
          }
          15% {
            opacity: 1;
          }
          100% {
            transform: translate(var(--spark-x), var(--spark-y)) scale(0);
            opacity: 0;
          }
        }

        @keyframes draft-smoke-rise {
          0% {
            transform: translate(0, 0) scale(0.4);
            opacity: 0;
          }
          20% {
            opacity: 0.45;
          }
          100% {
            transform: translate(var(--smoke-x), -34px) scale(1.35);
            opacity: 0;
          }
        }

        .draft-fuse-fire {
          pointer-events: none;
          filter: drop-shadow(0 0 10px rgba(239, 88, 42, 0.72))
            drop-shadow(0 0 22px rgba(255, 179, 71, 0.44));
        }

        .draft-flame {
          position: absolute;
          left: 50%;
          top: 50%;
          border-radius: 58% 42% 62% 38% / 64% 45% 55% 36%;
          transform-origin: 50% 82%;
        }

        .draft-flame-outer {
          width: 32px;
          height: 42px;
          background:
            radial-gradient(circle at 42% 31%, #fff7ad 0 12%, transparent 28%),
            radial-gradient(circle at 53% 55%, #ffb347 0 30%, #ef5b2f 52%, #9f281f 76%, transparent 78%);
          animation: draft-flame-outer 0.68s infinite ease-in-out;
        }

        .draft-flame-inner {
          width: 18px;
          height: 29px;
          background:
            radial-gradient(circle at 52% 34%, #ffffff 0 16%, #fff3a3 32%, #ff9b24 70%, transparent 72%);
          animation: draft-flame-inner 0.48s infinite ease-in-out;
        }

        .draft-spark {
          position: absolute;
          left: 23px;
          top: 22px;
          width: 5px;
          height: 5px;
          border-radius: 999px;
          background: #fff2a4;
          box-shadow: 0 0 8px rgba(255, 188, 64, 0.9);
          animation: draft-spark-fly 0.72s infinite ease-out;
        }

        .draft-spark-one {
          --spark-x: 28px;
          --spark-y: -20px;
        }

        .draft-spark-two {
          --spark-x: 15px;
          --spark-y: 19px;
          animation-delay: 0.17s;
        }

        .draft-spark-three {
          --spark-x: -12px;
          --spark-y: -18px;
          animation-delay: 0.33s;
        }

        .draft-smoke {
          position: absolute;
          left: 22px;
          top: 12px;
          width: 14px;
          height: 14px;
          border-radius: 999px;
          background: rgba(66, 72, 69, 0.32);
          filter: blur(4px);
          animation: draft-smoke-rise 1.35s infinite ease-out;
        }

        .draft-smoke-one {
          --smoke-x: -13px;
        }

        .draft-smoke-two {
          --smoke-x: 11px;
          animation-delay: 0.48s;
        }
      `}</style>
    </div>
  );
}
