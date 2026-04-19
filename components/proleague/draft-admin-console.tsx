"use client";

import { startTransition, useEffect, useState } from "react";
import {
  assignDraftPicker,
  createDraftCandidate,
  createDraftOrder,
  createDraftSession,
  createDraftTeam,
  createDraftTeamOperator,
  deleteDraftTeamOperator,
  finishDraftSession,
  getDraftSessionDetail,
  listDraftSessions,
  pauseDraftSession,
  resumeDraftSession,
  searchDraftUserByLoginId,
  startDraftSession,
  updateDraftSession,
  updateDraftTeamOperator,
  type DraftCandidate,
  type DraftLiveTeam,
  type DraftOrder,
  type DraftSessionDetail,
  type DraftSessionSummary,
  type DraftTeamOperator,
  type DraftUserLookup,
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
  loginId: string;
  operatorUserId: string;
  role: string;
  isActive: string;
  result: DraftUserLookup | null;
};

type CandidateFormState = {
  loginId: string;
  candidateUserId: string;
  candidateName: string;
  race: string;
  status: string;
  result: DraftUserLookup | null;
};

type OrderFormState = {
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

const ROLE_OPTIONS = ["CAPTAIN", "VICE_CAPTAIN", "OPERATOR"] as const;
const ACTIVE_OPTIONS = ["Y", "N"] as const;
const RACE_OPTIONS = ["TERRAN", "ZERG", "PROTOSS", "RANDOM"] as const;
const CANDIDATE_STATUS_OPTIONS = ["WAITING", "PICKED"] as const;

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
  loginId: "",
  candidateUserId: "",
  candidateName: "",
  race: "TERRAN",
  status: "WAITING",
  result: null,
};

const EMPTY_ORDER_FORM: OrderFormState = {
  roundNo: "1",
  pickNo: "1",
  draftTeamId: "",
};

const STATUS_LABELS: Record<string, string> = {
  READY: "준비",
  LIVE: "진행 중",
  PAUSED: "일시정지",
  FINISHED: "종료",
  CANCELLED: "취소",
};

function readErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return "요청을 처리하지 못했다. 잠시 후 다시 시도해줘.";
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

function formatDraftStatus(status: string | null | undefined) {
  if (!status) {
    return "미정";
  }

  return STATUS_LABELS[status] ?? status;
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
    if (left.status !== right.status) {
      return left.status.localeCompare(right.status);
    }

    return left.candidateName.localeCompare(right.candidateName, "ko");
  });
}

function sortOrders(orders: DraftOrder[]) {
  return [...orders].sort((left, right) => left.pickNo - right.pickNo);
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

function createEmptyTeamLookupState(): TeamLookupState {
  return {
    loginId: "",
    operatorUserId: "",
    role: "OPERATOR",
    isActive: "Y",
    result: null,
  };
}

function createInitialTeamLookups(detail: DraftSessionDetail) {
  const nextState: Record<number, TeamLookupState> = {};

  for (const team of detail.teams) {
    nextState[team.id] = createEmptyTeamLookupState();
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

function getStatusChipClassName(active: boolean) {
  return active
    ? "border border-success-ink/15 bg-success-soft text-success-ink"
    : "border border-line bg-surface-muted text-muted";
}

function getCandidateStatusClassName(status: string) {
  return status === "WAITING"
    ? "border border-success-ink/15 bg-success-soft text-success-ink"
    : "border border-line bg-surface-muted text-muted";
}

function SetupStatCard({
  label,
  value,
  description,
  ready,
}: {
  label: string;
  value: string;
  description: string;
  ready: boolean;
}) {
  return (
    <div className="rounded-[24px] border border-line bg-surface-strong px-4 py-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-foreground">{label}</p>
        <span
          className={cn(
            "rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em]",
            getStatusChipClassName(ready),
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

function OperatorRow({
  pendingAction,
  operator,
  editState,
  onChange,
  onDelete,
  onAssignPicker,
  onSave,
}: {
  pendingAction: string | null;
  operator: DraftTeamOperator;
  editState: OperatorEditState;
  onChange: (patch: Partial<OperatorEditState>) => void;
  onDelete: () => Promise<void>;
  onAssignPicker: () => Promise<void>;
  onSave: () => Promise<void>;
}) {
  const rowKey = createOperatorKey(operator.draftTeamId, operator.operatorUserId);

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
            {pendingAction === `picker:${rowKey}` ? "지정 중" : "픽커 지정"}
          </Button>
          <Button
            size="sm"
            disabled={pendingAction !== null}
            onClick={() => {
              void onSave();
            }}
          >
            {pendingAction === `save:${rowKey}` ? "저장 중" : "저장"}
          </Button>
          <Button
            size="sm"
            variant="danger"
            disabled={pendingAction !== null}
            onClick={() => {
              void onDelete();
            }}
          >
            {pendingAction === `delete:${rowKey}` ? "삭제 중" : "삭제"}
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
  onSearchUser,
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
  onSearchUser: (teamId: number) => Promise<void>;
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
          아이디 검색 후 운영자 등록
        </p>
        <p className="mt-2 text-sm leading-7 text-muted">
          <code className="rounded bg-surface-muted px-2 py-1 text-xs text-foreground">
            /user/get/{"{userId}"}
          </code>
          {" "}응답에 숫자 userPk가 없을 수 있어서, 검색 후 필요하면 userPk를 직접
          입력해야 한다.
        </p>

        <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1.1fr)_140px_140px_120px_auto]">
          <Input
            value={lookupState.loginId}
            onChange={(event) => {
              onChangeLookup(draftTeam.id, {
                loginId: event.target.value,
                result: null,
              });
            }}
            placeholder="userId 검색"
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
          <div className="flex gap-2">
            <Button
              disabled={pendingAction !== null || !lookupState.loginId.trim()}
              onClick={() => {
                void onSearchUser(draftTeam.id);
              }}
            >
              {pendingAction === `search:${draftTeam.id}` ? "검색 중" : "검색"}
            </Button>
            <Button
              variant="accent"
              disabled={
                pendingAction !== null || !lookupState.operatorUserId.trim()
              }
              onClick={() => {
                void onAddOperator(draftTeam.id);
              }}
            >
              {pendingAction === `add:${draftTeam.id}` ? "등록 중" : "등록"}
            </Button>
          </div>
        </div>

        {lookupState.result ? (
          <div className="mt-4 rounded-[20px] bg-surface-muted px-4 py-4">
            <p className="text-sm font-semibold text-foreground">
              검색 결과: {lookupState.result.userId}
            </p>
            <p className="mt-1 text-sm text-muted">
              {lookupState.result.name ?? "이름 없음"}
              {lookupState.result.tier ? ` · ${lookupState.result.tier}` : ""}
              {lookupState.result.race ? ` · ${lookupState.result.race}` : ""}
            </p>
            <p className="mt-2 text-xs leading-6 text-muted">
              {lookupState.result.resolvedUserPk
                ? `응답에서 userPk ${lookupState.result.resolvedUserPk}를 찾았다.`
                : "응답에 userPk가 없어서 운영자 등록 전 숫자 userPk를 직접 넣어야 한다."}
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
                pendingAction={pendingAction}
                operator={operator}
                editState={editState}
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
  const [operatorEdits, setOperatorEdits] = useState<
    Record<string, OperatorEditState>
  >({});
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [notice, setNotice] = useState<NoticeState | null>(null);

  const sortedTeams = selectedSessionDetail ? sortTeams(selectedSessionDetail.teams) : [];
  const sortedCandidates = selectedSessionDetail
    ? sortCandidates(selectedSessionDetail.candidates)
    : [];
  const sortedOrders = selectedSessionDetail ? sortOrders(selectedSessionDetail.orders) : [];
  const pickerTeamCount = sortedTeams.filter((team) =>
    team.operators.some((operator) => operator.canPick === "Y"),
  ).length;
  const operatorCount = sortedTeams.reduce(
    (count, team) => count + team.operators.length,
    0,
  );
  const waitingCandidateCount = sortedCandidates.filter(
    (candidate) => candidate.status === "WAITING",
  ).length;
  const canStartSession =
    selectedSessionDetail !== null &&
    selectedSessionDetail.status === "READY" &&
    selectedSessionDetail.teams.length > 0 &&
    selectedSessionDetail.orders.length > 0;
  const readyForLivePick =
    canStartSession &&
    pickerTeamCount > 0 &&
    selectedSessionDetail.candidates.length > 0 &&
    operatorCount > 0;

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
      setOperatorEdits({});
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
      setOperatorEdits(createInitialOperatorEdits(detail));
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

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      setLoadingSessions(true);

      try {
        const nextSessions = sortSessions(await listDraftSessions());

        if (cancelled) {
          return;
        }

        const nextSelectedSessionId = chooseSessionId(nextSessions, null, null);

        startTransition(() => {
          setSessions(nextSessions);
          setLoadingDetail(nextSelectedSessionId !== null);
          setSelectedSessionId(nextSelectedSessionId);
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

  function updateOperatorEdit(
    teamId: number,
    operatorUserId: number,
    patch: Partial<OperatorEditState>,
  ) {
    setOperatorEdits((current) => ({
      ...current,
      [createOperatorKey(teamId, operatorUserId)]: {
        ...(current[createOperatorKey(teamId, operatorUserId)] ?? {
          role: "OPERATOR",
          isActive: "Y",
        }),
        ...patch,
      },
    }));
  }

  async function handleCreateSession() {
    setPendingAction("create-session");
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
      const created = await createDraftSession(payload);
      await refreshSelectedSession(created.id);
      setCreateForm(EMPTY_CREATE_FORM);
      setNotice({
        tone: "success",
        text: "세션을 생성했다.",
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

    setPendingAction("update-session");
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
      await updateDraftSession(selectedSessionId, payload);
      await refreshSelectedSession(selectedSessionId);
      setNotice({
        tone: "success",
        text: "세션 정보를 저장했다.",
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

    setPendingAction("create-team");
    setNotice(null);

    try {
      const payload = {
        draftSessionId: selectedSessionId,
        teamName: teamForm.teamName.trim(),
        displayOrder: parsePositiveInt(teamForm.displayOrder, "표시 순서"),
      };
      await createDraftTeam(payload);
      const detail = await refreshSelectedSession(selectedSessionId);
      setTeamForm(createDefaultTeamForm(detail));
      setNotice({
        tone: "success",
        text: "팀을 추가했다.",
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

  async function handleSearchUser(teamId: number) {
    const lookup = teamLookups[teamId];

    if (!lookup?.loginId.trim()) {
      return;
    }

    setPendingAction(`search:${teamId}`);
    setNotice(null);

    try {
      const result = await searchDraftUserByLoginId(lookup.loginId.trim());
      updateLookup(teamId, {
        result,
        operatorUserId:
          result.resolvedUserPk !== null
            ? String(result.resolvedUserPk)
            : lookup.operatorUserId,
      });
      setNotice({
        tone: "success",
        text: `${result.userId} 정보를 찾았다.`,
      });
    } catch (error) {
      updateLookup(teamId, {
        result: null,
      });
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

    setPendingAction(`add:${teamId}`);
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
        text: "팀 운영자를 등록했다.",
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

    const actionKey = `save:${createOperatorKey(teamId, operatorUserId)}`;
    setPendingAction(actionKey);
    setNotice(null);

    try {
      await updateDraftTeamOperator(teamId, operatorUserId, payload);
      await refreshSelectedSession(selectedSessionId);
      setNotice({
        tone: "success",
        text: "운영자 정보를 저장했다.",
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

    const actionKey = `delete:${createOperatorKey(teamId, operatorUserId)}`;
    setPendingAction(actionKey);
    setNotice(null);

    try {
      await deleteDraftTeamOperator(teamId, operatorUserId);
      await refreshSelectedSession(selectedSessionId);
      setNotice({
        tone: "success",
        text: "운영자를 삭제했다.",
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

    const actionKey = `picker:${createOperatorKey(teamId, operatorUserId)}`;
    setPendingAction(actionKey);
    setNotice(null);

    try {
      await assignDraftPicker(teamId, operatorUserId);
      await refreshSelectedSession(selectedSessionId);
      setNotice({
        tone: "success",
        text: "픽커를 지정했다.",
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

  async function handleSearchCandidate() {
    if (!candidateForm.loginId.trim()) {
      return;
    }

    setPendingAction("search-candidate");
    setNotice(null);

    try {
      const result = await searchDraftUserByLoginId(candidateForm.loginId.trim());
      setCandidateForm((current) => ({
        ...current,
        result,
        candidateUserId:
          result.resolvedUserPk !== null
            ? String(result.resolvedUserPk)
            : current.candidateUserId,
        candidateName: current.candidateName || result.userId,
        race: normalizeRace(result.race) ?? current.race,
      }));
      setNotice({
        tone: "success",
        text: `${result.userId} 후보 정보를 찾았다.`,
      });
    } catch (error) {
      setCandidateForm((current) => ({
        ...current,
        result: null,
      }));
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

    setPendingAction("create-candidate");
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
        throw new Error("후보 이름을 입력해야 한다.");
      }

      await createDraftCandidate(payload);
      await refreshSelectedSession(selectedSessionId);
      setCandidateForm(EMPTY_CANDIDATE_FORM);
      setNotice({
        tone: "success",
        text: "후보를 등록했다.",
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

    setPendingAction("create-order");
    setNotice(null);

    try {
      const payload = {
        draftSessionId: selectedSessionId,
        roundNo: parsePositiveInt(orderForm.roundNo, "라운드"),
        pickNo: parsePositiveInt(orderForm.pickNo, "픽 번호"),
        draftTeamId: parsePositiveInt(orderForm.draftTeamId, "팀"),
      };
      await createDraftOrder(payload);
      const detail = await refreshSelectedSession(selectedSessionId);
      setOrderForm(createDefaultOrderForm(detail));
      setNotice({
        tone: "success",
        text: "드래프트 순서를 등록했다.",
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

  async function handleStartSession() {
    if (selectedSessionId === null) {
      return;
    }

    setPendingAction("start-session");
    setNotice(null);

    try {
      await startDraftSession(selectedSessionId);
      await refreshSelectedSession(selectedSessionId);
      setNotice({
        tone: "success",
        text: "세션을 시작했다.",
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

  async function handlePauseSession() {
    if (selectedSessionId === null) {
      return;
    }

    setPendingAction("pause-session");
    setNotice(null);

    try {
      await pauseDraftSession(selectedSessionId);
      await refreshSelectedSession(selectedSessionId);
      setNotice({
        tone: "success",
        text: "세션을 일시정지했다.",
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

  async function handleResumeSession() {
    if (selectedSessionId === null) {
      return;
    }

    setPendingAction("resume-session");
    setNotice(null);

    try {
      await resumeDraftSession(selectedSessionId);
      await refreshSelectedSession(selectedSessionId);
      setNotice({
        tone: "success",
        text: "세션을 재개했다.",
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

  async function handleFinishSession() {
    if (selectedSessionId === null) {
      return;
    }

    setPendingAction("finish-session");
    setNotice(null);

    try {
      await finishDraftSession(selectedSessionId);
      await refreshSelectedSession(selectedSessionId);
      setNotice({
        tone: "success",
        text: "세션을 종료했다.",
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
              드래프트 준비 순서
            </p>
            <p className="mt-2 text-sm leading-7 text-muted">
              1. 세션 선택/생성 → 2. 팀 생성 → 3. 팀별 운영자 등록/픽커 지정 →
              4. 후보 등록 → 5. 순서 등록 → 6. 세션 시작 → 7. 아래 라이브 보드에서
              실제 픽 진행
            </p>
          </div>

          {selectedSessionDetail ? (
            <div className="rounded-[24px] bg-surface-muted px-4 py-4 text-sm leading-7 text-muted">
              <p className="font-semibold text-foreground">
                {selectedSessionDetail.title}
              </p>
              <p>상태: {formatDraftStatus(selectedSessionDetail.status)}</p>
              <p>현재 픽: {selectedSessionDetail.currentPickNo ?? "-"}</p>
              <p>현재 팀: {selectedSessionDetail.currentDraftTeamId ?? "-"}</p>
            </div>
          ) : (
            <div className="rounded-[24px] border border-dashed border-line px-4 py-4 text-sm text-muted">
              세션을 선택하면 준비 현황이 나온다.
            </div>
          )}
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <SetupStatCard
            label="팀"
            value={
              selectedSessionDetail
                ? `${selectedSessionDetail.teams.length}/${selectedSessionDetail.teamCount}`
                : "0/0"
            }
            description="세션 시작 전 최소 1개 팀이 있어야 한다."
            ready={(selectedSessionDetail?.teams.length ?? 0) > 0}
          />
          <SetupStatCard
            label="운영자"
            value={String(operatorCount)}
            description="실제 픽을 하려면 팀별 운영자가 필요하다."
            ready={operatorCount > 0}
          />
          <SetupStatCard
            label="픽커 팀"
            value={String(pickerTeamCount)}
            description="팀별 픽커는 관리자 권한으로 따로 지정한다."
            ready={pickerTeamCount > 0}
          />
          <SetupStatCard
            label="후보"
            value={String(waitingCandidateCount)}
            description="라이브 픽까지 하려면 후보가 있어야 한다."
            ready={waitingCandidateCount > 0}
          />
          <SetupStatCard
            label="순서"
            value={String(sortedOrders.length)}
            description="세션 시작 최소 조건은 팀 + 순서다."
            ready={sortedOrders.length > 0}
          />
        </div>
      </SurfaceCard>

      <div className="grid gap-4 xl:grid-cols-2">
        <SurfaceCard className="p-6">
          <p className="text-sm font-semibold text-foreground">1. 세션 생성</p>
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
              {pendingAction === "create-session" ? "생성 중" : "세션 생성"}
            </Button>
          </div>
        </SurfaceCard>

        <SurfaceCard className="p-6">
          <p className="text-sm font-semibold text-foreground">
            1-1. 세션 선택 / 수정
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
                  setSelectedSessionDetail(null);
                  setLoadingDetail(nextSessionId !== null);
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
                  {session.title} · {formatDraftStatus(session.status)}
                </option>
              ))}
            </select>

            <Input
              value={editForm.title}
              onChange={(event) => {
                setEditForm((current) => ({
                  ...current,
                  title: event.target.value,
                }));
              }}
              placeholder="세션 이름"
              disabled={selectedSessionId === null}
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <Input
                type="number"
                min={2}
                value={editForm.teamCount}
                onChange={(event) => {
                  setEditForm((current) => ({
                    ...current,
                    teamCount: event.target.value,
                  }));
                }}
                placeholder="팀 수"
                disabled={selectedSessionId === null}
              />
              <Input
                type="number"
                min={1}
                value={editForm.pickTimeSeconds}
                onChange={(event) => {
                  setEditForm((current) => ({
                    ...current,
                    pickTimeSeconds: event.target.value,
                  }));
                }}
                placeholder="픽 제한 시간(초)"
                disabled={selectedSessionId === null}
              />
            </div>

            {selectedSessionDetail ? (
              <div className="rounded-[22px] bg-surface-muted px-4 py-4 text-sm leading-7 text-muted">
                <p>상태: {formatDraftStatus(selectedSessionDetail.status)}</p>
                <p>시작: {formatDateTime(selectedSessionDetail.startedAt)}</p>
                <p>종료: {formatDateTime(selectedSessionDetail.endedAt)}</p>
              </div>
            ) : (
              <div className="rounded-[22px] border border-dashed border-line px-4 py-4 text-sm text-muted">
                {loadingDetail
                  ? "세션 정보를 불러오는 중이다."
                  : "수정할 세션을 선택해줘."}
              </div>
            )}

            <Button
              disabled={pendingAction !== null || selectedSessionId === null}
              onClick={() => {
                void handleUpdateSession();
              }}
            >
              {pendingAction === "update-session" ? "저장 중" : "세션 저장"}
            </Button>
          </div>
        </SurfaceCard>
      </div>

      <SurfaceCard className="p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-foreground">2. 팀 생성</p>
            <p className="mt-2 text-sm leading-7 text-muted">
              세션 시작 전에 최소한 팀과 순서는 있어야 한다. displayOrder는 기본
              순서 계산과 팀 정렬 기준으로 쓴다.
            </p>
          </div>
          {selectedSessionDetail ? (
            <div className="rounded-[22px] bg-surface-muted px-4 py-3 text-sm text-muted">
              목표 팀 수 {selectedSessionDetail.teamCount}개
            </div>
          ) : null}
        </div>

        {!selectedSessionDetail ? (
          <div className="mt-5 rounded-[24px] border border-dashed border-line px-5 py-10 text-center text-sm text-muted">
            먼저 세션을 선택해줘.
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
                  {pendingAction === "create-team" ? "추가 중" : "팀 추가"}
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
                  <div
                    key={team.id}
                    className="rounded-[24px] border border-line bg-surface-strong px-4 py-4"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-foreground">
                        {team.teamName}
                      </p>
                      <span className="rounded-full bg-surface px-3 py-1 text-xs text-muted">
                        #{team.displayOrder}
                      </span>
                    </div>
                    <p className="mt-3 text-sm leading-7 text-muted">
                      teamId {team.id}
                    </p>
                    <p className="text-sm leading-7 text-muted">
                      운영자 {team.operators.length}명
                    </p>
                  </div>
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
              3. 팀별 운영자 등록 / 픽커 지정
            </p>
            <p className="mt-2 text-sm leading-7 text-muted">
              실제 유저가 픽하려면 팀 운영자 등록이 먼저 있어야 하고, 그 중 한
              명을 픽커로 지정해야 한다.
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
              세션을 먼저 선택해줘.
            </div>
          ) : sortedTeams.length === 0 ? (
            <div className="rounded-[24px] border border-dashed border-line px-5 py-10 text-center text-sm text-muted">
              팀을 먼저 만든 뒤 운영자를 등록해야 한다.
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
                  onSearchUser={handleSearchUser}
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
              <p className="text-sm font-semibold text-foreground">4. 후보 등록</p>
              <p className="mt-2 text-sm leading-7 text-muted">
                아이디 검색으로 후보 정보를 참고한 뒤 숫자 userPk를 넣어서 후보를
                등록한다.
              </p>
            </div>
            <div className="rounded-[22px] bg-surface-muted px-4 py-3 text-sm text-muted">
              WAITING {waitingCandidateCount}명
            </div>
          </div>

          {!selectedSessionDetail ? (
            <div className="mt-5 rounded-[24px] border border-dashed border-line px-5 py-10 text-center text-sm text-muted">
              세션을 먼저 선택해줘.
            </div>
          ) : (
            <>
              <div className="mt-5 rounded-[24px] border border-line bg-surface-strong px-4 py-4">
                <div className="grid gap-3">
                  <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_140px_auto]">
                    <Input
                      value={candidateForm.loginId}
                      onChange={(event) => {
                        setCandidateForm((current) => ({
                          ...current,
                          loginId: event.target.value,
                          result: null,
                        }));
                      }}
                      placeholder="userId 검색"
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
                    <Button
                      disabled={
                        pendingAction !== null || !candidateForm.loginId.trim()
                      }
                      onClick={() => {
                        void handleSearchCandidate();
                      }}
                    >
                      {pendingAction === "search-candidate" ? "검색 중" : "검색"}
                    </Button>
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
                    {pendingAction === "create-candidate" ? "등록 중" : "후보 등록"}
                  </Button>
                </div>

                {candidateForm.result ? (
                  <div className="mt-4 rounded-[20px] bg-surface-muted px-4 py-4">
                    <p className="text-sm font-semibold text-foreground">
                      검색 결과: {candidateForm.result.userId}
                    </p>
                    <p className="mt-1 text-sm text-muted">
                      {candidateForm.result.name ?? "이름 없음"}
                      {candidateForm.result.tier
                        ? ` · ${candidateForm.result.tier}`
                        : ""}
                      {candidateForm.result.race
                        ? ` · ${candidateForm.result.race}`
                        : ""}
                    </p>
                    <p className="mt-2 text-xs leading-6 text-muted">
                      {candidateForm.result.resolvedUserPk
                        ? `응답에서 userPk ${candidateForm.result.resolvedUserPk}를 찾았다.`
                        : "응답에 userPk가 없으면 candidateUserId를 직접 넣어야 한다."}
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
                    <div
                      key={candidate.candidateUserId}
                      className="rounded-[24px] border border-line bg-surface-strong px-4 py-4"
                    >
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
                        <span
                          className={cn(
                            "rounded-full px-3 py-1 text-xs font-semibold",
                            getCandidateStatusClassName(candidate.status),
                          )}
                        >
                          {candidate.status}
                        </span>
                      </div>
                      {candidate.pickedDraftTeamName ? (
                        <p className="mt-3 text-sm text-muted">
                          지명 팀 {candidate.pickedDraftTeamName} ·{" "}
                          {formatDateTime(candidate.pickedAt)}
                        </p>
                      ) : null}
                    </div>
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
                5. 드래프트 순서 등록
              </p>
              <p className="mt-2 text-sm leading-7 text-muted">
                기본값은 팀 displayOrder 기준 반복 순서로 자동 채워진다. 필요하면
                roundNo, pickNo, 팀을 직접 바꿔서 등록하면 된다.
              </p>
            </div>
            <div className="rounded-[22px] bg-surface-muted px-4 py-3 text-sm text-muted">
              총 {sortedOrders.length}개
            </div>
          </div>

          {!selectedSessionDetail ? (
            <div className="mt-5 rounded-[24px] border border-dashed border-line px-5 py-10 text-center text-sm text-muted">
              세션을 먼저 선택해줘.
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
                      {pendingAction === "create-order" ? "등록 중" : "순서 등록"}
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
                    <div
                      key={order.pickNo}
                      className="rounded-[24px] border border-line bg-surface-strong px-4 py-4"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <p className="text-sm font-semibold text-foreground">
                          Pick {order.pickNo}
                        </p>
                        <span className="rounded-full bg-surface px-3 py-1 text-xs text-muted">
                          Round {order.roundNo}
                        </span>
                      </div>
                      <p className="mt-3 text-sm text-muted">
                        {order.draftTeamName} · teamId {order.draftTeamId}
                      </p>
                    </div>
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
            <p className="text-sm font-semibold text-foreground">
              6. 세션 시작 / 제어
            </p>
            <p className="mt-2 text-sm leading-7 text-muted">
              시작만 하려면 팀 + 순서가 있으면 된다. 실제 라이브 픽까지 하려면
              운영자, 픽커, 후보도 채워두는 편이 맞다.
            </p>
          </div>
          <div className="rounded-[22px] bg-surface-muted px-4 py-3 text-sm leading-7 text-muted">
            <p>시작 가능: {canStartSession ? "예" : "아니오"}</p>
            <p>라이브 픽 준비: {readyForLivePick ? "예" : "아니오"}</p>
          </div>
        </div>

        {!selectedSessionDetail ? (
          <div className="mt-5 rounded-[24px] border border-dashed border-line px-5 py-10 text-center text-sm text-muted">
            세션을 먼저 선택해줘.
          </div>
        ) : (
          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <Button
              variant="accent"
              disabled={pendingAction !== null || !canStartSession}
              onClick={() => {
                void handleStartSession();
              }}
            >
              {pendingAction === "start-session" ? "시작 중" : "세션 시작"}
            </Button>
            <Button
              disabled={
                pendingAction !== null || selectedSessionDetail.status !== "PAUSED"
              }
              onClick={() => {
                void handleResumeSession();
              }}
            >
              {pendingAction === "resume-session" ? "재개 중" : "세션 재개"}
            </Button>
            <Button
              variant="danger"
              disabled={
                pendingAction !== null || selectedSessionDetail.status !== "LIVE"
              }
              onClick={() => {
                void handlePauseSession();
              }}
            >
              {pendingAction === "pause-session" ? "정지 중" : "일시정지"}
            </Button>
            <Button
              variant="danger"
              disabled={
                pendingAction !== null || selectedSessionDetail.status === "FINISHED"
              }
              onClick={() => {
                void handleFinishSession();
              }}
            >
              {pendingAction === "finish-session" ? "종료 중" : "완전 종료"}
            </Button>
          </div>
        )}
      </SurfaceCard>
    </div>
  );
}
