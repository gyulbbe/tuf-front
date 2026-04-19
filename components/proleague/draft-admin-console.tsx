"use client";

import { startTransition, useEffect, useRef, useState } from "react";
import {
  assignDraftPicker,
  createDraftCandidate,
  createDraftOrder,
  createDraftSession,
  createDraftTeam,
  createDraftTeamOperator,
  deleteDraftCandidate,
  deleteDraftOrder,
  deleteDraftPick,
  deleteDraftSession,
  deleteDraftTeam,
  deleteDraftTeamOperator,
  getDraftSessionDetail,
  listDraftSessions,
  searchDraftUsers,
  updateDraftCandidate,
  updateDraftOrder,
  updateDraftSession,
  updateDraftTeam,
  updateDraftTeamOperator,
  type DraftCandidate,
  type DraftLiveTeam,
  type DraftOrder,
  type DraftPick,
  type DraftSessionDetail,
  type DraftSessionSummary,
  type DraftTeamOperator,
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
};

type TeamFormState = {
  teamName: string;
  displayOrder: string;
};

type TeamLookupState = {
  query: string;
  operatorUserId: string;
  role: string;
  isActive: string;
  selectedUser: DraftUserSearchResult | null;
};

type CandidateFormState = {
  query: string;
  candidateUserId: string;
  candidateName: string;
  race: string;
  status: string;
  selectedUser: DraftUserSearchResult | null;
};

type TeamEditState = {
  teamName: string;
  displayOrder: string;
};

type CandidateEditState = {
  candidateName: string;
  race: string;
  status: string;
  pickedDraftTeamId: string;
  pickedAt: string;
};

type OrderFormState = {
  roundNo: string;
  pickNo: string;
  draftTeamId: string;
};

type OrderEditState = {
  roundNo: string;
  pickNo: string;
  draftTeamId: string;
};

type OperatorEditState = {
  role: string;
  isActive: string;
};

type DraftAdminConsoleProps = {
  onDataChanged?: () => void;
};

type UserAutocompleteInputProps = {
  disabled?: boolean;
  onSelect: (user: DraftUserSearchResult) => void;
  placeholder: string;
  value: string;
  onValueChange: (value: string) => void;
};

const ROLE_OPTIONS = ["CAPTAIN", "VICE_CAPTAIN", "OPERATOR"] as const;
const ACTIVE_OPTIONS = ["Y", "N"] as const;
const RACE_OPTIONS = ["TERRAN", "ZERG", "PROTOSS", "RANDOM"] as const;
const CANDIDATE_STATUS_OPTIONS = [
  "WAITING",
  "PICKED",
  "SKIPPED",
  "EXCLUDED",
] as const;

const SESSION_STATUS_LABELS: Record<string, string> = {
  READY: "준비",
  LIVE: "진행 중",
  PAUSED: "일시정지",
  FINISHED: "종료",
  CANCELLED: "취소",
};

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

const EMPTY_CANDIDATE_FORM: CandidateFormState = {
  query: "",
  candidateUserId: "",
  candidateName: "",
  race: "TERRAN",
  status: "WAITING",
  selectedUser: null,
};

const EMPTY_ORDER_FORM: OrderFormState = {
  roundNo: "1",
  pickNo: "1",
  draftTeamId: "",
};

function readErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return "요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.";
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

function toDateTimeLocalValue(value: string | null | undefined) {
  if (!value) {
    return "";
  }

  const timestamp = Date.parse(value);

  if (Number.isNaN(timestamp)) {
    return value.slice(0, 16);
  }

  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");

  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function formatSessionStatus(status: string | null | undefined) {
  if (!status) {
    return "미정";
  }

  return SESSION_STATUS_LABELS[status] ?? status;
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
    throw new Error(`${fieldName}은(는) ${minimum} 이상의 정수여야 합니다.`);
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

function createOperatorKey(teamId: number, operatorUserId: number) {
  return `${teamId}:${operatorUserId}`;
}

function createEmptyTeamLookupState(): TeamLookupState {
  return {
    query: "",
    operatorUserId: "",
    role: "OPERATOR",
    isActive: "Y",
    selectedUser: null,
  };
}

function createInitialTeamLookups(detail: DraftSessionDetail) {
  const nextState: Record<number, TeamLookupState> = {};

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

function createInitialOperatorEdits(detail: DraftSessionDetail) {
  const nextState: Record<string, OperatorEditState> = {};

  for (const team of detail.teams) {
    for (const operator of team.operators) {
      nextState[createOperatorKey(team.id, operator.operatorUserId)] = {
        role: operator.role,
        isActive: operator.isActive,
      };
    }
  }

  return nextState;
}

function createInitialCandidateEdits(detail: DraftSessionDetail) {
  const nextState: Record<number, CandidateEditState> = {};

  for (const candidate of detail.candidates) {
    nextState[candidate.candidateUserId] = {
      candidateName: candidate.candidateName,
      race: normalizeRace(candidate.race) ?? "TERRAN",
      status: candidate.status,
      pickedDraftTeamId: candidate.pickedDraftTeamId
        ? String(candidate.pickedDraftTeamId)
        : "",
      pickedAt: toDateTimeLocalValue(candidate.pickedAt),
    };
  }

  return nextState;
}

function createInitialOrderEdits(detail: DraftSessionDetail) {
  const nextState: Record<number, OrderEditState> = {};

  for (const order of detail.orders) {
    nextState[order.pickNo] = {
      roundNo: String(order.roundNo),
      pickNo: String(order.pickNo),
      draftTeamId: String(order.draftTeamId),
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

function createDefaultOrderForm(detail?: DraftSessionDetail | null): OrderFormState {
  if (!detail) {
    return EMPTY_ORDER_FORM;
  }

  const teams = sortTeams(detail.teams);
  const nextPickNo = Math.max(0, ...detail.orders.map((order) => order.pickNo)) + 1;
  const roundNo =
    teams.length > 0 ? Math.floor((nextPickNo - 1) / teams.length) + 1 : 1;
  const teamIndex = teams.length > 0 ? (nextPickNo - 1) % teams.length : -1;
  const draftTeamId = teamIndex >= 0 ? String(teams[teamIndex].id) : "";

  return {
    roundNo: String(roundNo),
    pickNo: String(nextPickNo),
    draftTeamId,
  };
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

  useEffect(() => {
    const keyword = value.trim();

    if (!keyword) {
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
        const nextResults = await searchDraftUsers(keyword, 8);

        if (cancelled) {
          return;
        }

        setResults(nextResults);
        setIsOpen(true);
        setActiveIndex(nextResults.length > 0 ? 0 : -1);
      } catch {
        if (cancelled) {
          return;
        }

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
            setActiveIndex((current) =>
              results.length === 0 ? -1 : Math.min(current + 1, results.length - 1),
            );
          }

          if (event.key === "ArrowUp") {
            event.preventDefault();
            setActiveIndex((current) =>
              results.length === 0 ? -1 : Math.max(current - 1, 0),
            );
          }

          if (event.key === "Enter" && activeIndex >= 0 && results[activeIndex]) {
            event.preventDefault();
            selectUser(results[activeIndex]);
          }

          if (event.key === "Escape") {
            closeDropdown();
          }
        }}
      />

      {loading ? (
        <p className="mt-2 text-xs text-muted">검색 중...</p>
      ) : null}

      {isOpen && value.trim() ? (
        <div className="absolute left-0 right-0 z-20 mt-2 overflow-hidden rounded-[22px] border border-line bg-surface shadow-[0_18px_60px_-40px_rgba(31,42,40,0.7)]">
          {results.length === 0 ? (
            <div className="px-4 py-3 text-sm text-muted">검색 결과가 없습니다.</div>
          ) : (
            <div className="max-h-72 overflow-y-auto py-2">
              {results.map((user, index) => (
                <button
                  key={`${user.id}:${user.userId}`}
                  type="button"
                  className={cn(
                    "flex w-full items-start justify-between gap-3 px-4 py-3 text-left transition-colors",
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
                    <p className="mt-1 text-xs text-muted">
                      {user.name ?? "이름 없음"}
                      {user.tier ? ` · ${user.tier}` : ""}
                      {user.race ? ` · ${user.race}` : ""}
                    </p>
                  </div>
                  <span className="rounded-full bg-surface-strong px-3 py-1 text-xs text-muted">
                    id {user.id}
                  </span>
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
  onDelete,
  onSave,
}: {
  draftTeam: DraftLiveTeam;
  editState: TeamEditState;
  pendingAction: string | null;
  onChange: (patch: Partial<TeamEditState>) => void;
  onDelete: () => Promise<void>;
  onSave: () => Promise<void>;
}) {
  return (
    <div className="rounded-[24px] border border-line bg-surface-strong px-4 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-foreground">
            teamId {draftTeam.id}
          </p>
          <p className="mt-1 text-xs text-muted">
            운영자 {draftTeam.operators.length}명 · 로스터 {draftTeam.roster.length}명
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

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <Input
          value={editState.teamName}
          onChange={(event) => {
            onChange({ teamName: event.target.value });
          }}
          placeholder="팀 이름"
        />
        <Input
          type="number"
          min={1}
          value={editState.displayOrder}
          onChange={(event) => {
            onChange({ displayOrder: event.target.value });
          }}
          placeholder="displayOrder"
        />
      </div>
    </div>
  );
}

function OperatorRow({
  draftTeamId,
  editState,
  operator,
  pendingAction,
  onChange,
  onDelete,
  onAssignPicker,
  onSave,
}: {
  draftTeamId: number;
  editState: OperatorEditState;
  operator: DraftTeamOperator;
  pendingAction: string | null;
  onChange: (patch: Partial<OperatorEditState>) => void;
  onDelete: () => Promise<void>;
  onAssignPicker: () => Promise<void>;
  onSave: () => Promise<void>;
}) {
  const actionKey = createOperatorKey(draftTeamId, operator.operatorUserId);

  return (
    <div className="rounded-[24px] border border-line bg-surface px-4 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-foreground">
            {operator.operatorName}
          </p>
          <p className="mt-1 text-xs text-muted">
            userPk {operator.operatorUserId}
            {operator.canPick === "Y" ? " · 현재 픽커" : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant={operator.canPick === "Y" ? "accent" : "outline"}
            disabled={pendingAction !== null}
            onClick={() => {
              void onAssignPicker();
            }}
          >
            {pendingAction === `operator-picker:${actionKey}`
              ? "지정 중"
              : "픽커 지정"}
          </Button>
          <Button
            size="sm"
            disabled={pendingAction !== null}
            onClick={() => {
              void onSave();
            }}
          >
            {pendingAction === `operator-save:${actionKey}` ? "저장 중" : "저장"}
          </Button>
          <Button
            size="sm"
            variant="danger"
            disabled={pendingAction !== null}
            onClick={() => {
              void onDelete();
            }}
          >
            {pendingAction === `operator-delete:${actionKey}` ? "삭제 중" : "삭제"}
          </Button>
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <label className="block">
          <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-muted">
            Role
          </span>
          <select
            className={SELECT_CLASS_NAME}
            value={editState.role}
            onChange={(event) => {
              onChange({ role: event.target.value });
            }}
          >
            {ROLE_OPTIONS.map((role) => (
              <option key={role} value={role}>
                {role}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-muted">
            Active
          </span>
          <select
            className={SELECT_CLASS_NAME}
            value={editState.isActive}
            onChange={(event) => {
              onChange({ isActive: event.target.value });
            }}
          >
            {ACTIVE_OPTIONS.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
      </div>
    </div>
  );
}

function TeamOperatorManager({
  draftTeam,
  lookupState,
  operatorEdits,
  pendingAction,
  onChangeLookup,
  onAddOperator,
  onAssignPicker,
  onDeleteOperator,
  onSaveOperator,
  onUpdateOperatorEdit,
}: {
  draftTeam: DraftLiveTeam;
  lookupState: TeamLookupState;
  operatorEdits: Record<string, OperatorEditState>;
  pendingAction: string | null;
  onChangeLookup: (teamId: number, patch: Partial<TeamLookupState>) => void;
  onAddOperator: (teamId: number) => Promise<void>;
  onAssignPicker: (teamId: number, operatorUserId: number) => Promise<void>;
  onDeleteOperator: (teamId: number, operatorUserId: number) => Promise<void>;
  onSaveOperator: (
    teamId: number,
    operatorUserId: number,
    payload: OperatorEditState,
  ) => Promise<void>;
  onUpdateOperatorEdit: (
    teamId: number,
    operatorUserId: number,
    patch: Partial<OperatorEditState>,
  ) => void;
}) {
  const picker = draftTeam.operators.find((operator) => operator.canPick === "Y");

  return (
    <article className="rounded-[28px] border border-line bg-surface-strong px-5 py-5 shadow-[0_18px_50px_-40px_rgba(31,42,40,0.7)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-lg font-semibold text-foreground">{draftTeam.teamName}</p>
          <p className="mt-1 text-sm text-muted">
            displayOrder {draftTeam.displayOrder} · teamId {draftTeam.id}
          </p>
        </div>
        <div className="rounded-[20px] bg-surface px-4 py-3 text-xs leading-6 text-muted">
          <p>운영자 {draftTeam.operators.length}명</p>
          <p>픽커 {picker ? picker.operatorName : "미지정"}</p>
        </div>
      </div>

      <div className="mt-5 rounded-[24px] border border-line bg-surface px-4 py-4">
        <p className="text-sm font-semibold text-foreground">
          userId 자동완성으로 운영자 등록
        </p>
        <p className="mt-2 text-sm leading-7 text-muted">
          일부만 입력해도 검색 결과가 내려온다. 선택하면 userPk가 자동으로
          채워지고, 필요하면 직접 수정할 수 있다.
        </p>

        <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1.2fr)_140px_140px_120px_auto]">
          <UserAutocompleteInput
            value={lookupState.query}
            placeholder="userId 검색"
            onValueChange={(value) => {
              onChangeLookup(draftTeam.id, {
                query: value,
                selectedUser: null,
              });
            }}
            onSelect={(user) => {
              onChangeLookup(draftTeam.id, {
                query: user.userId,
                operatorUserId: String(user.id),
                selectedUser: user,
              });
            }}
          />
          <Input
            value={lookupState.operatorUserId}
            onChange={(event) => {
              onChangeLookup(draftTeam.id, {
                operatorUserId: event.target.value,
              });
            }}
            placeholder="userPk"
          />
          <select
            className={SELECT_CLASS_NAME}
            value={lookupState.role}
            onChange={(event) => {
              onChangeLookup(draftTeam.id, {
                role: event.target.value,
              });
            }}
          >
            {ROLE_OPTIONS.map((role) => (
              <option key={role} value={role}>
                {role}
              </option>
            ))}
          </select>
          <select
            className={SELECT_CLASS_NAME}
            value={lookupState.isActive}
            onChange={(event) => {
              onChangeLookup(draftTeam.id, {
                isActive: event.target.value,
              });
            }}
          >
            {ACTIVE_OPTIONS.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
          <Button
            variant="accent"
            disabled={pendingAction !== null || !lookupState.operatorUserId.trim()}
            onClick={() => {
              void onAddOperator(draftTeam.id);
            }}
          >
            {pendingAction === `operator-add:${draftTeam.id}` ? "등록 중" : "등록"}
          </Button>
        </div>

        {lookupState.selectedUser ? (
          <div className="mt-4 rounded-[20px] bg-surface-muted px-4 py-4">
            <p className="text-sm font-semibold text-foreground">
              선택됨: {lookupState.selectedUser.userId}
            </p>
            <p className="mt-1 text-sm text-muted">
              {lookupState.selectedUser.name ?? "이름 없음"}
              {lookupState.selectedUser.tier
                ? ` · ${lookupState.selectedUser.tier}`
                : ""}
              {lookupState.selectedUser.race
                ? ` · ${lookupState.selectedUser.race}`
                : ""}
            </p>
            <p className="mt-2 text-xs leading-6 text-muted">
              userPk {lookupState.selectedUser.id}이 자동으로 입력되었다.
            </p>
          </div>
        ) : null}
      </div>

      <div className="mt-5 space-y-3">
        {draftTeam.operators.length === 0 ? (
          <p className="rounded-[22px] border border-dashed border-line px-4 py-6 text-sm text-muted">
            아직 등록된 운영자가 없다.
          </p>
        ) : (
          draftTeam.operators.map((operator) => {
            const key = createOperatorKey(draftTeam.id, operator.operatorUserId);
            const editState = operatorEdits[key] ?? {
              role: operator.role,
              isActive: operator.isActive,
            };

            return (
              <OperatorRow
                key={key}
                draftTeamId={draftTeam.id}
                editState={editState}
                operator={operator}
                pendingAction={pendingAction}
                onChange={(patch) => {
                  onUpdateOperatorEdit(draftTeam.id, operator.operatorUserId, patch);
                }}
                onAssignPicker={() => onAssignPicker(draftTeam.id, operator.operatorUserId)}
                onDelete={() => onDeleteOperator(draftTeam.id, operator.operatorUserId)}
                onSave={() =>
                  onSaveOperator(draftTeam.id, operator.operatorUserId, editState)
                }
              />
            );
          })
        )}
      </div>
    </article>
  );
}

function CandidateRow({
  candidate,
  editState,
  pendingAction,
  teams,
  onChange,
  onDelete,
  onSave,
}: {
  candidate: DraftCandidate;
  editState: CandidateEditState;
  pendingAction: string | null;
  teams: DraftLiveTeam[];
  onChange: (patch: Partial<CandidateEditState>) => void;
  onDelete: () => Promise<void>;
  onSave: () => Promise<void>;
}) {
  const isPicked = editState.status === "PICKED";

  return (
    <div className="rounded-[24px] border border-line bg-surface-strong px-4 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-foreground">
            {candidate.candidateName}
          </p>
          <p className="mt-1 text-xs text-muted">
            userPk {candidate.candidateUserId}
            {candidate.race ? ` · ${candidate.race}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <span
            className={cn(
              "rounded-full px-3 py-1 text-xs font-semibold",
              getCandidateStatusClassName(editState.status),
            )}
          >
            {formatCandidateStatus(editState.status)}
          </span>
          <Button
            size="sm"
            disabled={pendingAction !== null}
            onClick={() => {
              void onSave();
            }}
          >
            {pendingAction === `candidate-save:${candidate.candidateUserId}`
              ? "저장 중"
              : "저장"}
          </Button>
          <Button
            size="sm"
            variant="danger"
            disabled={pendingAction !== null}
            onClick={() => {
              void onDelete();
            }}
          >
            {pendingAction === `candidate-delete:${candidate.candidateUserId}`
              ? "삭제 중"
              : "삭제"}
          </Button>
        </div>
      </div>

      <div className="mt-4 grid gap-3 xl:grid-cols-2">
        <Input
          value={editState.candidateName}
          onChange={(event) => {
            onChange({ candidateName: event.target.value });
          }}
          placeholder="candidateName"
        />
        <select
          className={SELECT_CLASS_NAME}
          value={editState.race}
          onChange={(event) => {
            onChange({ race: event.target.value });
          }}
        >
          {RACE_OPTIONS.map((race) => (
            <option key={race} value={race}>
              {race}
            </option>
          ))}
        </select>
        <select
          className={SELECT_CLASS_NAME}
          value={editState.status}
          onChange={(event) => {
            onChange({ status: event.target.value });
          }}
        >
          {CANDIDATE_STATUS_OPTIONS.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
        <select
          className={SELECT_CLASS_NAME}
          value={editState.pickedDraftTeamId}
          disabled={!isPicked}
          onChange={(event) => {
            onChange({ pickedDraftTeamId: event.target.value });
          }}
        >
          <option value="">지명 팀 없음</option>
          {teams.map((team) => (
            <option key={team.id} value={team.id}>
              {team.teamName} (teamId {team.id})
            </option>
          ))}
        </select>
        <Input
          type="datetime-local"
          value={editState.pickedAt}
          disabled={!isPicked}
          onChange={(event) => {
            onChange({ pickedAt: event.target.value });
          }}
        />
      </div>

      {candidate.pickedDraftTeamName ? (
        <p className="mt-3 text-sm text-muted">
          현재 기록: {candidate.pickedDraftTeamName} · {formatDateTime(candidate.pickedAt)}
        </p>
      ) : null}
    </div>
  );
}

function OrderRow({
  editState,
  order,
  pendingAction,
  teams,
  onChange,
  onDelete,
  onSave,
}: {
  editState: OrderEditState;
  order: DraftOrder;
  pendingAction: string | null;
  teams: DraftLiveTeam[];
  onChange: (patch: Partial<OrderEditState>) => void;
  onDelete: () => Promise<void>;
  onSave: () => Promise<void>;
}) {
  return (
    <div className="rounded-[24px] border border-line bg-surface-strong px-4 py-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-foreground">
            Pick {order.pickNo}
          </p>
          <p className="mt-1 text-xs text-muted">
            현재 팀 {order.draftTeamName} · round {order.roundNo}
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
            {pendingAction === `order-save:${order.pickNo}` ? "저장 중" : "저장"}
          </Button>
          <Button
            size="sm"
            variant="danger"
            disabled={pendingAction !== null}
            onClick={() => {
              void onDelete();
            }}
          >
            {pendingAction === `order-delete:${order.pickNo}` ? "삭제 중" : "삭제"}
          </Button>
        </div>
      </div>

      <div className="mt-4 grid gap-3 xl:grid-cols-3">
        <Input
          type="number"
          min={1}
          value={editState.roundNo}
          onChange={(event) => {
            onChange({ roundNo: event.target.value });
          }}
          placeholder="roundNo"
        />
        <Input
          type="number"
          min={1}
          value={editState.pickNo}
          onChange={(event) => {
            onChange({ pickNo: event.target.value });
          }}
          placeholder="pickNo"
        />
        <select
          className={SELECT_CLASS_NAME}
          value={editState.draftTeamId}
          onChange={(event) => {
            onChange({ draftTeamId: event.target.value });
          }}
        >
          <option value="">팀 선택</option>
          {teams.map((team) => (
            <option key={team.id} value={team.id}>
              {team.displayOrder}. {team.teamName} (teamId {team.id})
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

function PickRow({
  pick,
  pendingAction,
  onDelete,
}: {
  pick: DraftPick;
  pendingAction: string | null;
  onDelete: () => Promise<void>;
}) {
  return (
    <div className="rounded-[24px] border border-line bg-surface-strong px-4 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-foreground">
            Pick {pick.pickNo} · {pick.candidateName}
          </p>
          <p className="mt-1 text-xs text-muted">
            {pick.draftTeamName} · pickedBy {pick.pickedByUserName} · round {pick.roundNo}
          </p>
          <p className="mt-2 text-sm text-muted">{formatDateTime(pick.pickedAt)}</p>
        </div>
        <Button
          size="sm"
          variant="danger"
          disabled={pendingAction !== null}
          onClick={() => {
            void onDelete();
          }}
        >
          {pendingAction === `pick-delete:${pick.pickNo}` ? "삭제 중" : "픽 삭제"}
        </Button>
      </div>
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
  const [teamLookups, setTeamLookups] = useState<Record<number, TeamLookupState>>(
    {},
  );
  const [candidateForm, setCandidateForm] =
    useState<CandidateFormState>(EMPTY_CANDIDATE_FORM);
  const [orderForm, setOrderForm] = useState<OrderFormState>(EMPTY_ORDER_FORM);
  const [teamEdits, setTeamEdits] = useState<Record<number, TeamEditState>>({});
  const [operatorEdits, setOperatorEdits] = useState<
    Record<string, OperatorEditState>
  >({});
  const [candidateEdits, setCandidateEdits] = useState<
    Record<number, CandidateEditState>
  >({});
  const [orderEdits, setOrderEdits] = useState<Record<number, OrderEditState>>({});
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [notice, setNotice] = useState<NoticeState | null>(null);

  const sortedTeams = selectedSessionDetail ? sortTeams(selectedSessionDetail.teams) : [];
  const sortedCandidates = selectedSessionDetail
    ? sortCandidates(selectedSessionDetail.candidates)
    : [];
  const sortedOrders = selectedSessionDetail ? sortOrders(selectedSessionDetail.orders) : [];
  const sortedPicks = selectedSessionDetail ? sortPicks(selectedSessionDetail.picks) : [];
  const operatorCount = sortedTeams.reduce(
    (count, team) => count + team.operators.length,
    0,
  );
  const pickerTeamCount = sortedTeams.filter((team) =>
    team.operators.some((operator) => operator.canPick === "Y"),
  ).length;
  const waitingCandidateCount = sortedCandidates.filter(
    (candidate) => candidate.status === "WAITING",
  ).length;

  function notifyChange() {
    onDataChanged?.();
  }

  function resetDetailState() {
    startTransition(() => {
      setSelectedSessionDetail(null);
      setEditForm(EMPTY_EDIT_FORM);
      setTeamForm(createDefaultTeamForm());
      setTeamLookups({});
      setCandidateForm(EMPTY_CANDIDATE_FORM);
      setOrderForm(EMPTY_ORDER_FORM);
      setTeamEdits({});
      setOperatorEdits({});
      setCandidateEdits({});
      setOrderEdits({});
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
      setTeamForm(createDefaultTeamForm(detail));
      setTeamLookups(createInitialTeamLookups(detail));
      setCandidateForm(EMPTY_CANDIDATE_FORM);
      setOrderForm(createDefaultOrderForm(detail));
      setTeamEdits(createInitialTeamEdits(detail));
      setOperatorEdits(createInitialOperatorEdits(detail));
      setCandidateEdits(createInitialCandidateEdits(detail));
      setOrderEdits(createInitialOrderEdits(detail));
    });
  }

  async function refreshSelectedSession(sessionId: number) {
    const [nextSessions, detail] = await Promise.all([
      listDraftSessions(),
      getDraftSessionDetail(sessionId),
    ]);

    startTransition(() => {
      setSessions(sortSessions(nextSessions));
      setSelectedSessionId(sessionId);
    });

    applyDetail(detail);
    notifyChange();

    return detail;
  }

  async function syncAfterSessionDelete() {
    const nextSessions = sortSessions(await listDraftSessions());
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
        const nextSessions = sortSessions(await listDraftSessions());

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

        setNotice({
          tone: "error",
          text: readErrorMessage(error),
        });
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

        setNotice({
          tone: "error",
          text: readErrorMessage(error),
        });
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

  function updateLookup(teamId: number, patch: Partial<TeamLookupState>) {
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

  function updateOperatorEdit(
    teamId: number,
    operatorUserId: number,
    patch: Partial<OperatorEditState>,
  ) {
    const key = createOperatorKey(teamId, operatorUserId);

    setOperatorEdits((current) => ({
      ...current,
      [key]: {
        ...(current[key] ?? {
          role: "OPERATOR",
          isActive: "Y",
        }),
        ...patch,
      },
    }));
  }

  function updateCandidateEdit(
    candidateUserId: number,
    patch: Partial<CandidateEditState>,
  ) {
    setCandidateEdits((current) => ({
      ...current,
      [candidateUserId]: {
        ...(current[candidateUserId] ?? {
          candidateName: "",
          race: "TERRAN",
          status: "WAITING",
          pickedDraftTeamId: "",
          pickedAt: "",
        }),
        ...patch,
      },
    }));
  }

  function updateOrderEdit(pickNo: number, patch: Partial<OrderEditState>) {
    setOrderEdits((current) => ({
      ...current,
      [pickNo]: {
        ...(current[pickNo] ?? {
          roundNo: "",
          pickNo: "",
          draftTeamId: "",
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
        pickTimeSeconds: parsePositiveInt(
          createForm.pickTimeSeconds,
          "픽 제한 시간",
        ),
      };

      if (!payload.title) {
        throw new Error("세션 이름을 입력해야 합니다.");
      }

      const created = await createDraftSession(payload);
      await refreshSelectedSession(created.id);
      setCreateForm(EMPTY_CREATE_FORM);
      setNotice({
        tone: "success",
        text: "세션을 생성했습니다.",
      });
    } catch (error) {
      setNotice({
        tone: "error",
        text: readErrorMessage(error),
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
        pickTimeSeconds: parsePositiveInt(
          editForm.pickTimeSeconds,
          "픽 제한 시간",
        ),
      };

      if (!payload.title) {
        throw new Error("세션 이름을 입력해야 합니다.");
      }

      await updateDraftSession(selectedSessionId, payload);
      await refreshSelectedSession(selectedSessionId);
      setNotice({
        tone: "success",
        text: "세션 정보를 저장했습니다.",
      });
    } catch (error) {
      setNotice({
        tone: "error",
        text: readErrorMessage(error),
      });
    } finally {
      setPendingAction(null);
    }
  }

  async function handleDeleteSession() {
    if (selectedSessionId === null) {
      return;
    }

    setPendingAction("session-delete");
    setNotice(null);

    try {
      await deleteDraftSession(selectedSessionId);
      await syncAfterSessionDelete();
      setNotice({
        tone: "success",
        text: "세션을 삭제했습니다.",
      });
    } catch (error) {
      setNotice({
        tone: "error",
        text: readErrorMessage(error),
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
        throw new Error("팀 이름을 입력해야 합니다.");
      }

      const detail = await createDraftTeam(payload).then(() =>
        refreshSelectedSession(selectedSessionId),
      );
      setTeamForm(createDefaultTeamForm(detail));
      setNotice({
        tone: "success",
        text: "팀을 생성했습니다.",
      });
    } catch (error) {
      setNotice({
        tone: "error",
        text: readErrorMessage(error),
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
        throw new Error("팀 이름을 입력해야 합니다.");
      }

      await updateDraftTeam(teamId, payload);
      await refreshSelectedSession(selectedSessionId);
      setNotice({
        tone: "success",
        text: "팀 정보를 저장했습니다.",
      });
    } catch (error) {
      setNotice({
        tone: "error",
        text: readErrorMessage(error),
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
        text: "팀을 삭제했습니다.",
      });
    } catch (error) {
      setNotice({
        tone: "error",
        text: readErrorMessage(error),
      });
    } finally {
      setPendingAction(null);
    }
  }

  async function handleAddOperator(teamId: number) {
    if (selectedSessionId === null) {
      return;
    }

    const lookup = teamLookups[teamId];

    if (!lookup) {
      return;
    }

    setPendingAction(`operator-add:${teamId}`);
    setNotice(null);

    try {
      const payload = {
        draftTeamId: teamId,
        operatorUserId: parsePositiveInt(lookup.operatorUserId, "운영자 userPk"),
        role: lookup.role,
        isActive: lookup.isActive,
      };

      await createDraftTeamOperator(payload);
      await refreshSelectedSession(selectedSessionId);
      setNotice({
        tone: "success",
        text: "운영자를 등록했습니다.",
      });
    } catch (error) {
      setNotice({
        tone: "error",
        text: readErrorMessage(error),
      });
    } finally {
      setPendingAction(null);
    }
  }

  async function handleSaveOperator(
    teamId: number,
    operatorUserId: number,
    payload: OperatorEditState,
  ) {
    if (selectedSessionId === null) {
      return;
    }

    const actionKey = `operator-save:${createOperatorKey(teamId, operatorUserId)}`;
    setPendingAction(actionKey);
    setNotice(null);

    try {
      await updateDraftTeamOperator(teamId, operatorUserId, payload);
      await refreshSelectedSession(selectedSessionId);
      setNotice({
        tone: "success",
        text: "운영자 정보를 저장했습니다.",
      });
    } catch (error) {
      setNotice({
        tone: "error",
        text: readErrorMessage(error),
      });
    } finally {
      setPendingAction(null);
    }
  }

  async function handleDeleteOperator(teamId: number, operatorUserId: number) {
    if (selectedSessionId === null) {
      return;
    }

    const actionKey = `operator-delete:${createOperatorKey(
      teamId,
      operatorUserId,
    )}`;
    setPendingAction(actionKey);
    setNotice(null);

    try {
      await deleteDraftTeamOperator(teamId, operatorUserId);
      await refreshSelectedSession(selectedSessionId);
      setNotice({
        tone: "success",
        text: "운영자를 삭제했습니다.",
      });
    } catch (error) {
      setNotice({
        tone: "error",
        text: readErrorMessage(error),
      });
    } finally {
      setPendingAction(null);
    }
  }

  async function handleAssignPicker(teamId: number, operatorUserId: number) {
    if (selectedSessionId === null) {
      return;
    }

    const actionKey = `operator-picker:${createOperatorKey(
      teamId,
      operatorUserId,
    )}`;
    setPendingAction(actionKey);
    setNotice(null);

    try {
      await assignDraftPicker(teamId, operatorUserId);
      await refreshSelectedSession(selectedSessionId);
      setNotice({
        tone: "success",
        text: "픽커를 지정했습니다.",
      });
    } catch (error) {
      setNotice({
        tone: "error",
        text: readErrorMessage(error),
      });
    } finally {
      setPendingAction(null);
    }
  }

  async function handleCreateCandidate() {
    if (selectedSessionId === null) {
      return;
    }

    setPendingAction("candidate-create");
    setNotice(null);

    try {
      const payload = {
        draftSessionId: selectedSessionId,
        candidateUserId: parsePositiveInt(
          candidateForm.candidateUserId,
          "후보 userPk",
        ),
        candidateName: candidateForm.candidateName.trim(),
        race: candidateForm.race,
        status: candidateForm.status,
      };

      if (!payload.candidateName) {
        throw new Error("후보 이름을 입력해야 합니다.");
      }

      await createDraftCandidate(payload);
      await refreshSelectedSession(selectedSessionId);
      setCandidateForm(EMPTY_CANDIDATE_FORM);
      setNotice({
        tone: "success",
        text: "후보를 등록했습니다.",
      });
    } catch (error) {
      setNotice({
        tone: "error",
        text: readErrorMessage(error),
      });
    } finally {
      setPendingAction(null);
    }
  }

  async function handleSaveCandidate(candidateUserId: number) {
    if (selectedSessionId === null) {
      return;
    }

    const editState = candidateEdits[candidateUserId];

    if (!editState) {
      return;
    }

    setPendingAction(`candidate-save:${candidateUserId}`);
    setNotice(null);

    try {
      const isPicked = editState.status === "PICKED";
      const payload = {
        draftSessionId: selectedSessionId,
        candidateUserId,
        candidateName: editState.candidateName.trim(),
        race: editState.race,
        status: editState.status,
        pickedDraftTeamId:
          isPicked && editState.pickedDraftTeamId
            ? parsePositiveInt(editState.pickedDraftTeamId, "지명 팀")
            : null,
        pickedAt: isPicked && editState.pickedAt ? editState.pickedAt : null,
      };

      if (!payload.candidateName) {
        throw new Error("후보 이름을 입력해야 합니다.");
      }

      await updateDraftCandidate(selectedSessionId, candidateUserId, payload);
      await refreshSelectedSession(selectedSessionId);
      setNotice({
        tone: "success",
        text: "후보 정보를 저장했습니다.",
      });
    } catch (error) {
      setNotice({
        tone: "error",
        text: readErrorMessage(error),
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
        text: "후보를 삭제했습니다.",
      });
    } catch (error) {
      setNotice({
        tone: "error",
        text: readErrorMessage(error),
      });
    } finally {
      setPendingAction(null);
    }
  }

  async function handleCreateOrder() {
    if (selectedSessionId === null) {
      return;
    }

    setPendingAction("order-create");
    setNotice(null);

    try {
      const payload = {
        draftSessionId: selectedSessionId,
        roundNo: parsePositiveInt(orderForm.roundNo, "라운드"),
        pickNo: parsePositiveInt(orderForm.pickNo, "픽 번호"),
        draftTeamId: parsePositiveInt(orderForm.draftTeamId, "팀"),
      };

      const detail = await createDraftOrder(payload).then(() =>
        refreshSelectedSession(selectedSessionId),
      );
      setOrderForm(createDefaultOrderForm(detail));
      setNotice({
        tone: "success",
        text: "드래프트 순서를 등록했습니다.",
      });
    } catch (error) {
      setNotice({
        tone: "error",
        text: readErrorMessage(error),
      });
    } finally {
      setPendingAction(null);
    }
  }

  async function handleSaveOrder(originalPickNo: number) {
    if (selectedSessionId === null) {
      return;
    }

    const editState = orderEdits[originalPickNo];

    if (!editState) {
      return;
    }

    setPendingAction(`order-save:${originalPickNo}`);
    setNotice(null);

    try {
      const payload = {
        draftSessionId: selectedSessionId,
        roundNo: parsePositiveInt(editState.roundNo, "라운드"),
        pickNo: parsePositiveInt(editState.pickNo, "픽 번호"),
        draftTeamId: parsePositiveInt(editState.draftTeamId, "팀"),
      };

      await updateDraftOrder(selectedSessionId, originalPickNo, payload);
      await refreshSelectedSession(selectedSessionId);
      setNotice({
        tone: "success",
        text: "드래프트 순서를 저장했습니다.",
      });
    } catch (error) {
      setNotice({
        tone: "error",
        text: readErrorMessage(error),
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
      const detail = await deleteDraftOrder(selectedSessionId, pickNo).then(() =>
        refreshSelectedSession(selectedSessionId),
      );
      setOrderForm(createDefaultOrderForm(detail));
      setNotice({
        tone: "success",
        text: "드래프트 순서를 삭제했습니다.",
      });
    } catch (error) {
      setNotice({
        tone: "error",
        text: readErrorMessage(error),
      });
    } finally {
      setPendingAction(null);
    }
  }

  async function handleDeletePick(pickNo: number) {
    if (selectedSessionId === null) {
      return;
    }

    setPendingAction(`pick-delete:${pickNo}`);
    setNotice(null);

    try {
      await deleteDraftPick(selectedSessionId, pickNo);
      await refreshSelectedSession(selectedSessionId);
      setNotice({
        tone: "success",
        text: "픽 기록을 삭제했습니다. 필요하면 후보 상태와 순서를 아래 섹션에서 바로 보정해 주세요.",
      });
    } catch (error) {
      setNotice({
        tone: "error",
        text: readErrorMessage(error),
      });
    } finally {
      setPendingAction(null);
    }
  }

  return (
    <div className="space-y-4">
      {notice ? (
        <SurfaceCard className="p-5 sm:p-6">
          <div
            className={cn(
              "rounded-[22px] px-4 py-4 text-sm leading-7",
              getNoticeClassName(notice.tone),
            )}
          >
            {notice.text}
          </div>
        </SurfaceCard>
      ) : null}

      <SurfaceCard className="p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-foreground">
              관리자 드래프트 준비/정리 콘솔
            </p>
            <p className="mt-2 text-sm leading-7 text-muted">
              세션, 팀, 운영자, 후보, 순서, 픽 기록을 준비하고 보정하는 화면이다.
              실시간 start/pause/resume/extend/skip/finish는 아래 라이브 보드에서
              처리하고, 여기서는 CRUD와 복구 작업에 집중한다.
            </p>
          </div>

          {selectedSessionDetail ? (
            <div className="rounded-[24px] bg-surface-muted px-4 py-4 text-sm leading-7 text-muted">
              <p className="font-semibold text-foreground">
                {selectedSessionDetail.title}
              </p>
              <p>상태: {formatSessionStatus(selectedSessionDetail.status)}</p>
              <p>현재 픽: {selectedSessionDetail.currentPickNo ?? "-"}</p>
              <p>현재 팀: {selectedSessionDetail.currentDraftTeamId ?? "-"}</p>
            </div>
          ) : (
            <div className="rounded-[24px] border border-dashed border-line px-4 py-4 text-sm text-muted">
              세션을 선택하면 준비 현황이 표시된다.
            </div>
          )}
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-6">
          <SetupStatCard
            label="팀"
            value={selectedSessionDetail ? String(sortedTeams.length) : "0"}
            description="팀 생성/수정/삭제"
            ready={sortedTeams.length > 0}
          />
          <SetupStatCard
            label="운영자"
            value={String(operatorCount)}
            description="자동완성 검색으로 등록"
            ready={operatorCount > 0}
          />
          <SetupStatCard
            label="픽커 팀"
            value={String(pickerTeamCount)}
            description="팀별 현재 픽커 수"
            ready={pickerTeamCount > 0}
          />
          <SetupStatCard
            label="후보"
            value={String(sortedCandidates.length)}
            description="WAITING/PICKED/SKIPPED/EXCLUDED"
            ready={sortedCandidates.length > 0}
          />
          <SetupStatCard
            label="순서"
            value={String(sortedOrders.length)}
            description="드래프트 order 편집"
            ready={sortedOrders.length > 0}
          />
          <SetupStatCard
            label="픽 기록"
            value={String(sortedPicks.length)}
            description="삭제 후 후보/순서 보정 가능"
            ready={sortedPicks.length > 0}
          />
        </div>
      </SurfaceCard>

      <div className="grid gap-4 xl:grid-cols-2">
        <SurfaceCard className="p-6">
          <p className="text-sm font-semibold text-foreground">세션 생성</p>
          <div className="mt-4 grid gap-3">
            <Input
              value={createForm.title}
              onChange={(event) => {
                setCreateForm((current) => ({
                  ...current,
                  title: event.target.value,
                }));
              }}
              placeholder="세션 이름"
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
            </div>
            <Button
              variant="accent"
              disabled={pendingAction !== null || !createForm.title.trim()}
              onClick={() => {
                void handleCreateSession();
              }}
            >
              {pendingAction === "session-create" ? "생성 중" : "세션 생성"}
            </Button>
          </div>
        </SurfaceCard>

        <SurfaceCard className="p-6">
          <p className="text-sm font-semibold text-foreground">
            세션 선택 / 수정 / 삭제
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
                <option value="">세션 목록 불러오는 중</option>
              ) : sessions.length === 0 ? (
                <option value="">세션 없음</option>
              ) : null}

              {sessions.map((session) => (
                <option key={session.id} value={session.id}>
                  {session.title} · {formatSessionStatus(session.status)}
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
              placeholder="세션 이름"
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
                <p>상태: {formatSessionStatus(selectedSessionDetail.status)}</p>
                <p>시작: {formatDateTime(selectedSessionDetail.startedAt)}</p>
                <p>종료: {formatDateTime(selectedSessionDetail.endedAt)}</p>
              </div>
            ) : (
              <div className="rounded-[22px] border border-dashed border-line px-4 py-4 text-sm text-muted">
                {loadingDetail
                  ? "세션 정보를 불러오는 중이다."
                  : "수정할 세션을 선택해 주세요."}
              </div>
            )}

            <div className="grid gap-2 sm:grid-cols-2">
              <Button
                disabled={pendingAction !== null || selectedSessionId === null}
                onClick={() => {
                  void handleUpdateSession();
                }}
              >
                {pendingAction === "session-save" ? "저장 중" : "세션 저장"}
              </Button>
              <Button
                variant="danger"
                disabled={pendingAction !== null || selectedSessionId === null}
                onClick={() => {
                  void handleDeleteSession();
                }}
              >
                {pendingAction === "session-delete" ? "삭제 중" : "세션 삭제"}
              </Button>
            </div>
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
              팀은 세션 내부 준비의 기준 데이터다. displayOrder를 수정하면 순서
              기본값 계산에도 반영된다.
            </p>
          </div>
          {selectedSessionDetail ? (
            <div className="rounded-[22px] bg-surface-muted px-4 py-3 text-sm text-muted">
              세션 팀 수 {sortedTeams.length} / 목표 {selectedSessionDetail.teamCount}
            </div>
          ) : null}
        </div>

        {!selectedSessionDetail ? (
          <div className="mt-5 rounded-[24px] border border-dashed border-line px-5 py-10 text-center text-sm text-muted">
            먼저 세션을 선택해 주세요.
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
                <Input
                  type="number"
                  min={1}
                  value={teamForm.displayOrder}
                  onChange={(event) => {
                    setTeamForm((current) => ({
                      ...current,
                      displayOrder: event.target.value,
                    }));
                  }}
                  placeholder="displayOrder"
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
                  아직 등록된 팀이 없다.
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
            <p className="text-sm font-semibold text-foreground">
              운영자 등록 / 수정 / 삭제 / 픽커 지정
            </p>
            <p className="mt-2 text-sm leading-7 text-muted">
              userId 자동완성으로 운영자를 찾고, 선택한 결과에서 userPk를 자동으로
              채운다. 자동값이 맞지 않으면 수동으로 수정할 수 있다.
            </p>
          </div>
          {selectedSessionDetail ? (
            <div className="rounded-[22px] bg-surface-muted px-4 py-3 text-sm text-muted">
              운영자 {operatorCount}명 · 픽커 팀 {pickerTeamCount}개
            </div>
          ) : null}
        </div>

        <div className="mt-5">
          {!selectedSessionDetail ? (
            <div className="rounded-[24px] border border-dashed border-line px-5 py-10 text-center text-sm text-muted">
              세션을 먼저 선택해 주세요.
            </div>
          ) : sortedTeams.length === 0 ? (
            <div className="rounded-[24px] border border-dashed border-line px-5 py-10 text-center text-sm text-muted">
              팀을 먼저 만든 뒤 운영자를 등록해 주세요.
            </div>
          ) : (
            <div className="grid gap-4 xl:grid-cols-2">
              {sortedTeams.map((team) => (
                <TeamOperatorManager
                  key={team.id}
                  draftTeam={team}
                  lookupState={teamLookups[team.id] ?? createEmptyTeamLookupState()}
                  operatorEdits={operatorEdits}
                  pendingAction={pendingAction}
                  onChangeLookup={updateLookup}
                  onAddOperator={handleAddOperator}
                  onAssignPicker={handleAssignPicker}
                  onDeleteOperator={handleDeleteOperator}
                  onSaveOperator={handleSaveOperator}
                  onUpdateOperatorEdit={updateOperatorEdit}
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
                후보 등록 / 수정 / 삭제
              </p>
              <p className="mt-2 text-sm leading-7 text-muted">
                후보도 userId 자동완성으로 검색할 수 있다. 상태는 WAITING, PICKED,
                SKIPPED, EXCLUDED 전체를 지원한다.
              </p>
            </div>
            <div className="rounded-[22px] bg-surface-muted px-4 py-3 text-sm text-muted">
              WAITING {waitingCandidateCount}명
            </div>
          </div>

          {!selectedSessionDetail ? (
            <div className="mt-5 rounded-[24px] border border-dashed border-line px-5 py-10 text-center text-sm text-muted">
              세션을 먼저 선택해 주세요.
            </div>
          ) : (
            <>
              <div className="mt-5 rounded-[24px] border border-line bg-surface-strong px-4 py-4">
                <div className="grid gap-3">
                  <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_140px]">
                    <UserAutocompleteInput
                      value={candidateForm.query}
                      placeholder="userId 검색"
                      onValueChange={(value) => {
                        setCandidateForm((current) => ({
                          ...current,
                          query: value,
                          selectedUser: null,
                        }));
                      }}
                      onSelect={(user) => {
                        setCandidateForm((current) => ({
                          ...current,
                          query: user.userId,
                          candidateUserId: String(user.id),
                          candidateName: current.candidateName || user.userId,
                          race: normalizeRace(user.race) ?? current.race,
                          selectedUser: user,
                        }));
                      }}
                    />
                    <Input
                      value={candidateForm.candidateUserId}
                      onChange={(event) => {
                        setCandidateForm((current) => ({
                          ...current,
                          candidateUserId: event.target.value,
                        }));
                      }}
                      placeholder="candidateUserId"
                    />
                  </div>

                  <Input
                    value={candidateForm.candidateName}
                    onChange={(event) => {
                      setCandidateForm((current) => ({
                        ...current,
                        candidateName: event.target.value,
                      }));
                    }}
                    placeholder="candidateName"
                  />

                  <div className="grid gap-3 md:grid-cols-2">
                    <select
                      className={SELECT_CLASS_NAME}
                      value={candidateForm.race}
                      onChange={(event) => {
                        setCandidateForm((current) => ({
                          ...current,
                          race: event.target.value,
                        }));
                      }}
                    >
                      {RACE_OPTIONS.map((race) => (
                        <option key={race} value={race}>
                          {race}
                        </option>
                      ))}
                    </select>
                    <select
                      className={SELECT_CLASS_NAME}
                      value={candidateForm.status}
                      onChange={(event) => {
                        setCandidateForm((current) => ({
                          ...current,
                          status: event.target.value,
                        }));
                      }}
                    >
                      {CANDIDATE_STATUS_OPTIONS.map((status) => (
                        <option key={status} value={status}>
                          {status}
                        </option>
                      ))}
                    </select>
                  </div>

                  <Button
                    variant="accent"
                    disabled={
                      pendingAction !== null ||
                      !candidateForm.candidateUserId.trim() ||
                      !candidateForm.candidateName.trim()
                    }
                    onClick={() => {
                      void handleCreateCandidate();
                    }}
                  >
                    {pendingAction === "candidate-create" ? "등록 중" : "후보 등록"}
                  </Button>
                </div>

                {candidateForm.selectedUser ? (
                  <div className="mt-4 rounded-[20px] bg-surface-muted px-4 py-4">
                    <p className="text-sm font-semibold text-foreground">
                      선택됨: {candidateForm.selectedUser.userId}
                    </p>
                    <p className="mt-1 text-sm text-muted">
                      {candidateForm.selectedUser.name ?? "이름 없음"}
                      {candidateForm.selectedUser.tier
                        ? ` · ${candidateForm.selectedUser.tier}`
                        : ""}
                      {candidateForm.selectedUser.race
                        ? ` · ${candidateForm.selectedUser.race}`
                        : ""}
                    </p>
                    <p className="mt-2 text-xs leading-6 text-muted">
                      userPk {candidateForm.selectedUser.id}이 자동으로 입력되었다.
                    </p>
                  </div>
                ) : null}
              </div>

              <div className="mt-5 space-y-3">
                {sortedCandidates.length === 0 ? (
                  <div className="rounded-[24px] border border-dashed border-line px-5 py-10 text-center text-sm text-muted">
                    아직 등록된 후보가 없다.
                  </div>
                ) : (
                  sortedCandidates.map((candidate) => (
                    <CandidateRow
                      key={candidate.candidateUserId}
                      candidate={candidate}
                      editState={
                        candidateEdits[candidate.candidateUserId] ?? {
                          candidateName: candidate.candidateName,
                          race: normalizeRace(candidate.race) ?? "TERRAN",
                          status: candidate.status,
                          pickedDraftTeamId: candidate.pickedDraftTeamId
                            ? String(candidate.pickedDraftTeamId)
                            : "",
                          pickedAt: toDateTimeLocalValue(candidate.pickedAt),
                        }
                      }
                      pendingAction={pendingAction}
                      teams={sortedTeams}
                      onChange={(patch) => {
                        updateCandidateEdit(candidate.candidateUserId, patch);
                      }}
                      onDelete={() => handleDeleteCandidate(candidate.candidateUserId)}
                      onSave={() => handleSaveCandidate(candidate.candidateUserId)}
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
                순서 등록 / 수정 / 삭제
              </p>
              <p className="mt-2 text-sm leading-7 text-muted">
                기본값은 현재 팀 수와 pickNo를 기준으로 자동 계산한다. 필요하면
                roundNo, pickNo, 팀을 직접 바꿔서 저장하면 된다.
              </p>
            </div>
            <div className="rounded-[22px] bg-surface-muted px-4 py-3 text-sm text-muted">
              총 {sortedOrders.length}개
            </div>
          </div>

          {!selectedSessionDetail ? (
            <div className="mt-5 rounded-[24px] border border-dashed border-line px-5 py-10 text-center text-sm text-muted">
              세션을 먼저 선택해 주세요.
            </div>
          ) : sortedTeams.length === 0 ? (
            <div className="mt-5 rounded-[24px] border border-dashed border-line px-5 py-10 text-center text-sm text-muted">
              순서를 만들려면 먼저 팀이 있어야 한다.
            </div>
          ) : (
            <>
              <div className="mt-5 rounded-[24px] border border-line bg-surface-strong px-4 py-4">
                <div className="grid gap-3">
                  <div className="grid gap-3 md:grid-cols-2">
                    <Input
                      type="number"
                      min={1}
                      value={orderForm.roundNo}
                      onChange={(event) => {
                        setOrderForm((current) => ({
                          ...current,
                          roundNo: event.target.value,
                        }));
                      }}
                      placeholder="roundNo"
                    />
                    <Input
                      type="number"
                      min={1}
                      value={orderForm.pickNo}
                      onChange={(event) => {
                        setOrderForm((current) => ({
                          ...current,
                          pickNo: event.target.value,
                        }));
                      }}
                      placeholder="pickNo"
                    />
                  </div>
                  <select
                    className={SELECT_CLASS_NAME}
                    value={orderForm.draftTeamId}
                    onChange={(event) => {
                      setOrderForm((current) => ({
                        ...current,
                        draftTeamId: event.target.value,
                      }));
                    }}
                  >
                    <option value="">팀 선택</option>
                    {sortedTeams.map((team) => (
                      <option key={team.id} value={team.id}>
                        {team.displayOrder}. {team.teamName} (teamId {team.id})
                      </option>
                    ))}
                  </select>

                  <div className="flex flex-wrap gap-2">
                    <Button
                      disabled={pendingAction !== null}
                      onClick={() => {
                        setOrderForm(createDefaultOrderForm(selectedSessionDetail));
                      }}
                    >
                      기본값 다시 채우기
                    </Button>
                    <Button
                      variant="accent"
                      disabled={pendingAction !== null || !orderForm.draftTeamId}
                      onClick={() => {
                        void handleCreateOrder();
                      }}
                    >
                      {pendingAction === "order-create" ? "등록 중" : "순서 등록"}
                    </Button>
                  </div>
                </div>
              </div>

              <div className="mt-5 space-y-3">
                {sortedOrders.length === 0 ? (
                  <div className="rounded-[24px] border border-dashed border-line px-5 py-10 text-center text-sm text-muted">
                    아직 등록된 드래프트 순서가 없다.
                  </div>
                ) : (
                  sortedOrders.map((order) => (
                    <OrderRow
                      key={order.pickNo}
                      editState={
                        orderEdits[order.pickNo] ?? {
                          roundNo: String(order.roundNo),
                          pickNo: String(order.pickNo),
                          draftTeamId: String(order.draftTeamId),
                        }
                      }
                      order={order}
                      pendingAction={pendingAction}
                      teams={sortedTeams}
                      onChange={(patch) => {
                        updateOrderEdit(order.pickNo, patch);
                      }}
                      onDelete={() => handleDeleteOrder(order.pickNo)}
                      onSave={() => handleSaveOrder(order.pickNo)}
                    />
                  ))
                )}
              </div>
            </>
          )}
        </SurfaceCard>
      </div>

      <SurfaceCard className="p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-foreground">픽 기록 정리</p>
            <p className="mt-2 text-sm leading-7 text-muted">
              잘못 들어간 픽은 여기서 삭제하고, 바로 위 후보/순서 섹션에서 상태를
              보정하면 된다. 삭제 후에는 기존 refreshSelectedSession 흐름으로 즉시
              재동기화한다.
            </p>
          </div>
          <div className="rounded-[22px] bg-surface-muted px-4 py-3 text-sm text-muted">
            총 {sortedPicks.length}개
          </div>
        </div>

        {!selectedSessionDetail ? (
          <div className="mt-5 rounded-[24px] border border-dashed border-line px-5 py-10 text-center text-sm text-muted">
            세션을 먼저 선택해 주세요.
          </div>
        ) : (
          <div className="mt-5 space-y-3">
            {sortedPicks.length === 0 ? (
              <div className="rounded-[24px] border border-dashed border-line px-5 py-10 text-center text-sm text-muted">
                아직 기록된 픽이 없다.
              </div>
            ) : (
              sortedPicks.map((pick) => (
                <PickRow
                  key={pick.pickNo}
                  pick={pick}
                  pendingAction={pendingAction}
                  onDelete={() => handleDeletePick(pick.pickNo)}
                />
              ))
            )}
          </div>
        )}
      </SurfaceCard>
    </div>
  );
}
