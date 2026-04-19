"use client";

import { startTransition, useEffect, useState } from "react";
import {
  assignDraftPicker,
  createDraftSession,
  createDraftTeamOperator,
  deleteDraftTeamOperator,
  getDraftSessionDetail,
  listDraftSessions,
  searchDraftUserByLoginId,
  updateDraftSession,
  updateDraftTeamOperator,
  type DraftLiveTeam,
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

type TeamLookupState = {
  loginId: string;
  operatorUserId: string;
  role: string;
  isActive: string;
  result: DraftUserLookup | null;
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

function parsePositiveInt(
  value: string,
  fieldName: string,
  minimum = 1,
) {
  const parsed = Number(value.trim());

  if (!Number.isInteger(parsed) || parsed < minimum) {
    throw new Error(`${fieldName}은(는) ${minimum} 이상의 정수여야 합니다.`);
  }

  return parsed;
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

function createEmptyTeamLookup(teamId: number) {
  return {
    [teamId]: {
      loginId: "",
      operatorUserId: "",
      role: "OPERATOR",
      isActive: "Y",
      result: null,
    },
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
            {operator.canPick === "Y" ? " · 현재 픽 권한자" : ""}
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
            {pendingAction === `picker:${rowKey}` ? "지정 중" : "픽 권한"}
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
  return (
    <article className="rounded-[28px] border border-line bg-surface-strong px-5 py-5 shadow-[0_18px_50px_-40px_rgba(31,42,40,0.7)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-lg font-semibold text-foreground">{draftTeam.teamName}</p>
          <p className="mt-1 text-sm text-muted">
            표시 순서 {draftTeam.displayOrder} · 운영자 {draftTeam.operators.length}명
          </p>
        </div>
        <span className="rounded-full bg-surface-muted px-3 py-1 text-xs font-semibold text-muted">
          teamId {draftTeam.id}
        </span>
      </div>

      <div className="mt-5 rounded-[24px] border border-line bg-surface px-4 py-4">
        <p className="text-sm font-semibold text-foreground">아이디 검색 후 운영자 추가</p>
        <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1.1fr)_140px_120px_120px_auto]">
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
                pendingAction !== null ||
                !lookupState.operatorUserId.trim() ||
                !lookupState.role
              }
              onClick={() => {
                void onAddOperator(draftTeam.id);
              }}
            >
              {pendingAction === `add:${draftTeam.id}` ? "추가 중" : "추가"}
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
                ? `검색 응답에서 userPk ${lookupState.result.resolvedUserPk}를 찾았다.`
                : "현재 유저 검색 API는 userPk를 내려주지 않아서, 필요하면 userPk를 직접 입력해야 추가할 수 있다."}
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
  const [teamLookups, setTeamLookups] = useState<Record<number, TeamLookupState>>({});
  const [operatorEdits, setOperatorEdits] = useState<
    Record<string, OperatorEditState>
  >({});
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [notice, setNotice] = useState<NoticeState | null>(null);

  function notifyChange() {
    onDataChanged?.();
  }

  function applyDetail(detail: DraftSessionDetail) {
    startTransition(() => {
      setSelectedSessionDetail(detail);
      setEditForm({
        title: detail.title,
        teamCount: String(detail.teamCount),
        pickTimeSeconds: String(detail.pickTimeSeconds),
      });
      setOperatorEdits(createInitialOperatorEdits(detail));
      setTeamLookups({});
    });
  }

  function resetDetail() {
    startTransition(() => {
      setSelectedSessionDetail(null);
      setEditForm(EMPTY_EDIT_FORM);
      setOperatorEdits({});
      setTeamLookups({});
    });
  }

  async function loadSessions(preferredSessionId?: number | null) {
    const nextSessions = sortSessions(await listDraftSessions());
    const hasPreferredId =
      typeof preferredSessionId === "number" &&
      nextSessions.some((session) => session.id === preferredSessionId);
    const hasCurrentId =
      selectedSessionId !== null &&
      nextSessions.some((session) => session.id === selectedSessionId);
    const nextSelectedSessionId = hasPreferredId
      ? preferredSessionId
      : hasCurrentId
        ? selectedSessionId
        : nextSessions[0]?.id ?? null;

    startTransition(() => {
      setSessions(nextSessions);
      setSelectedSessionId(nextSelectedSessionId);
    });

    if (nextSelectedSessionId === null) {
      resetDetail();
    }

    return nextSelectedSessionId;
  }

  async function loadSessionDetail(sessionId: number) {
    const detail = await getDraftSessionDetail(sessionId);
    applyDetail(detail);
    return detail;
  }

  useEffect(() => {
    let cancelled = false;

    async function initialize() {
      try {
        const nextSessions = sortSessions(await listDraftSessions());
        const nextSelectedSessionId = nextSessions[0]?.id ?? null;

        if (cancelled) {
          return;
        }

        startTransition(() => {
          setSessions(nextSessions);
          setSelectedSessionId(nextSelectedSessionId);
        });

        if (cancelled || nextSelectedSessionId === null) {
          if (!cancelled) {
            resetDetail();
          }
          return;
        }

        const detail = await getDraftSessionDetail(nextSelectedSessionId);

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
          setLoadingSessions(false);
        }
      }
    }

    void initialize();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (selectedSessionId === null) {
      return;
    }

    const sessionId = selectedSessionId;
    let cancelled = false;

    async function syncDetail() {
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

    void syncDetail();

    return () => {
      cancelled = true;
    };
  }, [selectedSessionId]);

  function updateLookup(teamId: number, patch: Partial<TeamLookupState>) {
    setTeamLookups((current) => {
      const previous =
        current[teamId] ??
        createEmptyTeamLookup(teamId)[teamId];

      return {
        ...current,
        [teamId]: {
          ...previous,
          ...patch,
        },
      };
    });
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
        ...current[key],
        ...patch,
      },
    }));
  }

  async function refreshSelectedSession(sessionId: number) {
    const [nextSelectedSessionId] = await Promise.all([loadSessions(sessionId)]);

    if (nextSelectedSessionId !== null) {
      await loadSessionDetail(nextSelectedSessionId);
    }

    notifyChange();
  }

  async function handleCreateSession() {
    setPendingAction("create-session");
    setNotice(null);

    try {
      const createdSession = await createDraftSession({
        title: createForm.title.trim(),
        teamCount: parsePositiveInt(createForm.teamCount, "팀 수", 2),
        pickTimeSeconds: parsePositiveInt(createForm.pickTimeSeconds, "픽 제한 시간", 1),
      });

      setCreateForm(EMPTY_CREATE_FORM);
      await refreshSelectedSession(createdSession.id);
      setNotice({
        tone: "success",
        text: `세션 "${createdSession.title}"을 생성했다.`,
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
      await updateDraftSession(selectedSessionId, {
        title: editForm.title.trim(),
        teamCount: parsePositiveInt(editForm.teamCount, "팀 수", 2),
        pickTimeSeconds: parsePositiveInt(editForm.pickTimeSeconds, "픽 제한 시간", 1),
      });

      await refreshSelectedSession(selectedSessionId);
      setNotice({
        tone: "success",
        text: "세션 기본 정보를 수정했다.",
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
    const lookup = teamLookups[teamId] ?? createEmptyTeamLookup(teamId)[teamId];

    setPendingAction(`search:${teamId}`);
    setNotice(null);

    try {
      const result = await searchDraftUserByLoginId(lookup.loginId.trim());

      updateLookup(teamId, {
        result,
        operatorUserId: result.resolvedUserPk
          ? String(result.resolvedUserPk)
          : lookup.operatorUserId,
      });
      setNotice({
        tone: "success",
        text: `${result.userId} 검색 결과를 불러왔다.`,
      });
    } catch (error) {
      updateLookup(teamId, { result: null });
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

    const lookup = teamLookups[teamId] ?? createEmptyTeamLookup(teamId)[teamId];

    setPendingAction(`add:${teamId}`);
    setNotice(null);

    try {
      await createDraftTeamOperator({
        draftTeamId: teamId,
        operatorUserId: parsePositiveInt(lookup.operatorUserId, "운영자 userPk", 1),
        role: lookup.role,
        isActive: lookup.isActive,
      });

      await refreshSelectedSession(selectedSessionId);
      updateLookup(teamId, createEmptyTeamLookup(teamId)[teamId]);
      setNotice({
        tone: "success",
        text: "팀 운영자를 추가했다.",
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
        text: "픽 권한자를 변경했다.",
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

      <div className="grid gap-4 xl:grid-cols-2">
        <SurfaceCard className="p-6">
          <p className="text-sm font-semibold text-foreground">세션 추가</p>
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
          <p className="text-sm font-semibold text-foreground">세션 수정</p>
          <div className="mt-4 grid gap-3">
            <select
              className={SELECT_CLASS_NAME}
              value={selectedSessionId ?? ""}
              onChange={(event) => {
                const nextSessionId = event.target.value
                  ? Number(event.target.value)
                  : null;

                startTransition(() => {
                  setLoadingDetail(true);
                  setSelectedSessionDetail(null);
                  setSelectedSessionId(nextSessionId);
                });
              }}
            >
              {loadingSessions && sessions.length === 0 ? (
                <option value="">세션 불러오는 중</option>
              ) : sessions.length === 0 ? (
                <option value="">세션 없음</option>
              ) : null}

              {sessions.map((session) => (
                <option key={session.id} value={session.id}>
                  {session.title} · {session.status}
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
                <p>상태: {selectedSessionDetail.status}</p>
                <p>현재 픽: {selectedSessionDetail.currentPickNo ?? "-"}</p>
                <p>현재 팀: {selectedSessionDetail.currentDraftTeamId ?? "-"}</p>
                <p>시작: {formatDateTime(selectedSessionDetail.startedAt)}</p>
              </div>
            ) : (
              <div className="rounded-[22px] border border-dashed border-line px-4 py-4 text-sm text-muted">
                {loadingDetail ? "세션 정보를 불러오는 중이다." : "수정할 세션을 선택해라."}
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
            <p className="text-sm font-semibold text-foreground">팀별 유저 지정</p>
            <p className="mt-2 text-sm leading-7 text-muted">
              아이디로 유저를 검색한 뒤 운영자 userPk를 확인해 팀 운영자로 추가한다.
              현재 백엔드 검색 응답에 userPk가 없으면 직접 입력이 필요하다.
            </p>
          </div>
          {selectedSessionDetail ? (
            <div className="rounded-[22px] bg-surface-muted px-4 py-3 text-sm text-muted">
              {selectedSessionDetail.title} · 팀 {selectedSessionDetail.teams.length}개
            </div>
          ) : null}
        </div>

        <div className="mt-5">
          {!selectedSessionDetail ? (
            <div className="rounded-[24px] border border-dashed border-line px-5 py-10 text-center text-sm text-muted">
              세션을 먼저 선택하면 팀별 운영자 설정이 열린다.
            </div>
          ) : selectedSessionDetail.teams.length === 0 ? (
            <div className="rounded-[24px] border border-dashed border-line px-5 py-10 text-center text-sm text-muted">
              이 세션에는 등록된 팀이 없다.
            </div>
          ) : (
            <div className="grid gap-4 xl:grid-cols-2">
              {selectedSessionDetail.teams.map((team) => (
                <TeamOperatorManager
                  key={team.id}
                  draftTeam={team}
                  lookupState={
                    teamLookups[team.id] ?? createEmptyTeamLookup(team.id)[team.id]
                  }
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
    </div>
  );
}
