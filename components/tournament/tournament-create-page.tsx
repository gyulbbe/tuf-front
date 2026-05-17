"use client";

import {
  useMemo,
  useState,
  type DragEvent,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import { useRouter } from "next/navigation";
import { RpsDraftUserSearch } from "@/components/rps-draft/rps-draft-user-search";
import { SurfaceCard } from "@/components/site/surface-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  createTournament,
  type TournamentCreateGroupRequest,
  type TournamentCreateSlotRequest,
} from "@/lib/api/tournament";
import type { RpsDraftUserSearchResult } from "@/lib/api/rps-draft";
import {
  TOURNAMENT_BEST_OF_OPTIONS,
  type TournamentBestOf,
  type TournamentBracketType,
} from "@/lib/tournament/create-types";
import { cn } from "@/lib/utils";

type BuilderParticipant = {
  id: string;
  userId: number | null;
  participantName: string;
  displayName: string;
  detail: string | null;
  source: "USER" | "EXTERNAL";
};

type SingleMatchState = {
  id: string;
  slots: [string | null, string | null];
};

type DualGroupState = {
  id: string;
  groupCode: string;
  groupName: string;
  slots: [string | null, string | null, string | null, string | null];
};

type SlotReference =
  | {
      bracketType: "SINGLE_ELIMINATION";
      matchId: string;
      slotIndex: number;
    }
  | {
      bracketType: "DUAL_GROUP";
      groupId: string;
      slotIndex: number;
    };

type DragData =
  | {
      participantId: string;
      source: "POOL";
    }
  | ({
      participantId: string;
      source: "SLOT";
    } & SlotReference);

type BuilderSlotProps = {
  assigned: BuilderParticipant | null;
  isSelectedTarget: boolean;
  label: string;
  onClear: () => void;
  onClickSlot: () => void;
  onDragStart: (event: DragEvent<HTMLDivElement>) => void;
  onDropParticipant: (event: DragEvent<HTMLDivElement>) => void;
  slotNo: number;
};

type ParticipantPoolProps = {
  assignedParticipantIds: Set<string>;
  onDropToPool: (event: DragEvent<HTMLDivElement>) => void;
  onDragStart: (
    event: DragEvent<HTMLDivElement>,
    participantId: string,
  ) => void;
  onRemoveParticipant: (participantId: string) => void;
  onSelectParticipant: (participantId: string) => void;
  participants: BuilderParticipant[];
  selectedParticipantId: string | null;
};

const DRAG_MIME_TYPE = "application/x-tuf-tournament-builder";
const DEFAULT_BEST_OF: TournamentBestOf = 3;

let localIdSeed = 0;

function createLocalId(prefix: string) {
  localIdSeed += 1;
  return `${prefix}-${Date.now()}-${localIdSeed}`;
}

function createInitialSingleMatches(): SingleMatchState[] {
  return [
    {
      id: "single-match-1",
      slots: [null, null],
    },
  ];
}

function getGroupCode(index: number) {
  let value = index;
  let code = "";

  do {
    code = String.fromCharCode(65 + (value % 26)) + code;
    value = Math.floor(value / 26) - 1;
  } while (value >= 0);

  return code;
}

function createDualGroup(index: number): DualGroupState {
  const groupCode = getGroupCode(index);

  return {
    id: `dual-group-${groupCode}`,
    groupCode,
    groupName: `${groupCode}조`,
    slots: [null, null, null, null],
  };
}

function createInitialDualGroups(): DualGroupState[] {
  return [createDualGroup(0)];
}

function cloneSingleMatches(matches: SingleMatchState[]) {
  return matches.map((match) => ({
    ...match,
    slots: [...match.slots] as [string | null, string | null],
  }));
}

function cloneDualGroups(groups: DualGroupState[]) {
  return groups.map((group) => ({
    ...group,
    slots: [...group.slots] as [
      string | null,
      string | null,
      string | null,
      string | null,
    ],
  }));
}

function removeParticipantFromSingleMatches(
  matches: SingleMatchState[],
  participantId: string,
) {
  matches.forEach((match) => {
    match.slots = match.slots.map((slotParticipantId) =>
      slotParticipantId === participantId ? null : slotParticipantId,
    ) as [string | null, string | null];
  });
}

function removeParticipantFromDualGroups(
  groups: DualGroupState[],
  participantId: string,
) {
  groups.forEach((group) => {
    group.slots = group.slots.map((slotParticipantId) =>
      slotParticipantId === participantId ? null : slotParticipantId,
    ) as [string | null, string | null, string | null, string | null];
  });
}

function isSameSlot(left: SlotReference, right: SlotReference) {
  if (left.bracketType !== right.bracketType) {
    return false;
  }

  if (
    left.bracketType === "SINGLE_ELIMINATION" &&
    right.bracketType === "SINGLE_ELIMINATION"
  ) {
    return left.matchId === right.matchId && left.slotIndex === right.slotIndex;
  }

  if (left.bracketType === "DUAL_GROUP" && right.bracketType === "DUAL_GROUP") {
    return left.groupId === right.groupId && left.slotIndex === right.slotIndex;
  }

  return false;
}

function readDragData(event: DragEvent) {
  const rawData = event.dataTransfer.getData(DRAG_MIME_TYPE);

  if (!rawData) {
    return null;
  }

  try {
    const data = JSON.parse(rawData) as DragData;

    if (
      !data ||
      typeof data !== "object" ||
      typeof data.participantId !== "string"
    ) {
      return null;
    }

    return data;
  } catch {
    return null;
  }
}

function writeDragData(event: DragEvent, data: DragData) {
  event.dataTransfer.effectAllowed = "move";
  event.dataTransfer.setData(DRAG_MIME_TYPE, JSON.stringify(data));
}

function buildUserParticipant(user: RpsDraftUserSearchResult): BuilderParticipant {
  const detail = [user.race, user.tier].filter(Boolean).join(" · ");

  return {
    id: `user:${user.id}`,
    userId: user.id,
    participantName: user.userId,
    displayName: user.userId,
    detail: detail || null,
    source: "USER",
  };
}

function buildSlotRequest(
  slotNo: number,
  participant: BuilderParticipant,
): TournamentCreateSlotRequest {
  if (participant.userId !== null) {
    return {
      slotNo,
      userId: participant.userId,
    };
  }

  return {
    slotNo,
    userId: null,
    participantName: participant.participantName,
  };
}

function getParticipantTone(participantId: string) {
  const tones = [
    "bg-accent text-white",
    "bg-success-ink text-white",
    "bg-warning-ink text-white",
    "bg-danger-ink text-white",
    "bg-line-strong text-white",
  ];
  let hash = 0;

  for (const character of participantId) {
    hash += character.charCodeAt(0);
  }

  return tones[hash % tones.length];
}

function BuilderSlot({
  assigned,
  isSelectedTarget,
  label,
  onClear,
  onClickSlot,
  onDragStart,
  onDropParticipant,
  slotNo,
}: BuilderSlotProps) {
  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }

    event.preventDefault();
    onClickSlot();
  }

  return (
    <div
      role="button"
      tabIndex={0}
      draggable={Boolean(assigned)}
      aria-label={
        assigned
          ? `${label}, ${assigned.displayName} 배치됨`
          : `${label}, 부전승`
      }
      onClick={onClickSlot}
      onDragOver={(event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
      }}
      onDragStart={assigned ? onDragStart : undefined}
      onDrop={onDropParticipant}
      onKeyDown={handleKeyDown}
      className={cn(
        "group grid h-14 min-w-0 items-center gap-3 rounded-md border px-3 text-[15px] transition-colors",
        assigned
          ? "grid-cols-[34px_minmax(0,1fr)_56px]"
          : "grid-cols-[34px_minmax(0,1fr)]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-[#142333]",
        assigned
          ? "border-white/15 bg-white/10 text-white shadow-[0_8px_18px_rgba(0,0,0,0.12)]"
          : "border-dashed border-white/15 bg-white/[0.045] text-white/55 hover:border-accent/60 hover:bg-accent/10",
        isSelectedTarget && "border-accent bg-accent/15",
        assigned ? "cursor-grab active:cursor-grabbing" : "cursor-pointer",
      )}
    >
      <span
        className={cn(
          "flex h-7 w-7 items-center justify-center rounded-md text-xs font-black",
          assigned ? getParticipantTone(assigned.id) : "bg-white/10 text-white/55",
        )}
      >
        {slotNo}
      </span>
      <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap font-semibold">
        {assigned ? assigned.displayName : "부전승"}
      </span>
      {assigned ? (
        <button
          type="button"
          aria-label={`${assigned.displayName} 배치 해제`}
          className="ml-auto rounded-md border border-white/15 px-2.5 py-1.5 text-xs font-semibold text-white/70 transition-colors hover:border-danger-ink/60 hover:bg-danger-soft hover:text-danger-ink"
          onClick={(event) => {
            event.stopPropagation();
            onClear();
          }}
        >
          X
        </button>
      ) : null}
    </div>
  );
}

function ParticipantPool({
  assignedParticipantIds,
  onDropToPool,
  onDragStart,
  onRemoveParticipant,
  onSelectParticipant,
  participants,
  selectedParticipantId,
}: ParticipantPoolProps) {
  const unassignedParticipants = participants.filter(
    (participant) => !assignedParticipantIds.has(participant.id),
  );

  return (
    <div
      className="rounded-lg border border-line bg-surface-strong p-4"
      onDragOver={(event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
      }}
      onDrop={onDropToPool}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-foreground">참가자 풀</p>
        <span className="rounded-full bg-surface-muted px-2.5 py-1 text-xs font-semibold text-muted">
          {unassignedParticipants.length}명
        </span>
      </div>

      {participants.length === 0 ? (
        <div className="mt-4 rounded-lg border border-dashed border-line px-4 py-8 text-sm leading-6 text-muted">
          유저 검색으로 참가자 풀을 먼저 채워주세요.
        </div>
      ) : unassignedParticipants.length === 0 ? (
        <div className="mt-4 rounded-lg border border-dashed border-line px-4 py-8 text-sm leading-6 text-muted">
          모든 참가자가 배치되었습니다. 슬롯에서 해제하면 다시 표시됩니다.
        </div>
      ) : (
        <div className="mt-4 grid max-h-[360px] gap-2 overflow-y-auto pr-1">
          {unassignedParticipants.map((participant) => {
            const isSelected = selectedParticipantId === participant.id;

            return (
              <div
                key={participant.id}
                draggable
                role="button"
                tabIndex={0}
                aria-pressed={isSelected}
                onClick={() => onSelectParticipant(participant.id)}
                onDragStart={(event) => onDragStart(event, participant.id)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onSelectParticipant(participant.id);
                  }
                }}
                className={cn(
                  "grid cursor-grab grid-cols-[minmax(0,1fr)_auto] gap-3 rounded-lg border px-3 py-3 text-left transition-colors active:cursor-grabbing",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                  isSelected
                    ? "border-accent bg-accent-soft"
                    : "border-line bg-white hover:border-accent-soft hover:bg-surface-muted/60",
                )}
              >
                <div className="min-w-0">
                  <div className="flex min-w-0 items-center gap-2">
                    <span
                      className={cn(
                        "flex h-6 w-6 flex-none items-center justify-center rounded-md text-[11px] font-black",
                        getParticipantTone(participant.id),
                      )}
                    >
                      {participant.source === "USER" ? "U" : "E"}
                    </span>
                    <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-sm font-semibold text-foreground">
                      {participant.displayName}
                    </span>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted">
                    <span>{participant.source === "USER" ? "내부 유저" : "참가자"}</span>
                    {participant.detail ? <span>{participant.detail}</span> : null}
                    {isSelected ? (
                      <span className="rounded-full bg-accent px-2 py-0.5 font-semibold text-white">
                        선택됨
                      </span>
                    ) : null}
                  </div>
                </div>
                <button
                  type="button"
                  className="h-8 rounded-md border border-line px-2 text-xs font-semibold text-muted transition-colors hover:border-danger-ink/30 hover:bg-danger-soft hover:text-danger-ink"
                  onClick={(event) => {
                    event.stopPropagation();
                    onRemoveParticipant(participant.id);
                  }}
                >
                  제거
                </button>
              </div>
            );
          })}
        </div>
      )}

      <p className="mt-3 text-xs leading-5 text-muted">
        슬롯에서 이 영역으로 끌어오면 배치가 해제됩니다. 모바일에서는 참가자를
        선택한 뒤 슬롯을 누르면 됩니다.
      </p>
    </div>
  );
}

export function TournamentCreatePage() {
  const router = useRouter();
  const [bracketType, setBracketType] = useState<TournamentBracketType | null>(
    null,
  );
  const [title, setTitle] = useState("");
  const [bestOf, setBestOf] = useState<TournamentBestOf>(DEFAULT_BEST_OF);
  const [participants, setParticipants] = useState<BuilderParticipant[]>([]);
  const [singleMatches, setSingleMatches] = useState<SingleMatchState[]>(
    createInitialSingleMatches,
  );
  const [dualGroups, setDualGroups] = useState<DualGroupState[]>(
    createInitialDualGroups,
  );
  const [selectedParticipantId, setSelectedParticipantId] = useState<
    string | null
  >(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const participantsById = useMemo(
    () => new Map(participants.map((participant) => [participant.id, participant])),
    [participants],
  );
  const disabledUserIds = useMemo(
    () =>
      participants
        .map((participant) => participant.userId)
        .filter((userId): userId is number => typeof userId === "number"),
    [participants],
  );
  const assignedParticipantIds = useMemo(() => {
    const assignedIds = new Set<string>();

    if (bracketType === "SINGLE_ELIMINATION") {
      singleMatches.forEach((match) => {
        match.slots.forEach((participantId) => {
          if (participantId) {
            assignedIds.add(participantId);
          }
        });
      });
    }

    if (bracketType === "DUAL_GROUP") {
      dualGroups.forEach((group) => {
        group.slots.forEach((participantId) => {
          if (participantId) {
            assignedIds.add(participantId);
          }
        });
      });
    }

    return assignedIds;
  }, [bracketType, dualGroups, singleMatches]);
  const assignedSlotCount = assignedParticipantIds.size;
  const totalSlotCount =
    bracketType === "SINGLE_ELIMINATION"
      ? singleMatches.length * 2
      : bracketType === "DUAL_GROUP"
        ? dualGroups.length * 4
        : 0;
  const byeCount = Math.max(0, totalSlotCount - assignedSlotCount);
  const validationMessage = getValidationMessage();
  const canSubmit = Boolean(bracketType) && !validationMessage && !creating;

  function getValidationMessage() {
    if (!bracketType) {
      return "대진 방식을 선택해주세요.";
    }

    if (!title.trim()) {
      return "대회명을 입력해주세요.";
    }

    if (!TOURNAMENT_BEST_OF_OPTIONS.includes(bestOf)) {
      return "경기 기본 세트 수를 다시 선택해주세요.";
    }

    if (bracketType === "SINGLE_ELIMINATION" && singleMatches.length === 0) {
      return "싱글 엘리미네이션은 경기 블록이 1개 이상 필요합니다.";
    }

    if (bracketType === "DUAL_GROUP") {
      if (dualGroups.length === 0) {
        return "듀얼 조별전은 조가 1개 이상 필요합니다.";
      }

      const emptyGroup = dualGroups.find((group) =>
        group.slots.every((participantId) => !participantId),
      );

      if (emptyGroup) {
        return `${emptyGroup.groupName}에 참가자를 1명 이상 배치해주세요.`;
      }
    }

    if (assignedSlotCount < 2) {
      return "슬롯에 실제 참가자를 2명 이상 배치해주세요.";
    }

    return null;
  }

  function handleSelectBracketType(nextBracketType: TournamentBracketType) {
    setSubmitError(null);
    setBracketType(nextBracketType);

    if (nextBracketType === "SINGLE_ELIMINATION") {
      setSingleMatches(createInitialSingleMatches());
    } else {
      setDualGroups(createInitialDualGroups());
    }

    setSelectedParticipantId(null);
  }

  function handleResetBuilder() {
    setSubmitError(null);
    setBracketType(null);
    setSingleMatches(createInitialSingleMatches());
    setDualGroups(createInitialDualGroups());
    setSelectedParticipantId(null);
  }

  function handleAddUser(user: RpsDraftUserSearchResult) {
    setSubmitError(null);
    setParticipants((current) => {
      if (current.some((participant) => participant.userId === user.id)) {
        return current;
      }

      return [...current, buildUserParticipant(user)];
    });
  }

  function removeParticipantFromAllSlots(participantId: string) {
    setSingleMatches((current) => {
      const next = cloneSingleMatches(current);
      removeParticipantFromSingleMatches(next, participantId);
      return next;
    });
    setDualGroups((current) => {
      const next = cloneDualGroups(current);
      removeParticipantFromDualGroups(next, participantId);
      return next;
    });
  }

  function handleRemoveParticipant(participantId: string) {
    removeParticipantFromAllSlots(participantId);
    setParticipants((current) =>
      current.filter((participant) => participant.id !== participantId),
    );
    setSelectedParticipantId((current) =>
      current === participantId ? null : current,
    );
    setSubmitError(null);
  }

  function handleAddSingleMatch() {
    setSubmitError(null);
    setSingleMatches((current) => [
      ...current,
      {
        id: createLocalId("single-match"),
        slots: [null, null],
      },
    ]);
  }

  function handleRemoveSingleMatch() {
    if (singleMatches.length <= 1) {
      return;
    }

    setSubmitError(null);
    setSingleMatches((current) => current.slice(0, -1));
  }

  function handleAddDualGroup() {
    setSubmitError(null);
    setDualGroups((current) => {
      const nextGroup = createDualGroup(current.length);
      return [
        ...current,
        {
          ...nextGroup,
          id: createLocalId(`dual-group-${nextGroup.groupCode}`),
        },
      ];
    });
  }

  function handleRemoveDualGroup() {
    if (dualGroups.length <= 1) {
      return;
    }

    setSubmitError(null);
    setDualGroups((current) => current.slice(0, -1));
  }

  function clearSlot(slotReference: SlotReference) {
    setSubmitError(null);

    if (slotReference.bracketType === "SINGLE_ELIMINATION") {
      setSingleMatches((current) =>
        current.map((match) => {
          if (match.id !== slotReference.matchId) {
            return match;
          }

          const slots = [...match.slots] as [string | null, string | null];
          slots[slotReference.slotIndex] = null;

          return { ...match, slots };
        }),
      );
      return;
    }

    setDualGroups((current) =>
      current.map((group) => {
        if (group.id !== slotReference.groupId) {
          return group;
        }

        const slots = [...group.slots] as [
          string | null,
          string | null,
          string | null,
          string | null,
        ];
        slots[slotReference.slotIndex] = null;

        return { ...group, slots };
      }),
    );
  }

  function placeParticipant(
    target: SlotReference,
    participantId: string,
    source: SlotReference | null,
  ) {
    if (!participantsById.has(participantId)) {
      return;
    }

    setSubmitError(null);

    if (target.bracketType === "SINGLE_ELIMINATION") {
      setSingleMatches((current) => {
        const next = cloneSingleMatches(current);
        const targetMatch = next.find((match) => match.id === target.matchId);

        if (!targetMatch) {
          return current;
        }

        const displacedParticipantId = targetMatch.slots[target.slotIndex];

        if (
          source &&
          source.bracketType === "SINGLE_ELIMINATION" &&
          isSameSlot(source, target)
        ) {
          return current;
        }

        removeParticipantFromSingleMatches(next, participantId);

        if (
          source?.bracketType === "SINGLE_ELIMINATION" &&
          displacedParticipantId &&
          displacedParticipantId !== participantId
        ) {
          const sourceMatch = next.find((match) => match.id === source.matchId);

          if (sourceMatch) {
            sourceMatch.slots[source.slotIndex] = displacedParticipantId;
          }
        }

        targetMatch.slots[target.slotIndex] = participantId;
        return next;
      });
      return;
    }

    setDualGroups((current) => {
      const next = cloneDualGroups(current);
      const targetGroup = next.find((group) => group.id === target.groupId);

      if (!targetGroup) {
        return current;
      }

      const displacedParticipantId = targetGroup.slots[target.slotIndex];

      if (
        source &&
        source.bracketType === "DUAL_GROUP" &&
        isSameSlot(source, target)
      ) {
        return current;
      }

      removeParticipantFromDualGroups(next, participantId);

      if (
        source?.bracketType === "DUAL_GROUP" &&
        displacedParticipantId &&
        displacedParticipantId !== participantId
      ) {
        const sourceGroup = next.find((group) => group.id === source.groupId);

        if (sourceGroup) {
          sourceGroup.slots[source.slotIndex] = displacedParticipantId;
        }
      }

      targetGroup.slots[target.slotIndex] = participantId;
      return next;
    });
  }

  function handleSlotDrop(event: DragEvent<HTMLDivElement>, target: SlotReference) {
    event.preventDefault();
    const dragData = readDragData(event);

    if (!dragData) {
      return;
    }

    const source: SlotReference | null =
      dragData.source === "SLOT"
        ? dragData.bracketType === "SINGLE_ELIMINATION"
          ? {
              bracketType: "SINGLE_ELIMINATION",
              matchId: dragData.matchId,
              slotIndex: dragData.slotIndex,
            }
          : {
              bracketType: "DUAL_GROUP",
              groupId: dragData.groupId,
              slotIndex: dragData.slotIndex,
            }
        : null;

    placeParticipant(target, dragData.participantId, source);
    setSelectedParticipantId(null);
  }

  function handleSlotClick(target: SlotReference) {
    if (!selectedParticipantId) {
      return;
    }

    placeParticipant(target, selectedParticipantId, null);
    setSelectedParticipantId(null);
  }

  function handlePoolDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    const dragData = readDragData(event);

    if (!dragData || dragData.source !== "SLOT") {
      return;
    }

    if (dragData.bracketType === "SINGLE_ELIMINATION") {
      clearSlot({
        bracketType: "SINGLE_ELIMINATION",
        matchId: dragData.matchId,
        slotIndex: dragData.slotIndex,
      });
      return;
    }

    clearSlot({
      bracketType: "DUAL_GROUP",
      groupId: dragData.groupId,
      slotIndex: dragData.slotIndex,
    });
  }

  function buildGroupsPayload(): TournamentCreateGroupRequest[] {
    if (bracketType === "SINGLE_ELIMINATION") {
      return [
        {
          groupCode: "MAIN",
          groupName: "본선",
          slots: singleMatches.flatMap((match, matchIndex) =>
            match.slots.flatMap((participantId, slotIndex) => {
              const participant = participantId
                ? participantsById.get(participantId)
                : null;

              return participant
                ? [buildSlotRequest(matchIndex * 2 + slotIndex + 1, participant)]
                : [];
            }),
          ),
        },
      ];
    }

    return dualGroups.map((group) => ({
      groupCode: group.groupCode,
      groupName: group.groupName,
      slots: group.slots.flatMap((participantId, slotIndex) => {
        const participant = participantId
          ? participantsById.get(participantId)
          : null;

        return participant ? [buildSlotRequest(slotIndex + 1, participant)] : [];
      }),
    }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!bracketType) {
      return;
    }

    const nextValidationMessage = getValidationMessage();

    if (nextValidationMessage) {
      setSubmitError(nextValidationMessage);
      return;
    }

    setCreating(true);
    setSubmitError(null);

    try {
      const createdTournament = await createTournament({
        title: title.trim(),
        bracketType,
        bestOf,
        groups: buildGroupsPayload(),
      });

      router.push(`/tournament/${createdTournament.id}`);
    } catch (error) {
      setSubmitError(
        error instanceof Error
          ? error.message
          : "토너먼트를 등록하지 못했습니다.",
      );
    } finally {
      setCreating(false);
    }
  }

  return (
    <form
      className="relative left-1/2 w-[calc(100vw-1.25rem)] max-w-[1600px] -translate-x-1/2 space-y-4 sm:w-[calc(100vw-2rem)]"
      onSubmit={handleSubmit}
    >
      <SurfaceCard className="p-6 sm:p-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-accent">
              Admin Tournament
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
              대진표 등록
            </h1>
          </div>

          {bracketType ? (
            <Button variant="outline" onClick={handleResetBuilder}>
              처음부터 다시
            </Button>
          ) : null}
        </div>
      </SurfaceCard>

      {!bracketType ? (
        <SurfaceCard className="p-6 sm:p-8">
          <div className="grid gap-3 md:grid-cols-2">
            <button
              type="button"
              className="rounded-lg border border-line-strong bg-surface-strong px-5 py-6 text-left transition-colors hover:border-accent hover:bg-accent-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              onClick={() => handleSelectBracketType("SINGLE_ELIMINATION")}
            >
              <span className="text-lg font-semibold text-foreground">
                싱글 엘리미네이션 만들기
              </span>
              <span className="mt-2 block text-sm leading-6 text-muted">
                경기 블록을 2슬롯 단위로 추가하고 빈 칸은 부전승으로 처리합니다.
              </span>
            </button>

            <button
              type="button"
              className="rounded-lg border border-line-strong bg-surface-strong px-5 py-6 text-left transition-colors hover:border-accent hover:bg-accent-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              onClick={() => handleSelectBracketType("DUAL_GROUP")}
            >
              <span className="text-lg font-semibold text-foreground">
                듀얼 조별전 만들기
              </span>
              <span className="mt-2 block text-sm leading-6 text-muted">
                조를 4슬롯 단위로 추가하고 빈 칸은 부전승으로 처리합니다.
              </span>
            </button>
          </div>
        </SurfaceCard>
      ) : (
        <div className="grid gap-4 xl:grid-cols-[400px_minmax(0,1fr)] xl:items-start">
          <SurfaceCard className="space-y-5 p-5 sm:p-6">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-foreground" htmlFor="tournament-title">
                대회명
              </label>
              <Input
                id="tournament-title"
                value={title}
                onChange={(event) => {
                  setTitle(event.target.value);
                  setSubmitError(null);
                }}
                placeholder="예: 5월 정기 토너먼트"
                disabled={creating}
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
              <label className="grid gap-2 text-sm font-semibold text-foreground">
                경기 기본 세트 수
                <select
                  value={bestOf}
                  onChange={(event) => {
                    setBestOf(Number(event.target.value) as TournamentBestOf);
                    setSubmitError(null);
                  }}
                  disabled={creating}
                  className="w-full rounded-lg border border-line-strong bg-surface-strong px-4 py-3 text-sm text-foreground outline-none transition-colors focus:border-accent focus:bg-white disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {TOURNAMENT_BEST_OF_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      Bo{option}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <RpsDraftUserSearch
              clearOnSelect
              label="내부 유저 검색"
              placeholder="닉네임 또는 아이디"
              onSelect={handleAddUser}
              disabled={creating}
              disabledUserIds={disabledUserIds}
              disabledUserMessage="이미 참가자 풀에 추가된 유저입니다."
              emptyMessage="검색 결과가 없습니다."
            />

            <ParticipantPool
              assignedParticipantIds={assignedParticipantIds}
              onDropToPool={handlePoolDrop}
              onDragStart={(event, participantId) =>
                writeDragData(event, { source: "POOL", participantId })
              }
              onRemoveParticipant={handleRemoveParticipant}
              onSelectParticipant={(participantId) =>
                setSelectedParticipantId((current) =>
                  current === participantId ? null : participantId,
                )
              }
              participants={participants}
              selectedParticipantId={selectedParticipantId}
            />

            <div className="rounded-lg border border-line bg-surface-strong p-4">
              <p className="text-sm font-semibold text-foreground">생성 요약</p>
              <dl className="mt-4 grid gap-2 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-muted">방식</dt>
                  <dd className="font-semibold text-foreground">
                    {bracketType === "SINGLE_ELIMINATION"
                      ? "싱글 엘리미네이션"
                      : "듀얼 조별전"}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-muted">배치 참가자</dt>
                  <dd className="font-semibold text-foreground">
                    {assignedSlotCount}명
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-muted">전체 슬롯</dt>
                  <dd className="font-semibold text-foreground">
                    {totalSlotCount}칸
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-muted">부전승</dt>
                  <dd className="font-semibold text-foreground">
                    {byeCount}칸
                  </dd>
                </div>
              </dl>
            </div>

            {validationMessage ? (
              <p className="rounded-lg border border-warning-ink/25 bg-warning-soft px-4 py-3 text-sm leading-6 text-warning-ink">
                {validationMessage}
              </p>
            ) : null}

            {submitError ? (
              <p className="rounded-lg border border-danger-ink/20 bg-danger-soft px-4 py-3 text-sm leading-6 text-danger-ink">
                {submitError}
              </p>
            ) : null}

            <Button
              type="submit"
              variant="accent"
              fullWidth
              disabled={!canSubmit}
            >
              {creating ? "등록 중..." : "대진표 등록"}
            </Button>
          </SurfaceCard>

          <SurfaceCard className="min-w-0 overflow-hidden p-0">
            {bracketType === "SINGLE_ELIMINATION" ? (
              <SingleBuilderBoard
                bestOf={bestOf}
                matches={singleMatches}
                participantsById={participantsById}
                selectedParticipantId={selectedParticipantId}
                onAddMatch={handleAddSingleMatch}
                onClearSlot={clearSlot}
                onDropSlot={handleSlotDrop}
                onRemoveMatch={handleRemoveSingleMatch}
                onSlotClick={handleSlotClick}
              />
            ) : (
              <DualBuilderBoard
                bestOf={bestOf}
                groups={dualGroups}
                participantsById={participantsById}
                selectedParticipantId={selectedParticipantId}
                onAddGroup={handleAddDualGroup}
                onClearSlot={clearSlot}
                onDropSlot={handleSlotDrop}
                onRemoveGroup={handleRemoveDualGroup}
                onSlotClick={handleSlotClick}
              />
            )}
          </SurfaceCard>
        </div>
      )}
    </form>
  );
}

function SingleBuilderBoard({
  bestOf,
  matches,
  participantsById,
  selectedParticipantId,
  onAddMatch,
  onClearSlot,
  onDropSlot,
  onRemoveMatch,
  onSlotClick,
}: {
  bestOf: TournamentBestOf;
  matches: SingleMatchState[];
  participantsById: Map<string, BuilderParticipant>;
  selectedParticipantId: string | null;
  onAddMatch: () => void;
  onClearSlot: (slotReference: SlotReference) => void;
  onDropSlot: (event: DragEvent<HTMLDivElement>, slotReference: SlotReference) => void;
  onRemoveMatch: () => void;
  onSlotClick: (slotReference: SlotReference) => void;
}) {
  return (
    <div className="bg-[#142333]">
      <div className="flex flex-col gap-3 border-b border-white/10 px-4 py-4 text-white sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase text-accent">Single Elimination</p>
          <h2 className="mt-1 text-xl font-semibold">싱글 엘리미네이션</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={onAddMatch}>
            + 경기 추가
          </Button>
          <Button
            variant="outline"
            onClick={onRemoveMatch}
            disabled={matches.length <= 1}
          >
            - 경기 삭제
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto p-6">
        <div className="grid min-w-[960px] gap-4 sm:grid-cols-2 2xl:grid-cols-3">
          {matches.map((match, matchIndex) => (
            <section
              key={match.id}
              className="rounded-lg border border-white/10 bg-white/[0.055] p-4"
              aria-label={`${matchIndex + 1}경기`}
            >
              <div className="mb-4 flex items-center justify-between gap-3 text-white">
                <h3 className="text-base font-semibold">{matchIndex + 1}경기</h3>
                <span className="rounded-full bg-white/10 px-2 py-1 text-xs font-semibold text-white/60">
                  Bo{bestOf}
                </span>
              </div>
              <div className="grid gap-3">
                {match.slots.map((participantId, slotIndex) => {
                  const slotReference: SlotReference = {
                    bracketType: "SINGLE_ELIMINATION",
                    matchId: match.id,
                    slotIndex,
                  };
                  const participant = participantId
                    ? participantsById.get(participantId) ?? null
                    : null;

                  return (
                    <BuilderSlot
                      key={slotIndex}
                      assigned={participant}
                      isSelectedTarget={Boolean(selectedParticipantId)}
                      label={`${matchIndex + 1}경기 ${slotIndex + 1}슬롯`}
                      slotNo={matchIndex * 2 + slotIndex + 1}
                      onClear={() => onClearSlot(slotReference)}
                      onClickSlot={() => onSlotClick(slotReference)}
                      onDragStart={(event) => {
                        if (!participantId) {
                          return;
                        }

                        writeDragData(event, {
                          source: "SLOT",
                          participantId,
                          ...slotReference,
                        });
                      }}
                      onDropParticipant={(event) => onDropSlot(event, slotReference)}
                    />
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}

function DualBuilderBoard({
  bestOf,
  groups,
  participantsById,
  selectedParticipantId,
  onAddGroup,
  onClearSlot,
  onDropSlot,
  onRemoveGroup,
  onSlotClick,
}: {
  bestOf: TournamentBestOf;
  groups: DualGroupState[];
  participantsById: Map<string, BuilderParticipant>;
  selectedParticipantId: string | null;
  onAddGroup: () => void;
  onClearSlot: (slotReference: SlotReference) => void;
  onDropSlot: (event: DragEvent<HTMLDivElement>, slotReference: SlotReference) => void;
  onRemoveGroup: () => void;
  onSlotClick: (slotReference: SlotReference) => void;
}) {
  return (
    <div className="bg-[#142333]">
      <div className="flex flex-col gap-3 border-b border-white/10 px-4 py-4 text-white sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase text-accent">Dual Group</p>
          <h2 className="mt-1 text-xl font-semibold">듀얼 조별전</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={onAddGroup}>
            + 조 추가
          </Button>
          <Button
            variant="outline"
            onClick={onRemoveGroup}
            disabled={groups.length <= 1}
          >
            - 조 삭제
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto p-6">
        <div className="grid min-w-[1040px] gap-4 lg:grid-cols-2">
          {groups.map((group) => (
            <section
              key={group.id}
              className="rounded-lg border border-white/10 bg-white/[0.055] p-4"
              aria-labelledby={`${group.id}-title`}
            >
              <div className="mb-4 flex items-center gap-3 text-white">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent text-sm font-black">
                  {group.groupCode}
                </span>
                <h3 id={`${group.id}-title`} className="text-base font-semibold">
                  {group.groupName}
                </h3>
                <span className="ml-auto rounded-full bg-white/10 px-2 py-1 text-xs font-semibold text-white/60">
                  Bo{bestOf}
                </span>
              </div>
              <div className="grid gap-3">
                {group.slots.map((participantId, slotIndex) => {
                  const slotReference: SlotReference = {
                    bracketType: "DUAL_GROUP",
                    groupId: group.id,
                    slotIndex,
                  };
                  const participant = participantId
                    ? participantsById.get(participantId) ?? null
                    : null;

                  return (
                    <BuilderSlot
                      key={slotIndex}
                      assigned={participant}
                      isSelectedTarget={Boolean(selectedParticipantId)}
                      label={`${group.groupName} ${slotIndex + 1}슬롯`}
                      slotNo={slotIndex + 1}
                      onClear={() => onClearSlot(slotReference)}
                      onClickSlot={() => onSlotClick(slotReference)}
                      onDragStart={(event) => {
                        if (!participantId) {
                          return;
                        }

                        writeDragData(event, {
                          source: "SLOT",
                          participantId,
                          ...slotReference,
                        });
                      }}
                      onDropParticipant={(event) => onDropSlot(event, slotReference)}
                    />
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
