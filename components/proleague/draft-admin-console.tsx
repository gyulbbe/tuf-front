"use client";

import {
  startTransition,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import {
  assignDraftPicker,
  createDraftCandidate,
  createDraftOrder,
  createDraftSession,
  createDraftTeam,
  deleteDraftCandidate,
  deleteDraftOrder,
  deleteDraftSession,
  deleteDraftTeam,
  getDraftErrorDebugInfo,
  getDraftSessionDetail,
  isDraftApiError,
  listDraftSessions,
  searchDraftUsers,
  updateDraftSession,
  updateDraftTeam,
  type DraftCandidate,
  type DraftMode,
  type DraftLiveTeam,
  type DraftOrder,
  type DraftPick,
  type DraftSessionDetail,
  type DraftSessionSummary,
  type DraftUserSearchResult,
} from "@/lib/api/draft";
import { SurfaceCard } from "@/components/site/surface-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type NoticeTone = "error" | "neutral" | "success";

type NoticeState = {
  tone: NoticeTone;
  text: string;
};

type SessionFormState = {
  title: string;
  teamCount: string;
  pickTimeSeconds: string;
  draftMode: DraftMode;
};

type TeamFormState = {
  teamName: string;
  displayOrder: string;
};

type TeamPickerLookupState = {
  query: string;
  pickerUserId: string;
  showManualIdInput: boolean;
  selectedUser: DraftUserSearchResult | null;
};

type CandidateFormState = {
  query: string;
  candidateUserId: string;
  candidateName: string;
  race: string;
  status: string;
  showManualIdInput: boolean;
  selectedUser: DraftUserSearchResult | null;
};

type CandidateDirectoryEntry = {
  userId: string;
  tier: string | null;
  race: string | null;
};

type CandidateListItem = {
  candidate: DraftCandidate;
  raceLabel: string;
  userId: string;
};

type CandidateTierGroup = {
  items: CandidateListItem[];
  tierLabel: string;
};

type TeamEditState = {
  teamName: string;
  displayOrder: string;
};

type DraftAdminConsoleProps = {
  onDataChanged?: () => void;
};

type UserAutocompleteInputProps = {
  disabled?: boolean;
  excludedUserIds?: readonly number[];
  onSelect: (user: DraftUserSearchResult) => void;
  placeholder: string;
  value: string;
  onValueChange: (value: string) => void;
};

const RACE_OPTIONS = ["TERRAN", "ZERG", "PROTOSS", "RANDOM"] as const;
const CANDIDATE_STATUS_OPTIONS = [
  "WAITING",
  "PICKED",
  "SKIPPED",
  "EXCLUDED",
] as const;

const CANDIDATE_STATUS_LABELS: Record<string, string> = {
  WAITING: "대기",
  PICKED: "지명됨",
  SKIPPED: "스킵",
  EXCLUDED: "제외",
};

const DRAFT_MODE_OPTIONS = [
  {
    value: "FIXED_ORDER" as const,
    label: "고정 순서",
    description: "미리 만든 순서표대로 자동 진행",
  },
  {
    value: "MANUAL_CAPTAIN" as const,
    label: "수동 팀장",
    description: "매 픽마다 다음 팀을 직접 지정",
  },
];

const SELECT_CLASS_NAME =
  "w-full rounded-2xl border border-line bg-surface-strong px-4 py-3 text-sm text-foreground outline-none transition-colors focus:border-accent-soft focus:bg-white disabled:cursor-not-allowed disabled:opacity-70";

const EMPTY_CREATE_FORM: SessionFormState = {
  title: "",
  teamCount: "6",
  pickTimeSeconds: "30",
  draftMode: "FIXED_ORDER",
};

const EMPTY_EDIT_FORM: SessionFormState = {
  title: "",
  teamCount: "",
  pickTimeSeconds: "",
  draftMode: "FIXED_ORDER",
};

const EMPTY_CANDIDATE_FORM: CandidateFormState = {
  query: "",
  candidateUserId: "",
  candidateName: "",
  race: "TERRAN",
  status: "WAITING",
  showManualIdInput: false,
  selectedUser: null,
};

type OrderGenerationMode = "basic" | "snake";

type GeneratedOrderPlanItem = {
  draftTeamId: number;
  pickNo: number;
  roundNo: number;
  teamName: string;
};

function readErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return "요청을 처리하지 못했다. 잠시 후 다시 시도해 달라.";
}

function isMissingSessionError(error: unknown) {
  if (!isDraftApiError(error)) {
    return false;
  }

  const status = error.info.responseStatus ?? error.info.httpStatus;
  return status === 404;
}

function buildSessionDeleteConfirmText(sessionTitle: string) {
  return [
    `"${sessionTitle}" 드래프트를 삭제할까?`,
    "",
    "팀, 드래프트 인원, 순서, 픽 기록이 함께 삭제된다.",
    "삭제 후에는 되돌릴 수 없다.",
  ].join("\n");
}

function getTeamDeleteErrorMessage(error: unknown) {
  const message = readErrorMessage(error);

  if (message.includes("현재 차례 팀은 삭제할 수 없습니다.")) {
    return "지금 차례인 팀은 삭제할 수 없다. 턴을 넘기거나 드래프트를 멈춘 뒤 다시 시도해 달라.";
  }

  return message;
}

function formatDraftMode(mode: DraftMode | string | null | undefined) {
  switch (mode) {
    case "FIXED_ORDER":
      return "고정 순서";
    case "MANUAL_CAPTAIN":
      return "수동 팀장";
    default:
      return mode ?? "미정";
  }
}

function isManualCaptainMode(mode: DraftMode | string | null | undefined) {
  return mode === "MANUAL_CAPTAIN";
}

function logDraftAdminIssue(
  action: string,
  error: unknown,
  context?: Record<string, unknown>,
) {
  const message = readErrorMessage(error);

  console.groupCollapsed(`[Draft Admin] ${action} 실패: ${message}`);

  if (context) {
    console.log("context", context);
  }

  console.error("detail", getDraftErrorDebugInfo(error));
  console.groupEnd();
}

function logDraftAdminInfo(
  action: string,
  message: string,
  context?: Record<string, unknown>,
) {
  console.info(`[Draft Admin] ${action}: ${message}`, context ?? {});
}

function formatDateTime(value: string | null | undefined) {
  if (!value) {
    return "-";
  }

  const timestamp = Date.parse(value);

  if (Number.isNaN(timestamp)) {
    return value;
  }

  return new Intl.DateTimeFormat("ko-KR", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(timestamp);
}

function formatCandidateStatus(status: string | null | undefined) {
  if (!status) {
    return "미정";
  }

  return CANDIDATE_STATUS_LABELS[status] ?? status;
}

function parsePositiveInt(value: string, fieldName: string, minimum = 1) {
  const parsed = Number(value.trim());

  if (!Number.isInteger(parsed) || parsed < minimum) {
    throw new Error(`${fieldName}은(는) ${minimum} 이상의 정수여야 한다.`);
  }

  return parsed;
}

function normalizeRace(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const normalized = value.trim().toUpperCase();

  return RACE_OPTIONS.includes(normalized as (typeof RACE_OPTIONS)[number])
    ? normalized
    : null;
}

function getCandidateStatusPriority(status: string) {
  switch (status) {
    case "WAITING":
      return 0;
    case "PICKED":
      return 1;
    case "SKIPPED":
      return 2;
    case "EXCLUDED":
      return 3;
    default:
      return 4;
  }
}

function filterAutocompleteUsers(
  users: DraftUserSearchResult[],
  excludedUserIds: readonly number[],
) {
  if (excludedUserIds.length === 0) {
    return users;
  }

  return users.filter((user) => !excludedUserIds.includes(user.id));
}

function sortSessions(sessions: DraftSessionSummary[]) {
  const priority = new Map([
    ["LIVE", 0],
    ["PAUSED", 1],
    ["READY", 2],
    ["FINISHED", 3],
    ["CANCELLED", 4],
  ]);

  return [...sessions].sort((left, right) => {
    const leftPriority = priority.get(left.status) ?? 99;
    const rightPriority = priority.get(right.status) ?? 99;

    if (leftPriority !== rightPriority) {
      return leftPriority - rightPriority;
    }

    return right.id - left.id;
  });
}

function filterManageableSessions(sessions: DraftSessionSummary[]) {
  return sessions.filter((session) => session.status === "READY");
}

function sortTeams(teams: DraftLiveTeam[]) {
  return [...teams].sort((left, right) => {
    if (left.displayOrder !== right.displayOrder) {
      return left.displayOrder - right.displayOrder;
    }

    return left.id - right.id;
  });
}

function sortCandidates(candidates: DraftCandidate[]) {
  return [...candidates].sort((left, right) => {
    const priorityGap =
      getCandidateStatusPriority(left.status) -
      getCandidateStatusPriority(right.status);

    if (priorityGap !== 0) {
      return priorityGap;
    }

    return left.candidateName.localeCompare(right.candidateName, "ko");
  });
}

function findCandidateDirectoryMatch(
  users: DraftUserSearchResult[],
  candidate: DraftCandidate,
) {
  const normalizedName = candidate.candidateName.trim().toLowerCase();

  return (
    users.find((user) => user.id === candidate.candidateUserId) ??
    users.find((user) => user.userId.trim().toLowerCase() === normalizedName) ??
    null
  );
}

function getTierLabel(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized.toUpperCase() : "미정";
}

function compareTierLabel(left: string, right: string) {
  if (left === right) {
    return 0;
  }

  if (left === "미정") {
    return 1;
  }

  if (right === "미정") {
    return -1;
  }

  return left.localeCompare(right, "en");
}

function buildCandidateTierGroups(
  candidates: DraftCandidate[],
  candidateDirectory: Record<number, CandidateDirectoryEntry | null>,
) {
  const items = candidates
    .map((candidate) => {
      const directoryEntry = candidateDirectory[candidate.candidateUserId];
      const normalizedRace = normalizeRace(directoryEntry?.race ?? candidate.race);

      return {
        candidate,
        raceLabel: normalizedRace ?? candidate.race?.trim() ?? "-",
        tierLabel: getTierLabel(directoryEntry?.tier),
        userId:
          directoryEntry?.userId.trim() ||
          candidate.candidateName.trim() ||
          String(candidate.candidateUserId),
      };
    })
    .sort((left, right) => {
      const tierGap = compareTierLabel(left.tierLabel, right.tierLabel);

      if (tierGap !== 0) {
        return tierGap;
      }

      return left.userId.localeCompare(right.userId, "ko");
    });

  return items.reduce<CandidateTierGroup[]>((groups, item) => {
    const lastGroup = groups[groups.length - 1];

    if (!lastGroup || lastGroup.tierLabel !== item.tierLabel) {
      groups.push({
        items: [
          {
            candidate: item.candidate,
            raceLabel: item.raceLabel,
            userId: item.userId,
          },
        ],
        tierLabel: item.tierLabel,
      });
      return groups;
    }

    lastGroup.items.push({
      candidate: item.candidate,
      raceLabel: item.raceLabel,
      userId: item.userId,
    });
    return groups;
  }, []);
}

function sortOrders(orders: DraftOrder[]) {
  return [...orders].sort((left, right) => left.pickNo - right.pickNo);
}

function sortPicks(picks: DraftPick[]) {
  return [...picks].sort((left, right) => left.pickNo - right.pickNo);
}

function chooseSessionId(
  sessions: DraftSessionSummary[],
  preferredSessionId: number | null | undefined,
  currentSessionId: number | null,
) {
  if (
    typeof preferredSessionId === "number" &&
    sessions.some((session) => session.id === preferredSessionId)
  ) {
    return preferredSessionId;
  }

  if (
    typeof currentSessionId === "number" &&
    sessions.some((session) => session.id === currentSessionId)
  ) {
    return currentSessionId;
  }

  return sessions[0]?.id ?? null;
}

function createEmptyTeamLookupState(): TeamPickerLookupState {
  return {
    query: "",
    pickerUserId: "",
    showManualIdInput: false,
    selectedUser: null,
  };
}

function createInitialTeamLookups(detail: DraftSessionDetail) {
  const nextState: Record<number, TeamPickerLookupState> = {};

  for (const team of detail.teams) {
    nextState[team.id] = createEmptyTeamLookupState();
  }

  return nextState;
}

function createInitialTeamEdits(detail: DraftSessionDetail) {
  const nextState: Record<number, TeamEditState> = {};

  for (const team of detail.teams) {
    nextState[team.id] = {
      teamName: team.teamName,
      displayOrder: String(team.displayOrder),
    };
  }

  return nextState;
}

function createDefaultTeamForm(detail?: DraftSessionDetail | null): TeamFormState {
  const nextDisplayOrder = detail
    ? Math.max(0, ...detail.teams.map((team) => team.displayOrder)) + 1
    : 1;

  return {
    teamName: `${nextDisplayOrder}팀`,
    displayOrder: String(nextDisplayOrder),
  };
}

function getOrderGenerationTargetCount(candidates: DraftCandidate[]) {
  return candidates.filter((candidate) => candidate.status !== "EXCLUDED").length;
}

function buildGeneratedOrderPlan(
  teams: DraftLiveTeam[],
  totalPickCount: number,
  mode: OrderGenerationMode,
): GeneratedOrderPlanItem[] {
  const orderedTeams = sortTeams(teams);

  if (orderedTeams.length === 0 || totalPickCount <= 0) {
    return [];
  }

  return Array.from({ length: totalPickCount }, (_, index) => {
    const pickNo = index + 1;
    const roundIndex = Math.floor(index / orderedTeams.length);
    const teamSequence =
      mode === "snake" && roundIndex % 2 === 1
        ? [...orderedTeams].reverse()
        : orderedTeams;
    const team = teamSequence[index % orderedTeams.length];

    return {
      draftTeamId: team.id,
      pickNo,
      roundNo: roundIndex + 1,
      teamName: team.teamName,
    };
  });
}

function formatOrderGenerationMode(mode: OrderGenerationMode) {
  return mode === "snake" ? "스네이크" : "기본";
}

function formatOrderPlanPreview(plan: GeneratedOrderPlanItem[]) {
  if (plan.length === 0) {
    return "-";
  }

  return plan
    .map((item) => `#${item.pickNo} ${item.teamName}`)
    .join(" → ");
}

function detectOrderGenerationMode(
  orders: DraftOrder[],
  teams: DraftLiveTeam[],
): OrderGenerationMode | null {
  if (orders.length === 0 || teams.length === 0) {
    return null;
  }

  for (const mode of ["basic", "snake"] as const) {
    const plan = buildGeneratedOrderPlan(teams, orders.length, mode);

    if (
      plan.length === orders.length &&
      orders.every((order, index) => {
        const planned = plan[index];
        return (
          order.pickNo === planned.pickNo &&
          order.roundNo === planned.roundNo &&
          order.draftTeamId === planned.draftTeamId
        );
      })
    ) {
      return mode;
    }
  }

  return null;
}

function getNoticeClassName(tone: NoticeTone) {
  if (tone === "success") {
    return "border border-success-ink/15 bg-success-soft text-success-ink";
  }

  if (tone === "error") {
    return "border border-danger-ink/15 bg-danger-soft text-danger-ink";
  }

  return "border border-line bg-surface-muted text-foreground";
}

function getStateChipClassName(active: boolean) {
  return active
    ? "border border-success-ink/15 bg-success-soft text-success-ink"
    : "border border-line bg-surface-muted text-muted";
}

function getCandidateStatusClassName(status: string) {
  switch (status) {
    case "WAITING":
      return "border border-success-ink/15 bg-success-soft text-success-ink";
    case "PICKED":
      return "bg-accent text-white";
    case "EXCLUDED":
      return "border border-danger-ink/15 bg-danger-soft text-danger-ink";
    default:
      return "border border-line bg-surface-muted text-muted";
  }
}

function SetupStatCard({
  description,
  label,
  ready,
  value,
}: {
  description: string;
  label: string;
  ready: boolean;
  value: string;
}) {
  return (
    <div className="rounded-[24px] border border-line bg-surface-strong px-4 py-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-foreground">{label}</p>
        <span
          className={cn(
            "rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em]",
            getStateChipClassName(ready),
          )}
        >
          {ready ? "READY" : "NEED"}
        </span>
      </div>
      <p className="mt-4 text-2xl font-semibold tracking-tight text-foreground">
        {value}
      </p>
      <p className="mt-2 text-sm leading-6 text-muted">{description}</p>
    </div>
  );
}

function UserAutocompleteInput({
  disabled = false,
  excludedUserIds = [],
  onSelect,
  placeholder,
  value,
  onValueChange,
}: UserAutocompleteInputProps) {
  const [results, setResults] = useState<DraftUserSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const blurTimeoutRef = useRef<number | null>(null);
  const selectedValueRef = useRef<string | null>(null);
  const visibleResults = filterAutocompleteUsers(results, excludedUserIds);

  useEffect(() => {
    const keyword = value.trim();

    if (!keyword) {
      selectedValueRef.current = null;
      const timeoutId = window.setTimeout(() => {
        setResults([]);
        setLoading(false);
        setIsOpen(false);
        setActiveIndex(-1);
      }, 0);

      return () => {
        window.clearTimeout(timeoutId);
      };
    }

    if (selectedValueRef.current === keyword) {
      selectedValueRef.current = null;
      const timeoutId = window.setTimeout(() => {
        setResults([]);
        setLoading(false);
        setIsOpen(false);
        setActiveIndex(-1);
      }, 0);

      return () => {
        window.clearTimeout(timeoutId);
      };
    }

    let cancelled = false;
    const timeoutId = window.setTimeout(async () => {
      setLoading(true);

      try {
        const nextResults = (await searchDraftUsers(keyword, 8))
          .filter((user) => user.userId.toLowerCase().includes(keyword.toLowerCase()));

        if (cancelled) {
          return;
        }

        setResults(nextResults);
        setIsOpen(true);
        setActiveIndex(nextResults.length > 0 ? 0 : -1);
      } catch (error) {
        if (cancelled) {
          return;
        }

        logDraftAdminIssue("유저 자동완성 검색", error, {
          keyword,
        });
        setResults([]);
        setIsOpen(true);
        setActiveIndex(-1);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [value]);

  useEffect(() => {
    return () => {
      if (blurTimeoutRef.current !== null) {
        window.clearTimeout(blurTimeoutRef.current);
      }
    };
  }, []);

  function closeDropdown() {
    setIsOpen(false);
    setActiveIndex(-1);
  }

  function selectUser(user: DraftUserSearchResult) {
    selectedValueRef.current = user.userId;
    onSelect(user);
    setResults([]);
    closeDropdown();
  }

  return (
    <div className="relative">
      <Input
        value={value}
        disabled={disabled}
        placeholder={placeholder}
        onChange={(event) => {
          onValueChange(event.target.value);
          setIsOpen(true);
        }}
        onFocus={() => {
          if (value.trim()) {
            setIsOpen(true);
          }
        }}
        onBlur={() => {
          blurTimeoutRef.current = window.setTimeout(() => {
            closeDropdown();
          }, 120);
        }}
        onKeyDown={(event) => {
          if (!isOpen && event.key === "ArrowDown") {
            setIsOpen(true);
            return;
          }

          if (!isOpen) {
            return;
          }

          if (event.key === "ArrowDown") {
            event.preventDefault();
            setActiveIndex((current) => {
              if (visibleResults.length === 0) {
                return -1;
              }

              const clampedCurrent = Math.min(
                Math.max(current, -1),
                visibleResults.length - 1,
              );
              return Math.min(clampedCurrent + 1, visibleResults.length - 1);
            });
          }

          if (event.key === "ArrowUp") {
            event.preventDefault();
            setActiveIndex((current) => {
              if (visibleResults.length === 0) {
                return -1;
              }

              const clampedCurrent = Math.min(
                Math.max(current, 0),
                visibleResults.length - 1,
              );
              return Math.max(clampedCurrent - 1, 0);
            });
          }

          if (
            event.key === "Enter" &&
            activeIndex >= 0 &&
            visibleResults[activeIndex]
          ) {
            event.preventDefault();
            selectUser(visibleResults[activeIndex]);
          }

          if (event.key === "Escape") {
            closeDropdown();
          }
        }}
      />

      {loading ? <p className="mt-2 text-xs text-muted">검색 중...</p> : null}

      {isOpen && value.trim() ? (
        <div className="absolute left-0 right-0 z-20 mt-2 overflow-hidden rounded-[20px] border border-line bg-surface shadow-[0_18px_60px_-40px_rgba(31,42,40,0.7)]">
          <div className="border-b border-line px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
            matching user_id
          </div>
          {visibleResults.length === 0 ? (
            <div className="px-3 py-3 text-xs text-muted">일치하는 아이디가 없다.</div>
          ) : (
            <div className="max-h-64 overflow-y-auto py-1">
              {visibleResults.map((user, index) => (
                <button
                  key={`${user.id}:${user.userId}`}
                  type="button"
                  className={cn(
                    "flex w-full items-start justify-between gap-3 px-3 py-2 text-left transition-colors",
                    index === activeIndex
                      ? "bg-surface-strong"
                      : "hover:bg-surface-strong",
                  )}
                  onMouseDown={(event) => {
                    event.preventDefault();
                    selectUser(user);
                  }}
                >
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      {user.userId}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

function TeamRow({
  draftTeam,
  editState,
  pendingAction,
  rosterCount,
  onChange,
  onDelete,
  onSave,
}: {
  draftTeam: DraftLiveTeam;
  editState: TeamEditState;
  pendingAction: string | null;
  rosterCount: number;
  onChange: (patch: Partial<TeamEditState>) => void;
  onDelete: () => Promise<void>;
  onSave: () => Promise<void>;
}) {
  return (
    <div className="rounded-[24px] border border-line bg-surface-strong px-4 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-foreground">
            {draftTeam.teamName}
          </p>
          <p className="mt-1 text-xs text-muted">
            픽커 {draftTeam.pickerName ? "지정됨" : "미지정"} · 로스터 {rosterCount}명
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            disabled={pendingAction !== null}
            onClick={() => {
              void onSave();
            }}
          >
            {pendingAction === `team-save:${draftTeam.id}` ? "저장 중" : "저장"}
          </Button>
          <Button
            size="sm"
            variant="danger"
            disabled={pendingAction !== null}
            onClick={() => {
              void onDelete();
            }}
          >
            {pendingAction === `team-delete:${draftTeam.id}` ? "삭제 중" : "삭제"}
          </Button>
        </div>
      </div>

      <div className="mt-4">
        <Input
          value={editState.teamName}
          onChange={(event) => {
            onChange({ teamName: event.target.value });
          }}
          placeholder="팀 이름"
        />
      </div>
    </div>
  );
}

function TeamPickerManager({
  draftTeam,
  lookupState,
  pendingAction,
  onChangeLookup,
  onAssignPicker,
}: {
  draftTeam: DraftLiveTeam;
  lookupState: TeamPickerLookupState;
  pendingAction: string | null;
  onChangeLookup: (teamId: number, patch: Partial<TeamPickerLookupState>) => void;
  onAssignPicker: (teamId: number) => Promise<void>;
}) {
  const isAssignPending = pendingAction === `picker-assign:${draftTeam.id}`;

  return (
    <article className="rounded-[28px] border border-line bg-surface-strong px-5 py-5 shadow-[0_18px_50px_-40px_rgba(31,42,40,0.7)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-lg font-semibold text-foreground">{draftTeam.teamName}</p>
          <p className="mt-1 text-sm text-muted">displayOrder {draftTeam.displayOrder}</p>{/*
            displayOrder {draftTeam.displayOrder} · teamId {draftTeam.id}
          */}
        </div>
        <div className="rounded-[20px] bg-surface px-4 py-3 text-xs leading-6 text-muted">
          <p>픽커</p>
          <p className="font-semibold text-foreground">
            {draftTeam.pickerName ? "지정됨" : "미지정"}
          </p>
        </div>
      </div>

      <div className="mt-5 rounded-[24px] border border-line bg-surface px-4 py-4">
        <p className="text-sm font-semibold text-foreground">
          userId 자동완성으로 픽커 지정
        </p>
        <p className="mt-2 text-sm leading-7 text-muted">
          user_id 일부만 입력해도 검색 결과가 내려온다. 결과를 고르면 pickerUserId가
          자동으로 채워지고, 필요하면 직접 수정할 수도 있다.
        </p>

        <div className="mt-4 grid gap-3">
          <UserAutocompleteInput
            disabled={pendingAction !== null}
            value={lookupState.query}
            placeholder="picker user_id 입력 후 검색"
            onValueChange={(value) => {
              onChangeLookup(draftTeam.id, {
                query: value,
                pickerUserId: "",
                selectedUser: null,
              });
            }}
            onSelect={(user) => {
              onChangeLookup(draftTeam.id, {
                query: user.userId,
                pickerUserId: String(user.id),
                selectedUser: user,
              });
            }}
          />

          <div className="rounded-[20px] bg-surface-muted px-4 py-4 text-sm text-muted">
            {lookupState.selectedUser ? (
              <>
                <p className="font-semibold text-foreground">
                  선택한 user_id: {lookupState.selectedUser.userId}
                </p>
                <p className="mt-1">이 유저를 현재 팀의 픽커로 지정한다.</p>
              </>
            ) : lookupState.pickerUserId ? (
              <>
                <p className="font-semibold text-foreground">
                  수동 입력한 pickerUserId가 있다.
                </p>
                <p className="mt-1">검색 결과가 없으면 아래 직접 입력 흐름을 써도 된다.</p>
              </>
            ) : (
              <>
                <p className="font-semibold text-foreground">
                  팀마다 픽커는 1명만 가진다.
                </p>
                <p className="mt-1">다른 사람을 지정하면 이 팀의 픽커가 새 사람으로 바뀐다.</p>
              </>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              className="text-xs font-semibold text-muted underline-offset-4 transition-colors hover:text-foreground hover:underline"
              disabled={pendingAction !== null}
              onClick={() => {
                onChangeLookup(draftTeam.id, {
                  showManualIdInput: !lookupState.showManualIdInput,
                });
              }}
            >
              {lookupState.showManualIdInput
                ? "직접 입력 접기"
                : "검색이 안 되면 pickerUserId 직접 입력"}
            </button>
          </div>

          {lookupState.showManualIdInput ? (
            <Input
              disabled={pendingAction !== null}
              value={lookupState.pickerUserId}
              onChange={(event) => {
                onChangeLookup(draftTeam.id, {
                  pickerUserId: event.target.value,
                  selectedUser: null,
                });
              }}
              placeholder="pickerUserId 직접 입력"
            />
          ) : null}

          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
            <div className="rounded-[20px] bg-surface-muted px-4 py-4 text-sm text-muted">
              현재 팀 응답 기준 필드: pickerUserId / pickerName
            </div>
            <Button
              variant="accent"
              className="whitespace-nowrap"
              disabled={pendingAction !== null || !lookupState.pickerUserId.trim()}
              onClick={() => {
                void onAssignPicker(draftTeam.id);
              }}
            >
              {isAssignPending ? "지정 중" : "픽커 지정"}
            </Button>
          </div>
        </div>

        {lookupState.selectedUser ? (
          <div className="mt-4 rounded-[20px] bg-surface-muted px-4 py-4">
            <p className="text-sm font-semibold text-foreground">순서</p><p className="hidden">
              선택됨: {lookupState.selectedUser.userId}
            </p>
            <p className="hidden">
              각 팀에 픽커를 1명 지정할 수 있다. user_id 자동완성으로 바로 찾고 지정한다.
            </p>
            <p className="mt-1 text-sm text-muted">
              {lookupState.selectedUser.userId}
              {lookupState.selectedUser.tier
                ? ` · ${lookupState.selectedUser.tier}`
                : ""}
              {lookupState.selectedUser.race
                ? ` · ${lookupState.selectedUser.race}`
                : ""}
            </p>
            <p className="mt-2 text-xs leading-6 text-muted">
              검색한 user_id 기준으로 pickerUserId {lookupState.selectedUser.id}가
              자동 선택됐다.
            </p>
          </div>
        ) : null}
      </div>
    </article>
  );
}

function CandidateRow({
  candidate,
  pendingAction,
  onDelete,
}: {
  candidate: DraftCandidate;
  pendingAction: string | null;
  onDelete: () => Promise<void>;
}) {
  const isDeleting = pendingAction === `candidate-delete:${candidate.candidateUserId}`;

  return (
    <div className="rounded-[24px] border border-line bg-surface-strong px-4 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-foreground">
              {candidate.candidateName}
            </p>
            <span
              className={cn(
                "rounded-full px-3 py-1 text-[11px] font-semibold",
                getCandidateStatusClassName(candidate.status),
              )}
            >
              {formatCandidateStatus(candidate.status)}
            </span>
          </div>
          <p className="mt-1 text-xs text-muted">
            userPk {candidate.candidateUserId}
            {candidate.race ? ` · ${candidate.race}` : ""}
          </p>
        </div>
        <Button
          size="sm"
          variant="danger"
          disabled={pendingAction !== null}
          onClick={() => {
            void onDelete();
          }}
        >
          {isDeleting ? "삭제 중" : "삭제"}
        </Button>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <div className="rounded-[20px] bg-surface px-4 py-4 text-sm text-muted">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">
            Candidate
          </p>
          <p className="mt-2 font-semibold text-foreground">{candidate.candidateName}</p>
          <p className="mt-1">{candidate.race ?? "종족 미정"}</p>
        </div>
        <div className="rounded-[20px] bg-surface px-4 py-4 text-sm text-muted">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">
            Picked Info
          </p>
          <p className="mt-2 font-semibold text-foreground">
            {candidate.pickedDraftTeamName ?? "-"}
          </p>
          <p className="mt-1">{formatDateTime(candidate.pickedAt)}</p>
        </div>
      </div>
    </div>
  );
}

function OrderRow({
  order,
  pendingAction,
  onDelete,
}: {
  order: DraftOrder;
  pendingAction: string | null;
  onDelete: () => Promise<void>;
}) {
  const isDeleting = pendingAction === `order-delete:${order.pickNo}`;

  return (
    <div className="flex items-center gap-2 rounded-[18px] border border-line bg-surface-strong px-3 py-2 text-sm"><span className="shrink-0 font-semibold text-muted">#{order.pickNo}</span><span className="truncate font-semibold text-foreground">{order.draftTeamName}</span>
      <div className="hidden">
        <div>
          <p className="text-sm font-semibold text-foreground">#{order.pickNo}</p>
          <p className="mt-1 text-xs text-muted">
            {order.draftTeamName} · teamId {order.draftTeamId}
          </p>
        </div>
        <Button
          size="sm"
          variant="danger"
          disabled={pendingAction !== null}
          onClick={() => {
            void onDelete();
          }}
        >
          {isDeleting ? "삭제 중" : "삭제"}
        </Button>
      </div>

      <div className="hidden">
        <div className="rounded-[20px] bg-surface px-4 py-4 text-sm text-muted">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">
            Pick No
          </p>
          <p className="mt-2 font-semibold text-foreground">{order.pickNo}</p>
        </div>
        <div className="rounded-[20px] bg-surface px-4 py-4 text-sm text-muted">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">
            Team
          </p>
          <p className="mt-2 font-semibold text-foreground">{order.draftTeamName}</p>
          <p className="mt-1">teamId {order.draftTeamId}</p>
        </div>
      </div>
    </div>
  );
}

function TeamPickerManagerClean({
  draftTeam,
  lookupState,
  pendingAction,
  onChangeLookup,
  onAssignPicker,
}: {
  draftTeam: DraftLiveTeam;
  lookupState: TeamPickerLookupState;
  pendingAction: string | null;
  onChangeLookup: (teamId: number, patch: Partial<TeamPickerLookupState>) => void;
  onAssignPicker: (teamId: number) => Promise<void>;
}) {
  const isAssignPending = pendingAction === `picker-assign:${draftTeam.id}`;

  return (
    <article className="rounded-[28px] border border-line bg-surface-strong px-5 py-5 shadow-[0_18px_50px_-40px_rgba(31,42,40,0.7)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-lg font-semibold text-foreground">{draftTeam.teamName}</p>
        </div>
        <div className="rounded-[20px] bg-surface px-4 py-3 text-xs leading-6 text-muted">
          <p>픽커</p>
          <p className="font-semibold text-foreground">
            {draftTeam.pickerName ? "지정됨" : "미지정"}
          </p>
        </div>
      </div>

      <div className="mt-5 rounded-[24px] border border-line bg-surface px-4 py-4">
        <p className="text-sm font-semibold text-foreground">
          user_id 자동완성으로 픽커 지정
        </p>
        <p className="mt-2 text-sm leading-7 text-muted">
          user_id 일부만 입력해도 검색 결과가 내려온다. 결과를 고르면 선택값이
          자동으로 채워지고, 필요하면 직접 입력할 수도 있다.
        </p>

        <div className="mt-4 grid gap-3">
          <UserAutocompleteInput
            disabled={pendingAction !== null}
            value={lookupState.query}
            placeholder="picker user_id 입력 후 검색"
            onValueChange={(value) => {
              onChangeLookup(draftTeam.id, {
                query: value,
                pickerUserId: "",
                selectedUser: null,
              });
            }}
            onSelect={(user) => {
              onChangeLookup(draftTeam.id, {
                query: user.userId,
                pickerUserId: String(user.id),
                selectedUser: user,
              });
            }}
          />

          <div className="rounded-[20px] bg-surface-muted px-4 py-4 text-sm text-muted">
            {lookupState.selectedUser ? (
              <>
                <p className="font-semibold text-foreground">
                  선택한 user_id: {lookupState.selectedUser.userId}
                </p>
                <p className="mt-1">이 유저를 현재 팀의 픽커로 지정한다.</p>
              </>
            ) : lookupState.pickerUserId ? (
              <>
                <p className="font-semibold text-foreground">직접 입력한 값이 있다.</p>
                <p className="mt-1">검색 결과가 없으면 아래 입력칸에 직접 넣을 수 있다.</p>
              </>
            ) : (
              <>
                <p className="font-semibold text-foreground">
                  팀마다 픽커는 1명만 지정할 수 있다.
                </p>
                <p className="mt-1">다른 사람을 지정하면 현재 픽커가 새 사람으로 바뀐다.</p>
              </>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              className="text-xs font-semibold text-muted underline-offset-4 transition-colors hover:text-foreground hover:underline"
              disabled={pendingAction !== null}
              onClick={() => {
                onChangeLookup(draftTeam.id, {
                  showManualIdInput: !lookupState.showManualIdInput,
                });
              }}
            >
              {lookupState.showManualIdInput ? "직접 입력 닫기" : "검색이 안 되면 직접 입력"}
            </button>
          </div>

          {lookupState.showManualIdInput ? (
            <Input
              disabled={pendingAction !== null}
              value={lookupState.pickerUserId}
              onChange={(event) => {
                onChangeLookup(draftTeam.id, {
                  pickerUserId: event.target.value,
                  selectedUser: null,
                });
              }}
              placeholder="픽커 값 직접 입력"
            />
          ) : null}

          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
            <div className="rounded-[20px] bg-surface-muted px-4 py-4 text-sm text-muted">
              선택한 유저를 이 팀의 픽커로 지정한다.
            </div>
            <Button
              variant="accent"
              className="whitespace-nowrap"
              disabled={pendingAction !== null || !lookupState.pickerUserId.trim()}
              onClick={() => {
                void onAssignPicker(draftTeam.id);
              }}
            >
              {isAssignPending ? "지정 중" : "픽커 지정"}
            </Button>
          </div>
        </div>

        {lookupState.selectedUser ? (
          <div className="mt-4 rounded-[20px] bg-surface-muted px-4 py-4">
            <p className="text-sm font-semibold text-foreground">선택한 유저</p>
            <p className="mt-1 text-sm text-muted">
              {lookupState.selectedUser.userId}
              {lookupState.selectedUser.tier
                ? ` · ${lookupState.selectedUser.tier}`
                : ""}
              {lookupState.selectedUser.race
                ? ` · ${lookupState.selectedUser.race}`
                : ""}
            </p>
            <p className="mt-2 text-xs leading-6 text-muted">
              검색한 user_id 기준으로 이 유저가 자동 선택됐다.
            </p>
          </div>
        ) : null}
      </div>
    </article>
  );
}

function CandidateComposerClean({
  blockedUserIds = [],
  candidateForm,
  pendingAction,
  setCandidateForm,
  onCreate,
}: {
  blockedUserIds?: readonly number[];
  candidateForm: CandidateFormState;
  pendingAction: string | null;
  setCandidateForm: Dispatch<SetStateAction<CandidateFormState>>;
  onCreate: () => Promise<void>;
}) {
  const isBlockedSelection =
    candidateForm.selectedUser !== null &&
    blockedUserIds.includes(candidateForm.selectedUser.id);

  return (
    <div className="mt-5 rounded-[24px] border border-line bg-surface-strong px-4 py-4">
      <div className="grid gap-3">
        <UserAutocompleteInput
          value={candidateForm.query}
          excludedUserIds={blockedUserIds}
          placeholder="아이디 검색"
          onValueChange={(value) => {
            setCandidateForm((current) => ({
              ...current,
              query: value,
              candidateUserId: "",
              candidateName: "",
              selectedUser: null,
            }));
          }}
          onSelect={(user) => {
            setCandidateForm((current) => ({
              ...current,
              query: user.userId,
              candidateUserId: String(user.id),
              candidateName: user.userId,
              race: normalizeRace(user.race) ?? "TERRAN",
              status: "WAITING",
              selectedUser: user,
            }));
          }}
        />

        <Button
          variant="accent"
          disabled={
            pendingAction !== null ||
            !candidateForm.selectedUser ||
            isBlockedSelection
          }
          onClick={() => {
            void onCreate();
          }}
        >
          {pendingAction === "candidate-create" ? "등록 중" : "드래프트 인원 등록"}
        </Button>
      </div>
    </div>
  );
}

function CandidateRowClean({
  candidate,
  raceLabel,
  userId,
  pendingAction,
  onDelete,
}: {
  candidate: DraftCandidate;
  raceLabel: string;
  userId: string;
  pendingAction: string | null;
  onDelete: () => Promise<void>;
}) {
  const isDeleting = pendingAction === `candidate-delete:${candidate.candidateUserId}`;

  return (
    <div className="grid grid-cols-[minmax(0,1fr)_90px_auto] items-center gap-2 rounded-[16px] border border-line bg-surface px-3 py-2 text-sm">
      <p className="truncate font-semibold text-foreground">{userId}</p>
      <p className="truncate text-xs font-semibold uppercase tracking-[0.06em] text-muted">
        {raceLabel}
      </p>
      <Button
        size="sm"
        variant="danger"
        className="h-8 rounded-full px-3 text-xs"
        disabled={pendingAction !== null}
        onClick={() => {
          void onDelete();
        }}
      >
        {isDeleting ? "삭제 중" : "삭제"}
      </Button>
    </div>
  );
}

function CandidateTierSection({
  group,
  pendingAction,
  onDelete,
}: {
  group: CandidateTierGroup;
  pendingAction: string | null;
  onDelete: (candidateUserId: number) => Promise<void>;
}) {
  return (
    <div className="rounded-[22px] border border-line bg-surface-strong">
      <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
        <p className="text-sm font-semibold text-foreground">티어 {group.tierLabel}</p>
        <span className="text-xs text-muted">{group.items.length}명</span>
      </div>

      <div className="space-y-2 px-3 py-3">
        <div className="grid grid-cols-[minmax(0,1fr)_90px_auto] gap-2 px-1 text-[11px] font-semibold tracking-[0.04em] text-muted">
          <span>아이디</span>
          <span>종족</span>
          <span className="text-right">삭제</span>
        </div>

        {group.items.map((item) => (
          <CandidateRowClean
            key={item.candidate.candidateUserId}
            candidate={item.candidate}
            raceLabel={item.raceLabel}
            userId={item.userId}
            pendingAction={pendingAction}
            onDelete={() => onDelete(item.candidate.candidateUserId)}
          />
        ))}
      </div>
    </div>
  );
}

function OrderRowCompact({ order }: { order: DraftOrder }) {
  return (
    <div className="flex items-center gap-2 rounded-[18px] border border-line bg-surface-strong px-3 py-2 text-sm">
      <span className="shrink-0 font-semibold text-muted">#{order.pickNo}</span>
      <span className="truncate font-semibold text-foreground">
        {order.draftTeamName}
      </span>
    </div>
  );
}

export function DraftAdminConsole({ onDataChanged }: DraftAdminConsoleProps) {
  const [sessions, setSessions] = useState<DraftSessionSummary[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(null);
  const [selectedSessionDetail, setSelectedSessionDetail] =
    useState<DraftSessionDetail | null>(null);
  const [createForm, setCreateForm] = useState<SessionFormState>(EMPTY_CREATE_FORM);
  const [editForm, setEditForm] = useState<SessionFormState>(EMPTY_EDIT_FORM);
  const [teamForm, setTeamForm] = useState<TeamFormState>(createDefaultTeamForm());
  const [teamLookups, setTeamLookups] = useState<
    Record<number, TeamPickerLookupState>
  >({});
  const [candidateForm, setCandidateForm] =
    useState<CandidateFormState>(EMPTY_CANDIDATE_FORM);
  const [teamEdits, setTeamEdits] = useState<Record<number, TeamEditState>>({});
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [notice, setNotice] = useState<NoticeState | null>(null);
  const [candidateDirectory, setCandidateDirectory] = useState<
    Record<number, CandidateDirectoryEntry | null>
  >({});

  const sortedTeams = selectedSessionDetail ? sortTeams(selectedSessionDetail.teams) : [];
  const sortedCandidates = selectedSessionDetail
    ? sortCandidates(selectedSessionDetail.candidates)
    : [];
  const candidateLookupKey = sortedCandidates
    .map((candidate) => `${candidate.candidateUserId}:${candidate.candidateName}`)
    .join("|");
  const sortedOrders = selectedSessionDetail ? sortOrders(selectedSessionDetail.orders) : [];
  const sortedPicks = selectedSessionDetail ? sortPicks(selectedSessionDetail.picks) : [];
  const blockedCandidateUserIds = Array.from(
    new Set([
      ...sortedTeams.flatMap((team) =>
        typeof team.pickerUserId === "number" ? [team.pickerUserId] : [],
      ),
      ...sortedCandidates
        .filter(
          (candidate) =>
            candidate.status === "PICKED" || candidate.pickedDraftTeamId !== null,
        )
        .map((candidate) => candidate.candidateUserId),
      ...sortedPicks.map((pick) => pick.candidateUserId),
    ]),
  );
  const rosterCountByTeamId = sortedPicks.reduce<Record<number, number>>((acc, pick) => {
    acc[pick.draftTeamId] = (acc[pick.draftTeamId] ?? 0) + 1;
    return acc;
  }, {});
  const pickerTeamCount = sortedTeams.filter((team) => team.pickerUserId).length;
  const waitingCandidateCount = sortedCandidates.filter(
    (candidate) => candidate.status === "WAITING",
  ).length;
  const isManualCaptainSession = isManualCaptainMode(selectedSessionDetail?.draftMode);
  const orderGenerationTargetCount = getOrderGenerationTargetCount(sortedCandidates);
  const basicOrderPreview = formatOrderPlanPreview(
    buildGeneratedOrderPlan(
      sortedTeams,
      Math.min(orderGenerationTargetCount, 8),
      "basic",
    ),
  );
  const snakeOrderPreview = formatOrderPlanPreview(
    buildGeneratedOrderPlan(
      sortedTeams,
      Math.min(orderGenerationTargetCount, 8),
      "snake",
    ),
  );
  const selectedOrderGenerationMode = detectOrderGenerationMode(sortedOrders, sortedTeams);
  const candidateTierGroups = buildCandidateTierGroups(
    sortedCandidates,
    candidateDirectory,
  );

  useEffect(() => {
    if (sortedCandidates.length === 0) {
      let cleared = false;

      Promise.resolve().then(() => {
        if (!cleared) {
          setCandidateDirectory({});
        }
      });

      return () => {
        cleared = true;
      };
    }

    let cancelled = false;

    async function hydrateCandidateDirectory() {
      const entries = await Promise.all(
        sortedCandidates.map(async (candidate) => {
          const primaryKeyword = candidate.candidateName.trim();

          try {
            const primaryMatches = await searchDraftUsers(
              primaryKeyword || String(candidate.candidateUserId),
              8,
            );
            let matchedUser = findCandidateDirectoryMatch(primaryMatches, candidate);

            if (!matchedUser && primaryKeyword) {
              const fallbackMatches = await searchDraftUsers(
                String(candidate.candidateUserId),
                8,
              );
              matchedUser = findCandidateDirectoryMatch(fallbackMatches, candidate);
            }

            return [
              candidate.candidateUserId,
              matchedUser
                ? {
                    race: matchedUser.race,
                    tier: matchedUser.tier,
                    userId: matchedUser.userId,
                  }
                : null,
            ] as const;
          } catch {
            return [candidate.candidateUserId, null] as const;
          }
        }),
      );

      if (cancelled) {
        return;
      }

      const nextDirectory: Record<number, CandidateDirectoryEntry | null> = {};

      for (const [candidateUserId, entry] of entries) {
        nextDirectory[candidateUserId] = entry;
      }

      setCandidateDirectory(nextDirectory);
    }

    void hydrateCandidateDirectory();

    return () => {
      cancelled = true;
    };
  }, [candidateLookupKey, selectedSessionId]);

  function notifyChange() {
    onDataChanged?.();
  }

  function handleActionError(
    action: string,
    error: unknown,
    context?: Record<string, unknown>,
  ) {
    logDraftAdminIssue(action, error, context);
    setNotice({
      tone: "error",
      text: readErrorMessage(error),
    });
  }

  function handleActionInfo(
    action: string,
    message: string,
    context?: Record<string, unknown>,
  ) {
    logDraftAdminInfo(action, message, context);
    setNotice({
      tone: "neutral",
      text: message,
    });
  }

  function resetDetailState() {
    startTransition(() => {
      setSelectedSessionDetail(null);
      setEditForm(EMPTY_EDIT_FORM);
      setTeamForm(createDefaultTeamForm());
      setTeamLookups({});
      setCandidateForm(EMPTY_CANDIDATE_FORM);
      setTeamEdits({});
    });
  }

  function applyDetail(detail: DraftSessionDetail) {
    startTransition(() => {
      setSelectedSessionDetail(detail);
      setEditForm({
        title: detail.title,
        teamCount: String(detail.teamCount),
        pickTimeSeconds: String(detail.pickTimeSeconds),
        draftMode:
          detail.draftMode === "MANUAL_CAPTAIN" ? "MANUAL_CAPTAIN" : "FIXED_ORDER",
      });
      setTeamForm(createDefaultTeamForm(detail));
      setTeamLookups(createInitialTeamLookups(detail));
      setCandidateForm(EMPTY_CANDIDATE_FORM);
      setTeamEdits(createInitialTeamEdits(detail));
    });
  }

  async function refreshSelectedSession(sessionId: number) {
    const nextSessions = await listDraftSessions();
    const filteredSessions = sortSessions(filterManageableSessions(nextSessions));
    const nextSelectedSessionId = chooseSessionId(filteredSessions, sessionId, null);

    startTransition(() => {
      setSessions(filteredSessions);
      setSelectedSessionId(nextSelectedSessionId);
    });

    if (nextSelectedSessionId !== sessionId) {
      resetDetailState();
      notifyChange();
      return null;
    }

    try {
      const detail = await getDraftSessionDetail(sessionId);

      applyDetail(detail);
      notifyChange();

      return detail;
    } catch (error) {
      if (isMissingSessionError(error)) {
        await syncAfterSessionRemoval();
        return null;
      }

      throw error;
    }
  }

  async function syncAfterSessionRemoval() {
    const nextSessions = sortSessions(filterManageableSessions(await listDraftSessions()));
    const nextSelectedSessionId = chooseSessionId(nextSessions, null, null);

    startTransition(() => {
      setSessions(nextSessions);
      setSelectedSessionId(nextSelectedSessionId);
    });

    if (nextSelectedSessionId === null) {
      resetDetailState();
      notifyChange();
      return;
    }

    await refreshSelectedSession(nextSelectedSessionId);
  }

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      setLoadingSessions(true);

      try {
        const nextSessions = sortSessions(filterManageableSessions(await listDraftSessions()));

        if (cancelled) {
          return;
        }

        const nextSelected = chooseSessionId(nextSessions, null, null);

        startTransition(() => {
          setSessions(nextSessions);
          setSelectedSessionId(nextSelected);
        });
      } catch (error) {
        if (cancelled) {
          return;
        }

        handleActionError("세션 목록 초기 로드", error);
      } finally {
        if (!cancelled) {
          setLoadingSessions(false);
        }
      }
    }

    void bootstrap();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (selectedSessionId === null) {
      resetDetailState();
      return;
    }

    const sessionId = selectedSessionId;
    let cancelled = false;

    async function loadDetail() {
      setLoadingDetail(true);

      try {
        const detail = await getDraftSessionDetail(sessionId);

        if (cancelled) {
          return;
        }

        applyDetail(detail);
      } catch (error) {
        if (cancelled) {
          return;
        }

        if (isMissingSessionError(error)) {
          await syncAfterSessionRemoval().catch(() => undefined);

          if (!cancelled) {
            setNotice({
              tone: "neutral",
              text: "선택한 드래프트가 이미 삭제되어 목록에서 제거했다.",
            });
          }
          return;
        }

        handleActionError("세션 상세 로드", error, { sessionId });
      } finally {
        if (!cancelled) {
          setLoadingDetail(false);
        }
      }
    }

    void loadDetail();

    return () => {
      cancelled = true;
    };
  }, [selectedSessionId]);

  function updateLookup(teamId: number, patch: Partial<TeamPickerLookupState>) {
    setTeamLookups((current) => ({
      ...current,
      [teamId]: {
        ...(current[teamId] ?? createEmptyTeamLookupState()),
        ...patch,
      },
    }));
  }

  function updateTeamEdit(teamId: number, patch: Partial<TeamEditState>) {
    setTeamEdits((current) => ({
      ...current,
      [teamId]: {
        ...(current[teamId] ?? {
          teamName: "",
          displayOrder: "",
        }),
        ...patch,
      },
    }));
  }

  async function handleCreateSession() {
    setPendingAction("session-create");
    setNotice(null);

    try {
      const payload = {
        title: createForm.title.trim(),
        teamCount: parsePositiveInt(createForm.teamCount, "팀 수", 2),
        pickTimeSeconds: parsePositiveInt(createForm.pickTimeSeconds, "픽 제한 시간"),
        draftMode: createForm.draftMode,
      };

      if (!payload.title) {
        throw new Error("드래프트 이름을 입력해야 한다.");
      }

      const created = await createDraftSession(payload);
      await refreshSelectedSession(created.id);
      setCreateForm(EMPTY_CREATE_FORM);
      setNotice({
        tone: "success",
        text: "드래프트를 생성했다.",
      });
    } catch (error) {
      handleActionError("세션 생성", error, {
        form: createForm,
      });
    } finally {
      setPendingAction(null);
    }
  }

  async function handleUpdateSession() {
    if (selectedSessionId === null) {
      return;
    }

    setPendingAction("session-save");
    setNotice(null);

    try {
      const payload = {
        title: editForm.title.trim(),
        teamCount: parsePositiveInt(editForm.teamCount, "팀 수", 2),
        pickTimeSeconds: parsePositiveInt(editForm.pickTimeSeconds, "픽 제한 시간"),
        draftMode: editForm.draftMode,
      };

      if (!payload.title) {
        throw new Error("드래프트 이름을 입력해야 한다.");
      }

      await updateDraftSession(selectedSessionId, payload);
      await refreshSelectedSession(selectedSessionId);
      setNotice({
        tone: "success",
        text: "드래프트 정보를 저장했다.",
      });
    } catch (error) {
      handleActionError("세션 수정", error, {
        form: editForm,
        sessionId: selectedSessionId,
      });
    } finally {
      setPendingAction(null);
    }
  }

  async function handleDeleteSession() {
    if (selectedSessionId === null) {
      return;
    }

    const sessionId = selectedSessionId;
    const sessionTitle =
      (selectedSessionDetail?.title ?? editForm.title.trim()) || `드래프트 ${sessionId}`;

    if (!window.confirm(buildSessionDeleteConfirmText(sessionTitle))) {
      return;
    }

    setPendingAction("session-delete");
    setNotice(null);

    try {
      await deleteDraftSession(sessionId);
      await syncAfterSessionRemoval();
      setNotice({
        tone: "success",
        text: "드래프트와 연결된 팀, 드래프트 인원, 순서, 픽 기록을 함께 삭제했다.",
      });
    } catch (error) {
      if (isMissingSessionError(error)) {
        await syncAfterSessionRemoval().catch(() => undefined);
        setNotice({
          tone: "neutral",
          text: "선택한 드래프트가 이미 삭제되어 목록에서 제거했다.",
        });
        return;
      }

      handleActionError("세션 삭제", error, {
        sessionId,
      });
    } finally {
      setPendingAction(null);
    }
  }

  async function handleCreateTeam() {
    if (selectedSessionId === null) {
      return;
    }

    setPendingAction("team-create");
    setNotice(null);

    try {
      const payload = {
        draftSessionId: selectedSessionId,
        teamName: teamForm.teamName.trim(),
        displayOrder: parsePositiveInt(teamForm.displayOrder, "displayOrder"),
      };

      if (!payload.teamName) {
        throw new Error("팀 이름을 입력해야 한다.");
      }

      const detail = await createDraftTeam(payload).then(() =>
        refreshSelectedSession(selectedSessionId),
      );
      setTeamForm(createDefaultTeamForm(detail));
      setNotice({
        tone: "success",
        text: "팀을 생성했다.",
      });
    } catch (error) {
      handleActionError("팀 생성", error, {
        form: teamForm,
        sessionId: selectedSessionId,
      });
    } finally {
      setPendingAction(null);
    }
  }

  async function handleSaveTeam(teamId: number) {
    if (selectedSessionId === null) {
      return;
    }

    const editState = teamEdits[teamId];

    if (!editState) {
      return;
    }

    setPendingAction(`team-save:${teamId}`);
    setNotice(null);

    try {
      const payload = {
        draftSessionId: selectedSessionId,
        teamName: editState.teamName.trim(),
        displayOrder: parsePositiveInt(editState.displayOrder, "displayOrder"),
      };

      if (!payload.teamName) {
        throw new Error("팀 이름을 입력해야 한다.");
      }

      await updateDraftTeam(teamId, payload);
      await refreshSelectedSession(selectedSessionId);
      setNotice({
        tone: "success",
        text: "팀 정보를 저장했다.",
      });
    } catch (error) {
      handleActionError("팀 수정", error, {
        editState,
        sessionId: selectedSessionId,
        teamId,
      });
    } finally {
      setPendingAction(null);
    }
  }

  async function handleDeleteTeam(teamId: number) {
    if (selectedSessionId === null) {
      return;
    }

    setPendingAction(`team-delete:${teamId}`);
    setNotice(null);

    try {
      await deleteDraftTeam(teamId);
      const detail = await refreshSelectedSession(selectedSessionId);
      setTeamForm(createDefaultTeamForm(detail));
      setNotice({
        tone: "success",
        text: "팀을 삭제했다.",
      });
    } catch (error) {
      logDraftAdminIssue("팀 삭제", error, {
        sessionId: selectedSessionId,
        teamId,
      });
      setNotice({
        tone: "error",
        text: getTeamDeleteErrorMessage(error),
      });
    } finally {
      setPendingAction(null);
    }
  }

  async function handleAssignPicker(teamId: number) {
    if (selectedSessionId === null) {
      return;
    }

    const lookup = teamLookups[teamId];

    if (!lookup) {
      return;
    }

    const team = selectedSessionDetail?.teams.find((item) => item.id === teamId);

    if (!team) {
      handleActionError("픽커 지정", new Error("팀 정보를 찾지 못했다."), {
        sessionId: selectedSessionId,
        teamId,
      });
      return;
    }

    const requestedPickerUserId = lookup.pickerUserId;
    setPendingAction(`picker-assign:${teamId}`);
    setNotice(null);

    try {
      const pickerUserId = parsePositiveInt(lookup.pickerUserId, "pickerUserId");

      if (team.pickerUserId === pickerUserId) {
        handleActionInfo("픽커 지정", "이미 이 유저가 현재 팀의 픽커다.", {
          pickerUserId,
          sessionId: selectedSessionId,
          teamId,
        });
        return;
      }

      await assignDraftPicker(teamId, pickerUserId);
      await refreshSelectedSession(selectedSessionId);
      setNotice({
        tone: "success",
        text: "픽커를 지정했다.",
      });
    } catch (error) {
      handleActionError("픽커 지정", error, {
        pickerUserId: requestedPickerUserId,
        sessionId: selectedSessionId,
        teamId,
      });
    } finally {
      setPendingAction(null);
    }
  }

  async function handleCreateCandidate() {
    if (selectedSessionId === null) {
      return;
    }

    if (!candidateForm.selectedUser) {
      setNotice({
        tone: "error",
        text: "아이디 검색에서 유저를 먼저 선택해 달라.",
      });
      return;
    }

    if (blockedCandidateUserIds.includes(candidateForm.selectedUser.id)) {
      setCandidateForm(EMPTY_CANDIDATE_FORM);
      setNotice({
        tone: "error",
        text: "픽커나 이미 뽑힌 사람은 후보 선수로 추가할 수 없습니다.",
      });
      return;
    }

    setPendingAction("candidate-create");
    setNotice(null);

    try {
      const payload = {
        draftSessionId: selectedSessionId,
        candidateUserId: candidateForm.selectedUser.id,
        candidateName: candidateForm.selectedUser.userId,
        race: normalizeRace(candidateForm.selectedUser.race) ?? "TERRAN",
        status: "WAITING",
      };

      await createDraftCandidate(payload);
      await refreshSelectedSession(selectedSessionId);
      setCandidateForm(EMPTY_CANDIDATE_FORM);
      setNotice({
        tone: "success",
        text: "드래프트 인원을 등록했다.",
      });
    } catch (error) {
      handleActionError("드래프트 인원 등록", error, {
        form: candidateForm,
        sessionId: selectedSessionId,
      });
    } finally {
      setPendingAction(null);
    }
  }

  async function handleDeleteCandidate(candidateUserId: number) {
    if (selectedSessionId === null) {
      return;
    }

    setPendingAction(`candidate-delete:${candidateUserId}`);
    setNotice(null);

    try {
      await deleteDraftCandidate(selectedSessionId, candidateUserId);
      await refreshSelectedSession(selectedSessionId);
      setNotice({
        tone: "success",
        text: "드래프트 인원을 삭제했다.",
      });
    } catch (error) {
      handleActionError("드래프트 인원 삭제", error, {
        candidateUserId,
        sessionId: selectedSessionId,
      });
    } finally {
      setPendingAction(null);
    }
  }

  async function handleGenerateOrders(mode: OrderGenerationMode) {
    if (selectedSessionId === null) {
      return;
    }

    setPendingAction(`order-generate:${mode}`);
    setNotice(null);

    try {
      if (!selectedSessionDetail || sortedTeams.length === 0) {
        throw new Error("순서를 만들려면 먼저 팀이 있어야 한다.");
      }

      if (orderGenerationTargetCount === 0) {
        throw new Error("순서를 자동 생성하려면 EXCLUDED 제외 드래프트 인원이 1명 이상 있어야 한다.");
      }

      if (sortedPicks.length > 0) {
        throw new Error(
          "이미 픽 기록이 있어서 자동 생성 전에 드래프트 이력 탭에서 기록을 먼저 정리해야 한다.",
        );
      }

      const plan = buildGeneratedOrderPlan(
        sortedTeams,
        orderGenerationTargetCount,
        mode,
      );
      const existingOrders = [...sortedOrders].sort((left, right) => right.pickNo - left.pickNo);

      for (const order of existingOrders) {
        await deleteDraftOrder(selectedSessionId, order.pickNo);
      }

      for (const order of plan) {
        await createDraftOrder({
          draftSessionId: selectedSessionId,
          roundNo: order.roundNo,
          pickNo: order.pickNo,
          draftTeamId: order.draftTeamId,
        });
      }

      await refreshSelectedSession(selectedSessionId);
      setNotice({
        tone: "success",
        text: `${formatOrderGenerationMode(mode)} 방식으로 순서 ${plan.length}개를 다시 만들었다.`,
      });
    } catch (error) {
      await refreshSelectedSession(selectedSessionId).catch(() => undefined);
      handleActionError(`${formatOrderGenerationMode(mode)} 순서 자동 생성`, error, {
        candidateCount: orderGenerationTargetCount,
        mode,
        sessionId: selectedSessionId,
      });
    } finally {
      setPendingAction(null);
    }
  }

  async function handleDeleteOrder(pickNo: number) {
    if (selectedSessionId === null) {
      return;
    }

    setPendingAction(`order-delete:${pickNo}`);
    setNotice(null);

    try {
      await deleteDraftOrder(selectedSessionId, pickNo);
      await refreshSelectedSession(selectedSessionId);
      setNotice({
        tone: "success",
        text: "순서를 삭제했다.",
      });
    } catch (error) {
      handleActionError("순서 삭제", error, {
        pickNo,
        sessionId: selectedSessionId,
      });
    } finally {
      setPendingAction(null);
    }
  }

  return (
    <div className="space-y-4">
      <SurfaceCard className="p-6">
        {notice ? (
          <div
            className={cn(
              "rounded-[24px] px-4 py-4 text-sm",
              getNoticeClassName(notice.tone),
            )}
          >
            {notice.text}
          </div>
        ) : null}

        <div className={cn("grid gap-3 md:grid-cols-2 xl:grid-cols-6", notice ? "mt-5" : "")}>
          <SetupStatCard
            label="팀"
            value={selectedSessionDetail ? String(sortedTeams.length) : "0"}
            description="팀 생성 / 수정 / 삭제"
            ready={sortedTeams.length > 0}
          />
          <SetupStatCard
            label="픽커 팀"
            value={String(pickerTeamCount)}
            description="팀별 현재 픽커 수"
            ready={pickerTeamCount > 0}
          />
          <SetupStatCard
            label="드래프트 인원"
            value={String(sortedCandidates.length)}
            description="등록 후 삭제만 지원"
            ready={sortedCandidates.length > 0}
          />
          <SetupStatCard
            label="WAITING"
            value={String(waitingCandidateCount)}
            description="현재 남아 있는 드래프트 인원"
            ready={waitingCandidateCount > 0}
          />
          <SetupStatCard
            label="순서"
            value={String(sortedOrders.length)}
            description="등록 후 삭제만 지원"
            ready={sortedOrders.length > 0}
          />
          <SetupStatCard
            label="픽 기록"
            value={String(sortedPicks.length)}
            description="삭제 후 드래프트 인원 / 순서 보정 가능"
            ready={sortedPicks.length > 0}
          />
        </div>
      </SurfaceCard>

      <div className="grid gap-4 xl:grid-cols-2">
        <SurfaceCard className="p-6">
          <p className="text-sm font-semibold text-foreground">드래프트 생성</p>
          <div className="mt-4 grid gap-3">
            <Input
              value={createForm.title}
              onChange={(event) => {
                setCreateForm((current) => ({
                  ...current,
                  title: event.target.value,
                }));
              }}
              placeholder="드래프트 이름"
            />
            <select
              className={SELECT_CLASS_NAME}
              value={createForm.draftMode}
              onChange={(event) => {
                setCreateForm((current) => ({
                  ...current,
                  draftMode: event.target.value as DraftMode,
                }));
              }}
            >
              {DRAFT_MODE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <div className="grid gap-3 sm:grid-cols-2">
              <Input
                type="number"
                min={2}
                value={createForm.teamCount}
                onChange={(event) => {
                  setCreateForm((current) => ({
                    ...current,
                    teamCount: event.target.value,
                  }));
                }}
                placeholder="팀 수"
              />
              <Input
                type="number"
                min={1}
                value={createForm.pickTimeSeconds}
                onChange={(event) => {
                  setCreateForm((current) => ({
                    ...current,
                    pickTimeSeconds: event.target.value,
                  }));
                }}
                placeholder="픽 제한 시간(초)"
              />
            </div>
            <div className="rounded-[22px] bg-surface-muted px-4 py-4 text-sm leading-7 text-muted">
              {createForm.draftMode === "MANUAL_CAPTAIN"
                ? "수동 팀장 모드는 시작 직후에도 현재 픽 팀이 비어 있고, 라이브 화면에서 다음 픽 팀을 직접 지정해야 한다."
                : "고정 순서 모드는 미리 만든 순서표를 따라 자동으로 현재 픽 팀이 정해진다."}
            </div>
            <Button
              variant="accent"
              disabled={pendingAction !== null || !createForm.title.trim()}
              onClick={() => {
                void handleCreateSession();
              }}
            >
              {pendingAction === "session-create" ? "생성 중" : "드래프트 생성"}
            </Button>
          </div>
        </SurfaceCard>

        <SurfaceCard className="p-6">
          <p className="text-sm font-semibold text-foreground">
            드래프트 선택 / 수정 / 삭제
          </p>
          <div className="mt-4 grid gap-3">
            <select
              className={SELECT_CLASS_NAME}
              value={selectedSessionId ?? ""}
              onChange={(event) => {
                const nextSessionId = event.target.value
                  ? Number(event.target.value)
                  : null;

                startTransition(() => {
                  setSelectedSessionId(nextSessionId);
                });
              }}
            >
              {loadingSessions && sessions.length === 0 ? (
                <option value="">드래프트 목록 불러오는 중</option>
              ) : sessions.length === 0 ? (
                <option value="">준비 중 드래프트 없음</option>
              ) : null}

              {sessions.map((session) => (
                <option key={session.id} value={session.id}>
                  {session.title} · {formatDraftMode(session.draftMode)}
                </option>
              ))}
            </select>

            <Input
              value={editForm.title}
              disabled={selectedSessionId === null}
              onChange={(event) => {
                setEditForm((current) => ({
                  ...current,
                  title: event.target.value,
                }));
              }}
              placeholder="드래프트 이름"
            />
            <select
              className={SELECT_CLASS_NAME}
              value={editForm.draftMode}
              disabled={selectedSessionId === null}
              onChange={(event) => {
                setEditForm((current) => ({
                  ...current,
                  draftMode: event.target.value as DraftMode,
                }));
              }}
            >
              {DRAFT_MODE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <div className="grid gap-3 sm:grid-cols-2">
              <Input
                type="number"
                min={2}
                value={editForm.teamCount}
                disabled={selectedSessionId === null}
                onChange={(event) => {
                  setEditForm((current) => ({
                    ...current,
                    teamCount: event.target.value,
                  }));
                }}
                placeholder="팀 수"
              />
              <Input
                type="number"
                min={1}
                value={editForm.pickTimeSeconds}
                disabled={selectedSessionId === null}
                onChange={(event) => {
                  setEditForm((current) => ({
                    ...current,
                    pickTimeSeconds: event.target.value,
                  }));
                }}
                placeholder="픽 제한 시간(초)"
              />
            </div>

            {selectedSessionDetail ? (
              <div className="rounded-[22px] bg-surface-muted px-4 py-4 text-sm leading-7 text-muted">
                <p>모드: {formatDraftMode(selectedSessionDetail.draftMode)}</p>
                <p>시작: {formatDateTime(selectedSessionDetail.startedAt)}</p>
                <p>종료: {formatDateTime(selectedSessionDetail.endedAt)}</p>
              </div>
            ) : (
              <div className="rounded-[22px] border border-dashed border-line px-4 py-4 text-sm text-muted">
                {loadingDetail
                  ? "드래프트 정보를 불러오는 중이다."
                  : "수정할 드래프트를 선택해 달라."}
              </div>
            )}

            <div className="grid gap-2 sm:grid-cols-2">
              <Button
                disabled={pendingAction !== null || selectedSessionId === null}
                onClick={() => {
                  void handleUpdateSession();
                }}
              >
                {pendingAction === "session-save" ? "저장 중" : "드래프트 저장"}
              </Button>
              <Button
                variant="danger"
                disabled={pendingAction !== null || selectedSessionId === null}
                onClick={() => {
                  void handleDeleteSession();
                }}
              >
                {pendingAction === "session-delete" ? "삭제 중" : "드래프트 삭제"}
              </Button>
            </div>
            <p className="text-sm leading-7 text-danger-ink">
              드래프트 삭제를 누르면 이 드래프트에 연결된 팀, 드래프트 인원, 순서, 픽 기록이
              함께 지워진다.
            </p>
          </div>
        </SurfaceCard>
      </div>

      <SurfaceCard className="p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-foreground">
              팀 생성 / 수정 / 삭제
            </p>
            <p className="mt-2 text-sm leading-7 text-muted">
              팀은 드래프트 준비의 기본 데이터다. 팀 순서는 내부 값으로 자동 관리된다.
            </p>
          </div>
          {selectedSessionDetail ? (
            <div className="rounded-[22px] bg-surface-muted px-4 py-3 text-sm text-muted">
              드래프트 팀 수 {sortedTeams.length} / 목표 {selectedSessionDetail.teamCount}
            </div>
          ) : null}
        </div>

        {!selectedSessionDetail ? (
          <div className="mt-5 rounded-[24px] border border-dashed border-line px-5 py-10 text-center text-sm text-muted">
            먼저 드래프트를 선택해 달라.
          </div>
        ) : (
          <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
            <div className="rounded-[24px] border border-line bg-surface-strong px-4 py-4">
              <div className="grid gap-3">
                <Input
                  value={teamForm.teamName}
                  onChange={(event) => {
                    setTeamForm((current) => ({
                      ...current,
                      teamName: event.target.value,
                    }));
                  }}
                  placeholder="팀 이름"
                />
                <Button
                  variant="accent"
                  disabled={pendingAction !== null || !teamForm.teamName.trim()}
                  onClick={() => {
                    void handleCreateTeam();
                  }}
                >
                  {pendingAction === "team-create" ? "생성 중" : "팀 생성"}
                </Button>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {sortedTeams.length === 0 ? (
                <div className="rounded-[24px] border border-dashed border-line px-5 py-10 text-center text-sm text-muted md:col-span-2 xl:col-span-3">
                  아직 등록한 팀이 없다.
                </div>
              ) : (
                sortedTeams.map((team) => (
                  <TeamRow
                    key={team.id}
                    draftTeam={team}
                    editState={
                      teamEdits[team.id] ?? {
                        teamName: team.teamName,
                        displayOrder: String(team.displayOrder),
                      }
                    }
                    pendingAction={pendingAction}
                    rosterCount={rosterCountByTeamId[team.id] ?? 0}
                    onChange={(patch) => {
                      updateTeamEdit(team.id, patch);
                    }}
                    onDelete={() => handleDeleteTeam(team.id)}
                    onSave={() => handleSaveTeam(team.id)}
                  />
                ))
              )}
            </div>
          </div>
        )}
      </SurfaceCard>

      <SurfaceCard className="p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-foreground">팀별 픽커 지정</p>
            <p className="mt-2 text-sm leading-7 text-muted">
              운영진 목록 없이 팀마다 픽커 1명만 관리한다. 자동완성으로 `user_id`를 찾아
              바로 지정할 수 있다.
            </p>
          </div>
          {selectedSessionDetail ? (
            <div className="rounded-[22px] bg-surface-muted px-4 py-3 text-sm text-muted">
              픽커 지정 팀 {pickerTeamCount}개
            </div>
          ) : null}
        </div>

        <div className="mt-5">
          {!selectedSessionDetail ? (
            <div className="rounded-[24px] border border-dashed border-line px-5 py-10 text-center text-sm text-muted">
              드래프트를 먼저 선택해 달라.
            </div>
          ) : sortedTeams.length === 0 ? (
            <div className="rounded-[24px] border border-dashed border-line px-5 py-10 text-center text-sm text-muted">
              픽커를 지정하려면 먼저 팀이 있어야 한다.
            </div>
          ) : (
            <div className="grid gap-4 xl:grid-cols-2">
              {sortedTeams.map((team) => (
                <TeamPickerManagerClean
                  key={team.id}
                  draftTeam={team}
                  lookupState={teamLookups[team.id] ?? createEmptyTeamLookupState()}
                  pendingAction={pendingAction}
                  onChangeLookup={updateLookup}
                  onAssignPicker={handleAssignPicker}
                />
              ))}
            </div>
          )}
        </div>
      </SurfaceCard>

      <div className="grid gap-4 xl:grid-cols-2">
        <SurfaceCard className="p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-foreground">
                드래프트 인원 등록 / 삭제
              </p>
            </div>
            <div className="rounded-[22px] bg-surface-muted px-4 py-3 text-sm text-muted">
              대기 {waitingCandidateCount}명
            </div>
          </div>

          {!selectedSessionDetail ? (
            <div className="mt-5 rounded-[24px] border border-dashed border-line px-5 py-10 text-center text-sm text-muted">
              드래프트를 먼저 선택해 달라.
            </div>
          ) : (
            <>
              <CandidateComposerClean
                blockedUserIds={blockedCandidateUserIds}
                candidateForm={candidateForm}
                pendingAction={pendingAction}
                setCandidateForm={setCandidateForm}
                onCreate={handleCreateCandidate}
              />
              <div className="mt-5 space-y-3">
                {sortedCandidates.length === 0 ? (
                  <div className="rounded-[24px] border border-dashed border-line px-5 py-10 text-center text-sm text-muted">
                    아직 등록한 드래프트 인원이 없다.
                  </div>
                ) : (
                  candidateTierGroups.map((group) => (
                    <CandidateTierSection
                      key={group.tierLabel}
                      group={group}
                      pendingAction={pendingAction}
                      onDelete={handleDeleteCandidate}
                    />
                  ))
                )}
              </div>
            </>
          )}
        </SurfaceCard>

        <SurfaceCard className="p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-foreground">
                {isManualCaptainSession ? "픽 팀 지정 기록" : "순서 등록 / 삭제"}
              </p>
              <p className="mt-2 text-sm leading-7 text-muted">
                {isManualCaptainSession
                  ? "MANUAL_CAPTAIN 모드는 순서표를 미리 만들지 않는다. 라이브 화면에서 현재 픽 번호의 다음 팀을 지정하면 그 기록이 여기에 쌓인다."
                  : "순서는 드래프트 인원 수 기준으로 자동 생성한다. 버튼을 누르면 기존 순서를 전부 지우고 `pickNo`만 다시 1번부터 맞춘다. 기본은 팀 순서를 반복하고, 스네이크는 한 바퀴마다 방향을 뒤집는다."}
              </p>
            </div>
            <div className="rounded-[22px] bg-surface-muted px-4 py-3 text-sm text-muted">
              생성된 순서 {sortedOrders.length}개 · 대상 드래프트 인원 {orderGenerationTargetCount}명
            </div>
          </div>

          {!selectedSessionDetail ? (
            <div className="mt-5 rounded-[24px] border border-dashed border-line px-5 py-10 text-center text-sm text-muted">
              드래프트를 먼저 선택해 달라.
            </div>
          ) : sortedTeams.length === 0 ? (
            <div className="mt-5 rounded-[24px] border border-dashed border-line px-5 py-10 text-center text-sm text-muted">
              순서를 만들려면 먼저 팀이 있어야 한다.
            </div>
          ) : isManualCaptainSession ? (
            <>
              <div className="mt-5 rounded-[24px] border border-line bg-surface-strong px-4 py-4">
                <p className="text-sm font-semibold text-foreground">수동 팀장 모드 안내</p>
                <p className="mt-2 text-sm leading-7 text-muted">
                  세션 시작 직후와 각 픽 직후에는 다시 “다음 픽 팀 지정 대기” 상태로 돌아간다.
                  다음 팀 지정은 라이브 화면에서 처리하고, 여기서는 누적된 지정 기록만 확인하면 된다.
                </p>
              </div>

              <div className="mt-5 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {sortedOrders.length === 0 ? (
                  <div className="rounded-[24px] border border-dashed border-line px-5 py-10 text-center text-sm text-muted sm:col-span-2 xl:col-span-3">
                    아직 픽 팀 지정 기록이 없다.
                  </div>
                ) : (
                  sortedOrders.map((order) => (
                    <OrderRowCompact
                      key={order.pickNo}
                      order={order}
                    />
                  ))
                )}
              </div>
            </>
          ) : (
            <>
              <div className="mt-5 rounded-[24px] border border-line bg-surface-strong px-4 py-4">
                <div className="grid gap-3">
                  <div className="grid gap-3 md:grid-cols-2">
                    <div
                      className={cn(
                        "rounded-[20px] border px-4 py-4 text-sm text-muted",
                        selectedOrderGenerationMode === "basic"
                          ? "border-accent-soft bg-white"
                          : "border-line bg-surface",
                      )}
                    >
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">
                        기본 미리보기
                        {selectedOrderGenerationMode === "basic" ? " · 선택됨" : ""}
                      </p>
                      <p className="mt-2 leading-7 text-foreground">{basicOrderPreview}</p>
                    </div>
                    <div
                      className={cn(
                        "rounded-[20px] border px-4 py-4 text-sm text-muted",
                        selectedOrderGenerationMode === "snake"
                          ? "border-accent-soft bg-white"
                          : "border-line bg-surface",
                      )}
                    >
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">
                        스네이크 미리보기
                        {selectedOrderGenerationMode === "snake" ? " · 선택됨" : ""}
                      </p>
                      <p className="mt-2 leading-7 text-foreground">{snakeOrderPreview}</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant={selectedOrderGenerationMode === "basic" ? "accent" : "outline"}
                      disabled={pendingAction !== null || orderGenerationTargetCount === 0}
                      onClick={() => {
                        void handleGenerateOrders("basic");
                      }}
                    >
                      {pendingAction === "order-generate:basic"
                        ? "생성 중"
                        : selectedOrderGenerationMode === "basic"
                          ? "기본 방식 선택됨"
                          : "기본 방식 생성"}
                    </Button>
                    <Button
                      variant={selectedOrderGenerationMode === "snake" ? "accent" : "outline"}
                      disabled={pendingAction !== null || orderGenerationTargetCount === 0}
                      onClick={() => {
                        void handleGenerateOrders("snake");
                      }}
                    >
                      {pendingAction === "order-generate:snake"
                        ? "생성 중"
                        : selectedOrderGenerationMode === "snake"
                          ? "스네이크 방식 선택됨"
                          : "스네이크 방식 생성"}
                    </Button>
                  </div>

                  <p className="text-sm leading-7 text-muted">
                    자동 생성 기준은 현재 등록된 드래프트 인원 수이며, `EXCLUDED` 상태는 제외한다.
                    이미 픽 기록이 있으면 먼저 이력 탭에서 정리한 뒤 다시 생성해야 한다.
                  </p>
                </div>
              </div>

              <div className="mt-5 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {sortedOrders.length === 0 ? (
                  <div className="rounded-[24px] border border-dashed border-line px-5 py-10 text-center text-sm text-muted sm:col-span-2 xl:col-span-3">
                    아직 등록한 드래프트 순서가 없다.
                  </div>
                ) : (
                  sortedOrders.map((order) => (
                    <OrderRowCompact
                      key={order.pickNo}
                      order={order}
                    />
                  ))
                )}
              </div>
            </>
          )}
        </SurfaceCard>
      </div>

    </div>
  );
}
