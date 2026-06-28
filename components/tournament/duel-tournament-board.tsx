"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent,
} from "react";
import { TournamentMatchCard } from "@/components/tournament/tournament-match-card";
import type {
  Tournament,
  TournamentConnectorSegment,
  TournamentGroup,
  TournamentMatch,
  TournamentParticipant,
  TournamentParticipantConnector,
  TournamentResultSlot,
} from "@/lib/tournament/types";
import { cn } from "@/lib/utils";

type DuelTournamentBoardProps = {
  matchPreviews?: Record<string, TournamentMatchPreview>;
  onMatchSelect?: (match: TournamentMatch) => void;
  pendingApprovalMatchIds?: ReadonlySet<string>;
  selectedMatchId?: string | null;
  tournament: Tournament;
};

export type TournamentMatchPreview = {
  scores: Record<number, number>;
  winnerSlotNo: number | null;
};

type TournamentBoardViewportProps = {
  initialScale: number;
  matchPreviews?: Record<string, TournamentMatchPreview>;
  onMatchSelect?: (match: TournamentMatch) => void;
  pendingApprovalMatchIds?: ReadonlySet<string>;
  selectedMatchId?: string | null;
  tournament: Tournament;
};

type DuelGroupPanelProps = {
  group: TournamentGroup;
  matchPreviews?: Record<string, TournamentMatchPreview>;
  onMatchSelect?: (match: TournamentMatch) => void;
  pendingApprovalMatchIds?: ReadonlySet<string>;
  selectedMatchId?: string | null;
};

type HoverConnectorsProps = {
  segments: TournamentConnectorSegment[];
};

type QualifiedSummaryProps = {
  resultSlots: TournamentResultSlot[];
  hoveredParticipantId: string | null;
  onParticipantEnter: (participantId: string) => void;
  onParticipantLeave: (participantId: string) => void;
};

const MIN_BOARD_SCALE = 0.45;
const MAX_BOARD_SCALE = 1.7;
const DEFAULT_BOARD_SCALE = 1;
const SINGLE_ELIMINATION_INITIAL_SCALE = 1;
const BOARD_WIDTH = 1220;
const GROUP_PANEL_MIN_HEIGHT = 440;
const GROUP_PANEL_GAP = 18;
const MATCH_CARD_WIDTH = 220;
const MATCH_CARD_HEIGHT = 84;
const MATCH_CARD_HEADER_HEIGHT = 23;
const MATCH_CARD_ROW_HEIGHT = 30;
const GROUP_PANEL_BOTTOM_PADDING = 40;
const TALL_GROUP_PANEL_BOTTOM_PADDING = 260;
const INITIAL_FIT_PADDING = 36;
const DRAG_PAN_SPEED = 1.5;

const routeSegments = {
  openingTopToWinners: [
    { orientation: "HORIZONTAL", x: 220, y: 144, length: 45 },
    { orientation: "VERTICAL", x: 265, y: 144, length: 25 },
    { orientation: "HORIZONTAL", x: 265, y: 169, length: 45 },
  ],
  openingBottomToWinners: [
    { orientation: "HORIZONTAL", x: 220, y: 286, length: 45 },
    { orientation: "VERTICAL", x: 265, y: 169, length: 117 },
    { orientation: "HORIZONTAL", x: 265, y: 169, length: 45 },
  ],
  openingTopToLosers: [
    { orientation: "HORIZONTAL", x: 220, y: 144, length: 75 },
    { orientation: "VERTICAL", x: 295, y: 144, length: 178 },
    { orientation: "HORIZONTAL", x: 295, y: 322, length: 15 },
  ],
  openingBottomToLosers: [
    { orientation: "HORIZONTAL", x: 220, y: 286, length: 55 },
    { orientation: "VERTICAL", x: 275, y: 286, length: 36 },
    { orientation: "HORIZONTAL", x: 275, y: 322, length: 35 },
  ],
  winnersToDecider: [
    { orientation: "HORIZONTAL", x: 530, y: 169, length: 45 },
    { orientation: "VERTICAL", x: 575, y: 169, length: 77 },
    { orientation: "HORIZONTAL", x: 575, y: 246, length: 85 },
  ],
  losersToDecider: [
    { orientation: "HORIZONTAL", x: 530, y: 322, length: 80 },
    { orientation: "VERTICAL", x: 610, y: 246, length: 76 },
    { orientation: "HORIZONTAL", x: 610, y: 246, length: 50 },
  ],
  winnersToResult: [
    { orientation: "HORIZONTAL", x: 530, y: 169, length: 392 },
  ],
  deciderToResult: [
    { orientation: "HORIZONTAL", x: 880, y: 246, length: 42 },
  ],
} satisfies Record<string, TournamentConnectorSegment[]>;

const duelMatchLayoutByKey: Record<string, { layoutCol: number; layoutRow: number }> = {
  A1: { layoutCol: 0, layoutRow: 102 },
  A2: { layoutCol: 0, layoutRow: 244 },
  AW: { layoutCol: 310, layoutRow: 127 },
  AL: { layoutCol: 310, layoutRow: 280 },
  AF: { layoutCol: 660, layoutRow: 204 },
  B1: { layoutCol: 0, layoutRow: 102 },
  B2: { layoutCol: 0, layoutRow: 244 },
  BW: { layoutCol: 310, layoutRow: 127 },
  BL: { layoutCol: 310, layoutRow: 280 },
  BF: { layoutCol: 660, layoutRow: 204 },
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function isSingleEliminationTournament(tournament: Tournament) {
  return tournament.groups.some(
    (group) =>
      (group.groupCode !== "A" && group.groupCode !== "B") ||
      group.matches.some(
        (match) => match.matchRole === "ROUND" || match.matchRole === "FINAL",
      ),
  );
}

function isSingleEliminationGroup(group: TournamentGroup) {
  return (
    group.groupCode === "MAIN" ||
    group.matches.some(
      (match) => match.matchRole === "ROUND" || match.matchRole === "FINAL",
    )
  );
}

function getCanonicalDuelMatchLayout(match: TournamentMatch) {
  return duelMatchLayoutByKey[match.matchKey.toUpperCase()] ?? null;
}

function getRoleFallbackLayout(match: TournamentMatch) {
  switch (match.matchRole) {
    case "WINNERS":
      return { layoutCol: 310, layoutRow: 127 };
    case "LOSERS":
      return { layoutCol: 310, layoutRow: 280 };
    case "DECIDER":
      return { layoutCol: 660, layoutRow: 204 };
    case "FINAL":
      return { layoutCol: 310, layoutRow: 204 };
    case "ROUND":
    case "OPENING":
    default:
      return { layoutCol: 0, layoutRow: 102 };
  }
}

function getGridLayout(
  match: TournamentMatch,
  fallbackLayout: { layoutCol: number; layoutRow: number },
) {
  const hasGridLayout =
    (match.layoutCol > 0 && match.layoutCol < 80) ||
    (match.layoutRow > 0 && match.layoutRow < 80);

  if (!hasGridLayout) {
    return fallbackLayout;
  }

  return {
    layoutCol:
      match.layoutCol > 0 && match.layoutCol < 80
        ? (match.layoutCol - 1) * 310
        : fallbackLayout.layoutCol,
    layoutRow:
      match.layoutRow > 0 && match.layoutRow < 80
        ? 102 + (match.layoutRow - 1) * 102
        : fallbackLayout.layoutRow,
  };
}

function getResolvedMatchLayout(match: TournamentMatch) {
  const canonicalLayout = getCanonicalDuelMatchLayout(match);

  if (canonicalLayout) {
    return canonicalLayout;
  }

  const fallbackLayout = getRoleFallbackLayout(match);
  const hasPixelLayout =
    Math.abs(match.layoutCol) >= 80 || Math.abs(match.layoutRow) >= 80;

  if (!hasPixelLayout) {
    return getGridLayout(match, fallbackLayout);
  }

  return {
    layoutCol: match.layoutCol,
    layoutRow: match.layoutRow,
  };
}

function getGroupPanelHeight(group: TournamentGroup) {
  const matchBottom = group.matches.reduce((bottom, match) => {
    const matchLayout = getResolvedMatchLayout(match);

    return Math.max(bottom, matchLayout.layoutRow + MATCH_CARD_HEIGHT);
  }, 0);
  const bottomPadding =
    matchBottom > GROUP_PANEL_MIN_HEIGHT
      ? TALL_GROUP_PANEL_BOTTOM_PADDING
      : GROUP_PANEL_BOTTOM_PADDING;

  return Math.max(
    GROUP_PANEL_MIN_HEIGHT,
    matchBottom + bottomPadding,
  );
}

function getBoardHeight(groups: TournamentGroup[]) {
  if (groups.length === 0) {
    return GROUP_PANEL_MIN_HEIGHT;
  }

  return (
    groups.reduce((height, group) => height + getGroupPanelHeight(group), 0) +
    Math.max(0, groups.length - 1) * GROUP_PANEL_GAP
  );
}

function getGroupMatchContentHeight(group: TournamentGroup) {
  const matchBottom = group.matches.reduce((bottom, match) => {
    const matchLayout = getResolvedMatchLayout(match);

    return Math.max(bottom, matchLayout.layoutRow + MATCH_CARD_HEIGHT);
  }, 0);

  return Math.max(matchBottom + GROUP_PANEL_BOTTOM_PADDING, GROUP_PANEL_MIN_HEIGHT);
}

function getBoardFitHeight(groups: TournamentGroup[]) {
  if (groups.length === 0) {
    return GROUP_PANEL_MIN_HEIGHT;
  }

  return groups.reduce((height, group, index) => {
    const isLastGroup = index === groups.length - 1;
    const groupHeight = isLastGroup
      ? getGroupMatchContentHeight(group)
      : getGroupPanelHeight(group);

    return height + groupHeight + (isLastGroup ? 0 : GROUP_PANEL_GAP);
  }, 0);
}

function findParticipantMatch(
  matches: TournamentMatch[],
  participantId: string,
  role: TournamentMatch["matchRole"],
) {
  return matches.find(
    (match) =>
      match.matchRole === role &&
      match.slots.some((slot) => slot.participant?.id === participantId),
  );
}

function appendSegments(
  connectorMap: Map<string, TournamentConnectorSegment[]>,
  participantId: string,
  segments: TournamentConnectorSegment[],
) {
  connectorMap.set(participantId, [
    ...(connectorMap.get(participantId) ?? []),
    ...segments,
  ]);
}

function getSlotCenterY(match: TournamentMatch, slotNo: number) {
  const slotIndex = Math.max(
    0,
    match.slots.findIndex((slot) => slot.slotNo === slotNo),
  );
  const matchLayout = getResolvedMatchLayout(match);

  return (
    matchLayout.layoutRow +
    MATCH_CARD_HEADER_HEIGHT +
    slotIndex * MATCH_CARD_ROW_HEIGHT +
    MATCH_CARD_ROW_HEIGHT / 2
  );
}

function buildDynamicConnectorSegments(options: {
  participantId: string;
  sourceMatch: TournamentMatch;
  targetMatch: TournamentMatch;
  targetSlotNo: number;
}) {
  const sourceLayout = getResolvedMatchLayout(options.sourceMatch);
  const targetLayout = getResolvedMatchLayout(options.targetMatch);
  const sourceSlot =
    options.sourceMatch.slots.find(
      (slot) => slot.participant?.id === options.participantId,
    ) ?? options.sourceMatch.slots.find((slot) => slot.isWinner);

  if (!sourceSlot) {
    return [];
  }

  const sourceX = sourceLayout.layoutCol + MATCH_CARD_WIDTH;
  const targetX = targetLayout.layoutCol;
  const sourceY = getSlotCenterY(options.sourceMatch, sourceSlot.slotNo);
  const targetY = getSlotCenterY(options.targetMatch, options.targetSlotNo);
  const midX = sourceX + Math.max(34, (targetX - sourceX) / 2);
  const segments: TournamentConnectorSegment[] = [];

  if (midX > sourceX) {
    segments.push({
      orientation: "HORIZONTAL",
      x: sourceX,
      y: sourceY,
      length: midX - sourceX,
    });
  }

  if (Math.abs(targetY - sourceY) > 0) {
    segments.push({
      orientation: "VERTICAL",
      x: midX,
      y: Math.min(sourceY, targetY),
      length: Math.abs(targetY - sourceY),
    });
  }

  if (targetX > midX) {
    segments.push({
      orientation: "HORIZONTAL",
      x: midX,
      y: targetY,
      length: targetX - midX,
    });
  }

  return segments;
}

type SingleParticipantAppearance = {
  match: TournamentMatch;
  slotNo: number;
};

function compareSingleParticipantAppearances(
  left: SingleParticipantAppearance,
  right: SingleParticipantAppearance,
) {
  const leftRound = left.match.roundNo ?? Number.MAX_SAFE_INTEGER;
  const rightRound = right.match.roundNo ?? Number.MAX_SAFE_INTEGER;
  const leftMatchNo = left.match.matchNo ?? Number.MAX_SAFE_INTEGER;
  const rightMatchNo = right.match.matchNo ?? Number.MAX_SAFE_INTEGER;

  return (
    leftRound - rightRound ||
    leftMatchNo - rightMatchNo ||
    left.match.displayOrder - right.match.displayOrder ||
    left.slotNo - right.slotNo
  );
}

function buildSingleParticipantConnectors(group: TournamentGroup) {
  const appearancesByParticipantId = new Map<
    string,
    SingleParticipantAppearance[]
  >();

  group.matches.forEach((match) => {
    match.slots.forEach((slot) => {
      const participantId = slot.participant?.id;

      if (!participantId || slot.isBye) {
        return;
      }

      appearancesByParticipantId.set(participantId, [
        ...(appearancesByParticipantId.get(participantId) ?? []),
        { match, slotNo: slot.slotNo },
      ]);
    });
  });

  return Array.from(appearancesByParticipantId.entries()).map(
    ([participantId, rawAppearances]): TournamentParticipantConnector => {
      const appearances = Array.from(
        new Map(
          rawAppearances.map((appearance) => [
            appearance.match.id,
            appearance,
          ]),
        ).values(),
      ).sort(compareSingleParticipantAppearances);
      const segments = appearances.flatMap((appearance, index) => {
        const previousAppearance = appearances[index - 1];

        if (!previousAppearance) {
          return [];
        }

        return buildDynamicConnectorSegments({
          participantId,
          sourceMatch: previousAppearance.match,
          targetMatch: appearance.match,
          targetSlotNo: appearance.slotNo,
        });
      });

      return { participantId, segments };
    },
  );
}

function buildComputedConnectors(group: TournamentGroup) {
  if (isSingleEliminationGroup(group)) {
    return buildSingleParticipantConnectors(group);
  }

  const connectorMap = new Map<string, TournamentConnectorSegment[]>();
  const matchById = new Map(group.matches.map((match) => [match.id, match]));

  group.matches.forEach((targetMatch) => {
    targetMatch.slots.forEach((slot) => {
      const participantId = slot.participant?.id;
      const sourceMatchId = slot.sourceMatchId;

      if (!participantId || !sourceMatchId) {
        return;
      }

      const sourceMatch = matchById.get(sourceMatchId);

      if (!sourceMatch) {
        return;
      }

      if (sourceMatch.matchRole === "OPENING" && targetMatch.matchRole === "WINNERS") {
        const sourceLayout = getResolvedMatchLayout(sourceMatch);

        appendSegments(
          connectorMap,
          participantId,
          sourceLayout.layoutRow < 200
            ? routeSegments.openingTopToWinners
            : routeSegments.openingBottomToWinners,
        );
      }

      if (sourceMatch.matchRole === "OPENING" && targetMatch.matchRole === "LOSERS") {
        const sourceLayout = getResolvedMatchLayout(sourceMatch);

        appendSegments(
          connectorMap,
          participantId,
          sourceLayout.layoutRow < 200
            ? routeSegments.openingTopToLosers
            : routeSegments.openingBottomToLosers,
        );
      }

      if (sourceMatch.matchRole === "WINNERS" && targetMatch.matchRole === "DECIDER") {
        appendSegments(connectorMap, participantId, routeSegments.winnersToDecider);
      }

      if (sourceMatch.matchRole === "LOSERS" && targetMatch.matchRole === "DECIDER") {
        appendSegments(connectorMap, participantId, routeSegments.losersToDecider);
      }
    });
  });

  group.resultSlots.forEach((resultSlot) => {
    const participantId = resultSlot.participant?.id;

    if (!participantId) {
      return;
    }

    if (
      resultSlot.rankNo === 1 &&
      findParticipantMatch(group.matches, participantId, "WINNERS")
    ) {
      appendSegments(connectorMap, participantId, routeSegments.winnersToResult);
    }

    if (
      resultSlot.rankNo === 2 &&
      findParticipantMatch(group.matches, participantId, "DECIDER")
    ) {
      appendSegments(connectorMap, participantId, routeSegments.deciderToResult);
    }
  });

  return Array.from(connectorMap.entries()).map(
    ([participantId, segments]): TournamentParticipantConnector => ({
      participantId,
      segments,
    }),
  );
}

function ParticipantNameButton({
  participant,
  isHighlighted,
  onParticipantEnter,
  onParticipantLeave,
}: {
  participant: TournamentParticipant;
  isHighlighted: boolean;
  onParticipantEnter: (participantId: string) => void;
  onParticipantLeave: (participantId: string) => void;
}) {
  return (
    <button
      type="button"
      className={cn(
        "min-w-0 cursor-default overflow-hidden text-ellipsis whitespace-nowrap text-left text-sm font-extrabold text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
        isHighlighted &&
          "text-accent-ink [text-shadow:0_0_12px_rgba(20,108,148,0.2)]",
      )}
      aria-label={`${participant.displayName} 진출자 흐름 강조`}
      onMouseEnter={() => onParticipantEnter(participant.id)}
      onMouseLeave={() => onParticipantLeave(participant.id)}
      onFocus={() => onParticipantEnter(participant.id)}
      onBlur={() => onParticipantLeave(participant.id)}
    >
      {participant.displayName}
    </button>
  );
}

function QualifiedSummary({
  resultSlots,
  hoveredParticipantId,
  onParticipantEnter,
  onParticipantLeave,
}: QualifiedSummaryProps) {
  return (
    <div className="absolute left-[972px] top-[104px] z-20 grid w-[210px] gap-2.5">
      {resultSlots.map((resultSlot) => {
        const participant = resultSlot.participant;

        return (
          <div
            key={resultSlot.resultKey}
            className={cn(
              "grid gap-1.5 rounded-md border bg-surface p-[11px] shadow-[0_10px_24px_rgba(23,33,43,0.07)]",
              resultSlot.rankNo === 1
                ? "border-success-ink/25"
                : "border-warning-ink/25",
            )}
          >
            <span
              className={cn(
                "text-[11px] font-black",
                resultSlot.rankNo === 1
                  ? "text-success-ink"
                  : "text-warning-ink",
              )}
            >
              {resultSlot.label}
            </span>
            {participant ? (
              <ParticipantNameButton
                participant={participant}
                isHighlighted={participant.id === hoveredParticipantId}
                onParticipantEnter={onParticipantEnter}
                onParticipantLeave={onParticipantLeave}
              />
            ) : (
              <strong className="overflow-hidden text-ellipsis whitespace-nowrap text-sm text-foreground">
                미정
              </strong>
            )}
          </div>
        );
      })}
    </div>
  );
}

function HoverConnectors({ segments }: HoverConnectorsProps) {
  return (
    <>
      {segments.map((segment, index) => {
        const isHorizontal = segment.orientation === "HORIZONTAL";

        return (
          <span
            key={`${segment.orientation}-${segment.x}-${segment.y}-${index}`}
            aria-hidden="true"
            className="pointer-events-none absolute z-10 bg-accent opacity-90 drop-shadow-[0_0_5px_rgba(20,108,148,0.24)]"
            style={{
              left: segment.x,
              top: segment.y,
              width: isHorizontal ? segment.length : 2,
              height: isHorizontal ? 2 : segment.length,
            }}
          />
        );
      })}
    </>
  );
}

function DuelGroupPanel({
  group,
  matchPreviews,
  onMatchSelect,
  pendingApprovalMatchIds,
  selectedMatchId,
}: DuelGroupPanelProps) {
  const [hoveredParticipantId, setHoveredParticipantId] = useState<string | null>(
    null,
  );
  const isSingleGroup = isSingleEliminationGroup(group);
  const connectors = isSingleGroup
    ? buildComputedConnectors(group)
    : group.connectors?.length
      ? group.connectors
      : buildComputedConnectors(group);
  const activeConnector = connectors.find(
    (connector) => connector.participantId === hoveredParticipantId,
  );

  function handleParticipantLeave(participantId: string) {
    setHoveredParticipantId((current) =>
      current === participantId ? null : current,
    );
  }

  return (
    <section
      className="relative overflow-hidden rounded-lg border border-line bg-surface-muted"
      style={{
        height: getGroupPanelHeight(group),
        background:
          "linear-gradient(90deg, rgba(20, 108, 148, 0.055) 0 470px, rgba(138, 101, 0, 0.055) 470px 745px, rgba(38, 117, 80, 0.055) 745px), linear-gradient(180deg, #ffffff 0, #eef3f7 100%)",
      }}
      aria-label={isSingleGroup ? "토너먼트 대진표" : undefined}
      aria-labelledby={isSingleGroup ? undefined : `${group.id}-title`}
      onMouseLeave={() => setHoveredParticipantId(null)}
    >
      <div className="absolute inset-x-[18px] top-[217px] h-px bg-line" />

      {!isSingleGroup ? (
        <div className="absolute left-[18px] top-4 z-30 flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent text-[15px] font-black text-white">
            {group.groupCode}
          </span>
          <div>
            <h2
              id={`${group.id}-title`}
              className="text-lg font-extrabold leading-tight text-foreground"
            >
              {group.groupName}
            </h2>
          </div>
        </div>
      ) : null}

      {activeConnector ? (
        <HoverConnectors segments={activeConnector.segments} />
      ) : null}

      {group.matches.map((match) => {
        const matchLayout = getResolvedMatchLayout(match);
        const preview = matchPreviews?.[match.id];

        return (
          <div
            key={match.id}
            className="absolute z-20 w-[220px]"
            style={{
              left: matchLayout.layoutCol,
              top: matchLayout.layoutRow,
            }}
          >
            <TournamentMatchCard
              hasPendingApproval={pendingApprovalMatchIds?.has(match.id) ?? false}
              match={match}
              hoveredParticipantId={hoveredParticipantId}
              isSelected={selectedMatchId === match.id}
              onParticipantEnter={setHoveredParticipantId}
              onParticipantLeave={handleParticipantLeave}
              onSelect={onMatchSelect}
              previewScores={preview?.scores}
              previewWinnerSlotNo={preview?.winnerSlotNo}
            />
          </div>
        );
      })}

      <QualifiedSummary
        resultSlots={group.resultSlots}
        hoveredParticipantId={hoveredParticipantId}
        onParticipantEnter={setHoveredParticipantId}
        onParticipantLeave={handleParticipantLeave}
      />
    </section>
  );
}

function TournamentBoardViewport({
  initialScale,
  matchPreviews,
  onMatchSelect,
  pendingApprovalMatchIds,
  selectedMatchId,
  tournament,
}: TournamentBoardViewportProps) {
  const [scale, setScale] = useState(initialScale);
  const scaleRef = useRef(initialScale);
  const userAdjustedScaleRef = useRef(false);
  const viewportRef = useRef<HTMLElement | null>(null);
  const boardHeight = useMemo(
    () => getBoardHeight(tournament.groups),
    [tournament.groups],
  );
  const boardFitHeight = useMemo(
    () => getBoardFitHeight(tournament.groups),
    [tournament.groups],
  );
  const dragRef = useRef<{
    pointerId: number;
    x: number;
    y: number;
    scrollLeft: number;
    scrollTop: number;
  } | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    userAdjustedScaleRef.current = false;
  }, [boardFitHeight, initialScale, tournament.id]);

  useEffect(() => {
    const viewport = viewportRef.current;

    if (!viewport) {
      return;
    }

    let frameId: number | null = null;

    function fitBoardToViewport() {
      if (userAdjustedScaleRef.current) {
        return;
      }

      const viewportElement = viewportRef.current;

      if (!viewportElement) {
        return;
      }

      const availableWidth = Math.max(
        viewportElement.clientWidth - INITIAL_FIT_PADDING,
        1,
      );
      const availableHeight = Math.max(
        viewportElement.clientHeight - INITIAL_FIT_PADDING,
        1,
      );
      const nextScale = clamp(
        Math.min(
          initialScale,
          availableWidth / BOARD_WIDTH,
          availableHeight / boardFitHeight,
        ),
        MIN_BOARD_SCALE,
        MAX_BOARD_SCALE,
      );

      scaleRef.current = nextScale;
      setScale(nextScale);
      viewportElement.scrollLeft = 0;
      viewportElement.scrollTop = 0;
    }

    function scheduleFit() {
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId);
      }

      frameId = window.requestAnimationFrame(() => {
        frameId = null;
        fitBoardToViewport();
      });
    }

    scheduleFit();

    const resizeObserver = new ResizeObserver(scheduleFit);
    resizeObserver.observe(viewport);

    return () => {
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId);
      }

      resizeObserver.disconnect();
    };
  }, [boardFitHeight, initialScale]);

  useEffect(() => {
    const viewport = viewportRef.current;

    if (!viewport) {
      return;
    }

    const viewportElement: HTMLElement = viewport;

    function handleWheel(event: WheelEvent) {
      event.preventDefault();
      userAdjustedScaleRef.current = true;

      const currentScale = scaleRef.current;
      const rect = viewportElement.getBoundingClientRect();
      const pointerX = event.clientX - rect.left;
      const pointerY = event.clientY - rect.top;
      const contentX = (viewportElement.scrollLeft + pointerX) / currentScale;
      const contentY = (viewportElement.scrollTop + pointerY) / currentScale;
      const scaleFactor = event.deltaY < 0 ? 1.08 : 0.92;
      const nextScale = clamp(
        currentScale * scaleFactor,
        MIN_BOARD_SCALE,
        MAX_BOARD_SCALE,
      );

      scaleRef.current = nextScale;
      setScale(nextScale);
      requestAnimationFrame(() => {
        viewportElement.scrollLeft = contentX * nextScale - pointerX;
        viewportElement.scrollTop = contentY * nextScale - pointerY;
      });
    }

    viewportElement.addEventListener("wheel", handleWheel, { passive: false });

    return () => {
      viewportElement.removeEventListener("wheel", handleWheel);
    };
  }, []);

  function handlePointerDown(event: PointerEvent<HTMLElement>) {
    if (event.button !== 0) {
      return;
    }

    const target = event.target;

    if (target instanceof HTMLElement) {
      const interactiveTarget = target.closest(
        "button, input, textarea, select, [data-board-interactive='true']",
      );

      if (interactiveTarget) {
        return;
      }
    }

    dragRef.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      scrollLeft: event.currentTarget.scrollLeft,
      scrollTop: event.currentTarget.scrollTop,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    setIsDragging(true);
  }

  function handlePointerMove(event: PointerEvent<HTMLElement>) {
    const dragState = dragRef.current;

    if (!dragState || dragState.pointerId !== event.pointerId) {
      return;
    }

    event.currentTarget.scrollLeft =
      dragState.scrollLeft - (event.clientX - dragState.x) * DRAG_PAN_SPEED;
    event.currentTarget.scrollTop =
      dragState.scrollTop - (event.clientY - dragState.y) * DRAG_PAN_SPEED;
  }

  function stopDragging(event: PointerEvent<HTMLElement>) {
    if (dragRef.current?.pointerId === event.pointerId) {
      dragRef.current = null;
      setIsDragging(false);
    }
  }

  return (
    <section
      ref={viewportRef}
      className={cn(
        "relative h-[calc(100vh-220px)] min-h-[520px] touch-none overflow-hidden rounded-lg border border-line bg-surface p-2.5 shadow-[0_16px_50px_rgba(23,33,43,0.08)] sm:h-[calc(100vh-240px)] sm:min-h-[620px] sm:p-[18px]",
        isDragging ? "cursor-grabbing" : "cursor-grab",
      )}
      aria-label={`${tournament.title} 보드`}
      onPointerCancel={stopDragging}
      onPointerDown={handlePointerDown}
      onPointerLeave={stopDragging}
      onPointerMove={handlePointerMove}
      onPointerUp={stopDragging}
    >
      <div
        className="relative select-none"
        style={{
          width: BOARD_WIDTH * scale,
          height: boardHeight * scale,
        }}
      >
        <div
          className="grid min-w-[1220px] gap-[18px] will-change-transform"
          style={{
            transform: `scale(${scale})`,
            transformOrigin: "0 0",
            width: BOARD_WIDTH,
          }}
        >
          {tournament.groups.map((group) => (
            <DuelGroupPanel
              key={group.id}
              group={group}
              matchPreviews={matchPreviews}
              onMatchSelect={onMatchSelect}
              pendingApprovalMatchIds={pendingApprovalMatchIds}
              selectedMatchId={selectedMatchId}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

export function DuelTournamentBoard({
  matchPreviews,
  onMatchSelect,
  pendingApprovalMatchIds,
  selectedMatchId,
  tournament,
}: DuelTournamentBoardProps) {
  const isSingleElimination = useMemo(
    () => isSingleEliminationTournament(tournament),
    [tournament],
  );
  const initialScale = isSingleElimination
    ? SINGLE_ELIMINATION_INITIAL_SCALE
    : DEFAULT_BOARD_SCALE;

  return (
    <TournamentBoardViewport
      key={`${tournament.id}-${initialScale}`}
      initialScale={initialScale}
      matchPreviews={matchPreviews}
      onMatchSelect={onMatchSelect}
      pendingApprovalMatchIds={pendingApprovalMatchIds}
      selectedMatchId={selectedMatchId}
      tournament={tournament}
    />
  );
}
