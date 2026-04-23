"use client";

import Link from "next/link";
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
  createDefaultDraftTeams,
  createDraftOrder,
  createDraftSession,
  deleteDraftCandidate,
  deleteDraftOrder,
  deleteDraftSession,
  getDraftErrorDebugInfo,
  getDraftSessionDetail,
  isDraftApiError,
  listDraftSessions,
  searchDraftUsers,
  updateDraftSession,
  updateDraftTeam,
  type DraftCandidate,
  type DraftLiveTeam,
  type DraftOrder,
  type DraftPick,
  type DraftSessionDetail,
  type DraftSessionSummary,
  type DraftUserSearchResult,
} from "@/lib/api/draft";
import { useAuth } from "@/components/auth/auth-provider";
import { SurfaceCard } from "@/components/site/surface-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { canManageOwnedResource } from "@/lib/auth/roles";
import {
  proleagueDraftListPath,
  proleagueDraftLivePath,
} from "@/lib/proleague-draft/routes";
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
  onSessionDeleted?: (sessionId: number) => void;
  sessionId?: number | null;
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

const SELECT_CLASS_NAME =
  "w-full rounded-2xl border border-line bg-surface-strong px-4 py-3 text-sm text-foreground outline-none transition-colors focus:border-accent-soft focus:bg-white disabled:cursor-not-allowed disabled:opacity-70";

const EMPTY_CREATE_FORM: SessionFormState = {
  title: "",
  teamCount: "6",
  pickTimeSeconds: "30",
};

const EMPTY_EDIT_FORM: SessionFormState = {
  title: "",
  teamCount: "",
  pickTimeSeconds: "",
};

const secondaryLinkClassName =
  "inline-flex items-center justify-center rounded-full border border-line px-4 py-3 text-sm font-medium text-muted transition-colors hover:border-accent-soft hover:bg-surface-strong hover:text-foreground";

const primaryLinkClassName =
  "inline-flex items-center justify-center rounded-full bg-accent px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-accent-ink";

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
  return sessions.filter((session) => session.status !== "FINISHED");
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

function createNextTeamLookups(
  detail: DraftSessionDetail,
  current: Record<number, TeamPickerLookupState>,
) {
  const nextState: Record<number, TeamPickerLookupState> = {};

  for (const team of detail.teams) {
    nextState[team.id] = current[team.id] ?? createEmptyTeamLookupState();
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

function getAssignedPickerUserIds(teams: DraftLiveTeam[]) {
  return Array.from(
    new Set(
      teams.flatMap((team) =>
        typeof team.pickerUserId === "number" ? [team.pickerUserId] : [],
      ),
    ),
  );
}

function getRegisteredCandidateUserIds(candidates: DraftCandidate[], picks: DraftPick[]) {
  return Array.from(
    new Set([
      ...candidates.map((candidate) => candidate.candidateUserId),
      ...picks.map((pick) => pick.candidateUserId),
    ]),
  );
}

function buildBlockedPickerUserIds(
  teamId: number,
  teams: DraftLiveTeam[],
  candidates: DraftCandidate[],
  picks: DraftPick[],
) {
  const registeredCandidateUserIds = getRegisteredCandidateUserIds(candidates, picks);
  const otherTeamPickerUserIds = teams.flatMap((team) =>
    team.id !== teamId && typeof team.pickerUserId === "number" ? [team.pickerUserId] : [],
  );

  return Array.from(new Set([...registeredCandidateUserIds, ...otherTeamPickerUserIds]));
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
  const rootRef = useRef<HTMLDivElement | null>(null);
  const selectedValueRef = useRef<string | null>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);
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
    if (!isOpen) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        closeDropdown();
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    if (visibleResults.length === 0) {
      if (activeIndex !== -1) {
        setActiveIndex(-1);
      }
      return;
    }

    if (activeIndex < 0 || activeIndex >= visibleResults.length) {
      setActiveIndex(0);
    }
  }, [activeIndex, isOpen, visibleResults]);

  useEffect(() => {
    if (!isOpen || activeIndex < 0) {
      return;
    }

    itemRefs.current[activeIndex]?.scrollIntoView({
      block: "nearest",
    });
  }, [activeIndex, isOpen, visibleResults]);

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
    <div
      ref={rootRef}
      className={cn("relative", isOpen ? "z-[70]" : "z-0")}
    >
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
        onKeyDown={(event) => {
          const highlightedUser =
            activeIndex >= 0 && visibleResults[activeIndex]
              ? visibleResults[activeIndex]
              : visibleResults[0];

          if (!isOpen && event.key === "ArrowDown") {
            setIsOpen(true);
            return;
          }

          if (event.key === "ArrowDown") {
            if (!isOpen) {
              setIsOpen(true);
              return;
            }

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
            if (!isOpen) {
              setIsOpen(true);
              return;
            }

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

          if (event.key === "Enter" && highlightedUser) {
            event.preventDefault();
            selectUser(highlightedUser);
          }

          if (event.key === "Escape") {
            closeDropdown();
          }
        }}
      />

      {loading ? <p className="mt-2 text-xs text-muted">검색 중...</p> : null}

      {isOpen && value.trim() ? (
        <div className="absolute left-0 right-0 z-[80] mt-2 overflow-hidden rounded-[20px] border border-line bg-white shadow-[0_18px_60px_-40px_rgba(31,42,40,0.7)]">
          <div className="border-b border-line px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
            아이디 검색 결과
          </div>
          {visibleResults.length === 0 ? (
            <div className="px-3 py-3 text-xs text-muted">일치하는 아이디가 없다.</div>
          ) : (
            <div className="max-h-64 overflow-y-auto py-1">
              {visibleResults.map((user, index) => (
                <button
                  key={`${user.id}:${user.userId}`}
                  type="button"
                  ref={(node) => {
                    itemRefs.current[index] = node;
                  }}
                  aria-selected={index === activeIndex}
                  className={cn(
                    "mx-1 flex w-[calc(100%-0.5rem)] items-start justify-between gap-3 rounded-2xl border px-3 py-2 text-left transition-colors",
                    index === activeIndex
                      ? "border-accent-soft bg-accent-soft/60 shadow-sm"
                      : "border-transparent hover:bg-surface-strong",
                  )}
                  onMouseMove={() => {
                    if (activeIndex !== index) {
                      setActiveIndex(index);
                    }
                  }}
                  onMouseDown={(event) => {
                    event.preventDefault();
                    selectUser(user);
                  }}
                >
                  <div>
                    <p
                      className={cn(
                        "text-sm font-semibold",
                        index === activeIndex ? "text-accent-ink" : "text-foreground",
                      )}
                    >
                      {user.userId}
                    </p>
                  </div>
                  {index === activeIndex ? (
                    <span className="rounded-full bg-white/90 px-2 py-1 text-[11px] font-semibold text-accent-ink">
                      현재
                    </span>
                  ) : null}
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
  onChange,
  onSave,
}: {
  draftTeam: DraftLiveTeam;
  editState: TeamEditState;
  pendingAction: string | null;
  onChange: (patch: Partial<TeamEditState>) => void;
  onSave: () => Promise<void>;
}) {
  return (
    <div className="rounded-[24px] border border-line bg-surface-strong px-4 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="text-sm font-semibold text-foreground">
          {draftTeam.teamName}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            disabled={pendingAction !== null}
            onClick={() => {
              void onSave();
            }}
          >
            {pendingAction === `team-save:${draftTeam.id}` ? "수정 중" : "팀 이름 수정"}
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
  excludedUserIds = [],
  onChangeLookup,
  onAssignPicker,
}: {
  draftTeam: DraftLiveTeam;
  lookupState: TeamPickerLookupState;
  pendingAction: string | null;
  excludedUserIds?: readonly number[];
  onChangeLookup: (teamId: number, patch: Partial<TeamPickerLookupState>) => void;
  onAssignPicker: (
    teamId: number,
    user: DraftUserSearchResult,
    previousLookup: TeamPickerLookupState,
  ) => Promise<void>;
}) {
  return (
    <article className="rounded-[24px] border border-line bg-surface-strong px-4 py-4 shadow-[0_18px_50px_-40px_rgba(31,42,40,0.7)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-base font-semibold text-foreground">{draftTeam.teamName}</p>
          <p className="mt-1 text-sm text-muted">displayOrder {draftTeam.displayOrder}</p>{/*
            displayOrder {draftTeam.displayOrder} · teamId {draftTeam.id}
          */}
        </div>
      </div>

      <div className="mt-4 rounded-[20px] border border-line bg-surface px-3 py-3">
        <div className="grid gap-3">
          <UserAutocompleteInput
            disabled={pendingAction !== null}
            value={lookupState.query}
            excludedUserIds={excludedUserIds}
            placeholder="아이디 검색"
            onValueChange={(value) => {
              onChangeLookup(draftTeam.id, {
                query: value,
                pickerUserId: "",
                selectedUser: null,
              });
            }}
            onSelect={(user) => {
              const previousLookup = { ...lookupState };
              onChangeLookup(draftTeam.id, {
                query: user.userId,
                pickerUserId: String(user.id),
                selectedUser: user,
              });
              void onAssignPicker(draftTeam.id, user, previousLookup);
            }}
          />
        </div>

        {lookupState.selectedUser ? (
          <div className="mt-3 rounded-[18px] bg-surface-muted px-3 py-3">
            <p className="text-sm font-semibold text-foreground">순서</p><p className="hidden">
              선택됨: {lookupState.selectedUser.userId}
            </p>
            <p className="hidden">
              각 팀에 픽커를 1명 지정할 수 있다. 아이디 검색으로 바로 찾고 지정한다.
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
  excludedUserIds = [],
  onChangeLookup,
  onAssignPicker,
}: {
  draftTeam: DraftLiveTeam;
  lookupState: TeamPickerLookupState;
  pendingAction: string | null;
  excludedUserIds?: readonly number[];
  onChangeLookup: (teamId: number, patch: Partial<TeamPickerLookupState>) => void;
  onAssignPicker: (
    teamId: number,
    user: DraftUserSearchResult,
    previousLookup: TeamPickerLookupState,
  ) => Promise<void>;
}) {
  return (
    <article className="relative overflow-visible rounded-[24px] border border-line bg-surface-strong px-4 py-4 shadow-[0_18px_50px_-40px_rgba(31,42,40,0.7)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-base font-semibold text-foreground">{draftTeam.teamName}</p>
        </div>
      </div>

      <div className="mt-4 rounded-[20px] border border-line bg-surface px-3 py-3">
        <div className="grid gap-3">
          <UserAutocompleteInput
            disabled={pendingAction !== null}
            value={lookupState.query}
            excludedUserIds={excludedUserIds}
            placeholder="아이디 검색"
            onValueChange={(value) => {
              onChangeLookup(draftTeam.id, {
                query: value,
                pickerUserId: "",
                selectedUser: null,
              });
            }}
            onSelect={(user) => {
              const previousLookup = { ...lookupState };
              onChangeLookup(draftTeam.id, {
                query: user.userId,
                pickerUserId: String(user.id),
                selectedUser: user,
              });
              void onAssignPicker(draftTeam.id, user, previousLookup);
            }}
          />
        </div>

        {lookupState.selectedUser ? (
          <div className="mt-3 rounded-[18px] bg-surface-muted px-3 py-3">
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
          </div>
        ) : null}
      </div>
    </article>
  );
}

function CandidateComposerClean({
  blockedUserIds = [],
  candidateForm,
  disabled = false,
  pendingAction,
  setCandidateForm,
  onCreate,
}: {
  blockedUserIds?: readonly number[];
  candidateForm: CandidateFormState;
  disabled?: boolean;
  pendingAction: string | null;
  setCandidateForm: Dispatch<SetStateAction<CandidateFormState>>;
  onCreate: (user: DraftUserSearchResult) => Promise<void>;
}) {
  return (
    <div className="mt-5 rounded-[24px] border border-line bg-surface-strong px-4 py-4">
      <div className="grid gap-3">
        <UserAutocompleteInput
          disabled={disabled || pendingAction !== null}
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
            void onCreate(user);
          }}
        />
      </div>
    </div>
  );
}

function CandidateRowClean({
  candidate,
  disabled = false,
  raceLabel,
  userId,
  pendingAction,
  onDelete,
}: {
  candidate: DraftCandidate;
  disabled?: boolean;
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
        disabled={disabled || pendingAction !== null}
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
  disabled = false,
  group,
  pendingAction,
  onDelete,
}: {
  disabled?: boolean;
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
            disabled={disabled}
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

export function DraftAdminConsole({
  onDataChanged,
  onSessionDeleted,
  sessionId,
}: DraftAdminConsoleProps) {
  const { user } = useAuth();
  const fixedSessionId = typeof sessionId === "number" ? sessionId : null;
  const isSessionScoped = fixedSessionId !== null;
  const [sessions, setSessions] = useState<DraftSessionSummary[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(
    fixedSessionId,
  );
  const [selectedSessionDetail, setSelectedSessionDetail] =
    useState<DraftSessionDetail | null>(null);
  const [createForm, setCreateForm] = useState<SessionFormState>(EMPTY_CREATE_FORM);
  const [editForm, setEditForm] = useState<SessionFormState>(EMPTY_EDIT_FORM);
  const [teamLookups, setTeamLookups] = useState<
    Record<number, TeamPickerLookupState>
  >({});
  const [candidateForm, setCandidateForm] =
    useState<CandidateFormState>(EMPTY_CANDIDATE_FORM);
  const [teamEdits, setTeamEdits] = useState<Record<number, TeamEditState>>({});
  const [isPickerSetupReady, setIsPickerSetupReady] = useState(false);
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
  const assignedPickerUserIds = getAssignedPickerUserIds(sortedTeams);
  const registeredCandidateUserIds = getRegisteredCandidateUserIds(
    sortedCandidates,
    sortedPicks,
  );
  const blockedCandidateUserIds = Array.from(
    new Set([
      ...assignedPickerUserIds,
      ...registeredCandidateUserIds,
    ]),
  );
  const pickerTeamCount = sortedTeams.filter(
    (team) => teamLookups[team.id]?.selectedUser !== null,
  ).length;
  const allTeamPickersAssigned =
    sortedTeams.length > 0 && pickerTeamCount === sortedTeams.length;
  const waitingCandidateCount = sortedCandidates.filter(
    (candidate) => candidate.status === "WAITING",
  ).length;
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
  const canManageSession = canManageOwnedResource({
    ownerUserId: selectedSessionDetail?.ownerUserId,
    role: user?.role,
    userPk: user?.userPk,
  });

  useEffect(() => {
    if (fixedSessionId === null) {
      return;
    }

    startTransition(() => {
      setSelectedSessionId(fixedSessionId);
    });
  }, [fixedSessionId]);

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

  useEffect(() => {
    const nextReady = selectedSessionDetail !== null && allTeamPickersAssigned;
    setIsPickerSetupReady(nextReady);

    if (!nextReady) {
      setCandidateForm(EMPTY_CANDIDATE_FORM);
    }
  }, [allTeamPickersAssigned, selectedSessionDetail]);

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
      });
      setTeamLookups((current) => createNextTeamLookups(detail, current));
      setCandidateForm(EMPTY_CANDIDATE_FORM);
      setTeamEdits(createInitialTeamEdits(detail));
    });
  }

  async function refreshSelectedSession(sessionId: number) {
    if (fixedSessionId !== null) {
      startTransition(() => {
        setSelectedSessionId(sessionId);
      });

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
    if (fixedSessionId !== null) {
      startTransition(() => {
        setSelectedSessionId(null);
      });
      resetDetailState();
      notifyChange();
      onSessionDeleted?.(fixedSessionId);
      return;
    }

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
    if (fixedSessionId !== null) {
      setLoadingSessions(false);
      return;
    }

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

        handleActionError("드래프트 목록 초기 로드", error);
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
  }, [fixedSessionId]);

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
              text:
                fixedSessionId !== null
                  ? "선택한 드래프트를 찾을 수 없습니다."
                  : "선택한 드래프트가 삭제되어 목록에서 제거했습니다.",
            });
            return;
            setNotice({
              tone: "neutral",
              text: "선택한 드래프트가 이미 삭제되어 목록에서 제거했다.",
            });
          }
          return;
        }

        handleActionError("드래프트 상세 로드", error, { sessionId });
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
  }, [fixedSessionId, selectedSessionId]);

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
      };

      if (!payload.title) {
        throw new Error("드래프트 이름을 입력해야 한다.");
      }

      const created = await createDraftSession(payload);

      try {
        await createDefaultDraftTeams(created.id, payload.teamCount);
      } catch (teamError) {
        throw new Error(
          teamError instanceof Error
            ? `드래프트는 생성됐지만 기본 팀 준비에 실패했다. ${teamError.message}`
            : "드래프트는 생성됐지만 기본 팀 준비에 실패했다.",
        );
      }

      await refreshSelectedSession(created.id);
      setCreateForm(EMPTY_CREATE_FORM);
      setNotice({
        tone: "success",
        text: "드래프트와 기본 팀을 생성했다.",
      });
    } catch (error) {
      handleActionError("드래프트 생성", error, {
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
      handleActionError("드래프트 수정", error, {
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

      handleActionError("드래프트 삭제", error, {
        sessionId,
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

  async function handleAssignPicker(
    teamId: number,
    selectedUser: DraftUserSearchResult,
    previousLookup: TeamPickerLookupState,
  ) {
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
      const pickerUserId = selectedUser.id;

      if (team.pickerUserId === pickerUserId) {
        handleActionInfo("픽커 지정", "이미 이 유저가 현재 팀의 픽커다.", {
          pickerUserId,
          sessionId: selectedSessionId,
          teamId,
        });
        return;
      }

      if (registeredCandidateUserIds.includes(pickerUserId)) {
        throw new Error("드래프트 인원으로 등록된 유저는 픽커로 지정할 수 없다.");
      }

      if (
        sortedTeams.some(
          (item) => item.id !== teamId && item.pickerUserId === pickerUserId,
        )
      ) {
        throw new Error("이미 다른 팀에 지정된 픽커다.");
      }

      await assignDraftPicker(teamId, pickerUserId);
      await refreshSelectedSession(selectedSessionId);
      updateLookup(teamId, {
        query: selectedUser.userId,
        pickerUserId: String(selectedUser.id),
        selectedUser,
      });
      setNotice({
        tone: "success",
        text: "픽커를 지정했다.",
      });
    } catch (error) {
      updateLookup(teamId, previousLookup);
      handleActionError("픽커 지정", error, {
        pickerUserId: requestedPickerUserId,
        sessionId: selectedSessionId,
        teamId,
      });
    } finally {
      setPendingAction(null);
    }
  }

  async function handleCreateCandidate(selectedUser: DraftUserSearchResult) {
    if (selectedSessionId === null) {
      return;
    }

    if (!isPickerSetupReady) {
      setNotice({
        tone: "error",
        text: "팀별 픽커 지정이 모두 끝나야 드래프트 인원을 등록할 수 있다.",
      });
      return;
    }

    if (blockedCandidateUserIds.includes(selectedUser.id)) {
      setCandidateForm(EMPTY_CANDIDATE_FORM);
      setNotice({
        tone: "error",
        text: "픽커이거나 이미 등록된 드래프트 인원은 추가할 수 없다.",
      });
      return;
    }

    setPendingAction("candidate-create");
    setNotice(null);

    try {
      const payload = {
        draftSessionId: selectedSessionId,
        candidateUserId: selectedUser.id,
        candidateName: selectedUser.userId,
        race: normalizeRace(selectedUser.race) ?? "TERRAN",
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
        selectedUser,
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

    if (!isPickerSetupReady) {
      setNotice({
        tone: "error",
        text: "팀별 픽커 지정이 모두 끝나야 드래프트 인원을 수정할 수 있다.",
      });
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

    if (!isPickerSetupReady) {
      setNotice({
        tone: "error",
        text: "팀별 픽커 지정이 모두 끝나야 드래프트 방식을 정할 수 있다.",
      });
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

  if (isSessionScoped && !loadingDetail && selectedSessionDetail && !canManageSession) {
    return (
      <SurfaceCard className="p-6 sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-accent">
          Draft Setup
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          {selectedSessionDetail.title}
        </h1>
        <p className="mt-4 text-base leading-8 text-muted">
          이 설정 화면은 방장이나 관리자만 수정할 수 있습니다. 진행 상황은 라이브 화면에서
          확인해 주세요.
        </p>

        <div className="mt-6 flex flex-wrap gap-2">
          <Link
            href={proleagueDraftLivePath(selectedSessionDetail.id)}
            className={primaryLinkClassName}
          >
            라이브/관전
          </Link>
          <Link href={proleagueDraftListPath()} className={secondaryLinkClassName}>
            목록
          </Link>
        </div>
      </SurfaceCard>
    );
  }

  return (
    <div className="space-y-4">
      <SurfaceCard className="relative z-20 overflow-visible p-6">
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
            description="기본 팀 이름 수정"
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

      <div className={cn("grid gap-4", isSessionScoped ? undefined : "xl:grid-cols-2")}>
        {!isSessionScoped ? (
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
            </div>            <div className="rounded-[22px] bg-surface-muted px-4 py-4 text-sm leading-7 text-muted">
              고정 순서 기준으로 순서표를 만들고 라이브 드래프트를 진행한다.
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
        ) : null}

        <SurfaceCard className="p-6">
          {isSessionScoped ? (
            <p className="text-sm font-semibold text-foreground">드래프트 설정</p>
          ) : (
            <p className="text-sm font-semibold text-foreground">
            드래프트 선택 / 수정 / 삭제
            </p>
          )}
          <div className="mt-4 grid gap-3">
            {isSessionScoped ? null : (
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
                  {session.title}
                </option>
              ))}
              </select>
            )}

            {isSessionScoped ? (
              selectedSessionDetail ? (
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-[22px] border border-line bg-surface-strong px-4 py-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">
                      제목
                    </p>
                    <p className="mt-2 text-base font-semibold text-foreground">
                      {selectedSessionDetail.title}
                    </p>
                  </div>
                  <div className="rounded-[22px] border border-line bg-surface-strong px-4 py-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">
                      팀 수
                    </p>
                    <p className="mt-2 text-base font-semibold text-foreground">
                      {selectedSessionDetail.teamCount}
                    </p>
                  </div>
                  <div className="rounded-[22px] border border-line bg-surface-strong px-4 py-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">
                      픽 제한 시간
                    </p>
                    <p className="mt-2 text-base font-semibold text-foreground">
                      {selectedSessionDetail.pickTimeSeconds}초
                    </p>
                  </div>
                </div>
              ) : (
                <div className="rounded-[22px] border border-dashed border-line px-4 py-4 text-sm text-muted">
                  {loadingDetail
                    ? "드래프트 정보를 불러오는 중입니다."
                    : "드래프트 정보를 불러오지 못했습니다."}
                </div>
              )
            ) : (
              <>

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
            </div>
              </>
            )}
          </div>
        </SurfaceCard>
      </div>

      <SurfaceCard className="p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-foreground">
              팀 이름 수정
            </p>
            <p className="mt-2 text-sm leading-7 text-muted">
              드래프트를 만들 때 팀 수만큼 기본 팀을 먼저 만든다. 여기서는 팀 이름만 정리하면 된다.
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
          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {sortedTeams.length === 0 ? (
              <div className="rounded-[24px] border border-dashed border-line px-5 py-10 text-center text-sm text-muted md:col-span-2 xl:col-span-3">
                아직 준비된 팀이 없다.
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
                  onChange={(patch) => {
                    updateTeamEdit(team.id, patch);
                  }}
                  onSave={() => handleSaveTeam(team.id)}
                />
              ))
            )}
          </div>
        )}
      </SurfaceCard>

      <SurfaceCard className="relative z-20 overflow-visible p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-foreground">팀별 픽커 지정</p>
          </div>
        </div>

        <div className="relative z-10 mt-5 overflow-visible">
          {!selectedSessionDetail ? (
            <div className="rounded-[24px] border border-dashed border-line px-5 py-10 text-center text-sm text-muted">
              드래프트를 먼저 선택해 달라.
            </div>
          ) : sortedTeams.length === 0 ? (
            <div className="rounded-[24px] border border-dashed border-line px-5 py-10 text-center text-sm text-muted">
              픽커를 지정하려면 먼저 팀이 있어야 한다.
            </div>
          ) : (
            <div className="relative z-10 grid gap-4 overflow-visible xl:grid-cols-2">
              {sortedTeams.map((team) => (
                <TeamPickerManagerClean
                  key={team.id}
                  draftTeam={team}
                  lookupState={teamLookups[team.id] ?? createEmptyTeamLookupState()}
                  pendingAction={pendingAction}
                  excludedUserIds={buildBlockedPickerUserIds(
                    team.id,
                    sortedTeams,
                    sortedCandidates,
                    sortedPicks,
                  )}
                  onChangeLookup={updateLookup}
                  onAssignPicker={handleAssignPicker}
                />
              ))}
            </div>
          )}
        </div>
      </SurfaceCard>

      <div className="relative z-0 grid gap-4 xl:grid-cols-2">
        <SurfaceCard
          className={cn(
            "p-6",
            selectedSessionDetail && !isPickerSetupReady ? "opacity-50" : undefined,
          )}
        >
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
              {!isPickerSetupReady ? (
                <div className="mt-5 rounded-[20px] border border-dashed border-line bg-surface-muted px-4 py-4 text-sm font-medium text-muted">
                  팀별 픽커 지정부터 해주세요.
                </div>
              ) : null}
              <CandidateComposerClean
                blockedUserIds={blockedCandidateUserIds}
                candidateForm={candidateForm}
                disabled={!isPickerSetupReady}
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
                      disabled={!isPickerSetupReady}
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

        <SurfaceCard
          className={cn(
            "p-6",
            selectedSessionDetail && !isPickerSetupReady ? "opacity-50" : undefined,
          )}
        >
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-foreground">드래프트 방식</p>
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
          ) : (
            <>
              {!isPickerSetupReady ? (
                <div className="mt-5 rounded-[20px] border border-dashed border-line bg-surface-muted px-4 py-4 text-sm font-medium text-muted">
                  팀별 픽커 지정부터 해주세요.
                </div>
              ) : null}
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
                      disabled={
                        pendingAction !== null ||
                        orderGenerationTargetCount === 0 ||
                        !isPickerSetupReady
                      }
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
                      disabled={
                        pendingAction !== null ||
                        orderGenerationTargetCount === 0 ||
                        !isPickerSetupReady
                      }
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
