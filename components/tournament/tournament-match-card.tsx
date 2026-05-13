import type {
  TournamentMatch,
  TournamentMatchRole,
  TournamentMatchSlot,
} from "@/lib/tournament/types";
import { cn } from "@/lib/utils";

type TournamentMatchCardProps = {
  match: TournamentMatch;
  hoveredParticipantId: string | null;
  isSelected?: boolean;
  onParticipantEnter: (participantId: string) => void;
  onParticipantLeave: (participantId: string) => void;
  onSelect?: (match: TournamentMatch) => void;
  previewScores?: Record<number, number>;
  previewWinnerSlotNo?: number | null;
};

type TournamentPlayerRowProps = {
  slot: TournamentMatchSlot;
  isHighlighted: boolean;
  onParticipantEnter: (participantId: string) => void;
  onParticipantLeave: (participantId: string) => void;
  previewScore?: number;
  previewWinnerSlotNo?: number | null;
};

const roleBorderClassNames: Record<TournamentMatchRole, string> = {
  OPENING: "border-line-strong",
  WINNERS: "border-accent/45",
  LOSERS: "border-warning-ink/35",
  DECIDER: "border-success-ink/35",
  ROUND: "border-line-strong",
  FINAL: "border-success-ink/35",
};

function formatScore(score: number | null | undefined) {
  return typeof score === "number" ? String(score) : "-";
}

function formatScoreAria(score: number | null | undefined) {
  return typeof score === "number" ? `${score}점` : "점수 없음";
}

function hasByeSlot(match: TournamentMatch) {
  return match.slots.some((slot) => slot.isBye);
}

function hasReadySlots(match: TournamentMatch) {
  return (
    match.slots.length === 2 &&
    match.slots.every((slot) => Boolean(slot.participant) && !slot.isBye)
  );
}

function getMatchStatusLabel(match: TournamentMatch) {
  if (hasByeSlot(match)) {
    return "부전승";
  }

  switch (match.status) {
    case "READY":
      return hasReadySlots(match) ? "입력 가능" : "대기";
    case "FINISHED":
      return "확정";
    case "CANCELLED":
      return "취소";
    case "PENDING":
    default:
      return "대기";
  }
}

function getMatchStatusClassName(match: TournamentMatch) {
  if (hasByeSlot(match)) {
    return "bg-surface-muted text-muted";
  }

  switch (match.status) {
    case "READY":
      return hasReadySlots(match)
        ? "bg-accent-soft text-accent-ink"
        : "bg-surface-muted text-muted";
    case "FINISHED":
      return "bg-success-soft text-success-ink";
    case "CANCELLED":
      return "bg-danger-soft text-danger-ink";
    case "PENDING":
    default:
      return "bg-surface-muted text-muted";
  }
}

function isSingleEliminationMatch(match: TournamentMatch) {
  return (
    match.matchRole === "ROUND" ||
    match.matchRole === "FINAL" ||
    /^R\d+M\d+$/i.test(match.matchKey) ||
    match.matchKey.toUpperCase() === "FINAL"
  );
}

function TournamentPlayerRow({
  slot,
  isHighlighted,
  onParticipantEnter,
  onParticipantLeave,
  previewScore,
  previewWinnerSlotNo,
}: TournamentPlayerRowProps) {
  const participant = slot.participant;
  const scoreValue = previewScore ?? slot.score;
  const isWinner =
    previewWinnerSlotNo !== undefined && previewWinnerSlotNo !== null
      ? slot.slotNo === previewWinnerSlotNo
      : slot.isWinner;
  const score = formatScore(scoreValue);
  const rowClassName = cn(
    "grid h-[30px] min-w-0 grid-cols-[22px_minmax(0,1fr)_23px] items-center gap-[7px] border-t border-line/70 px-2 text-left text-xs transition-colors",
    isWinner && !slot.isBye
      ? "bg-accent-soft font-extrabold text-foreground"
      : "text-muted",
    isHighlighted &&
      "text-accent-ink [text-shadow:0_0_12px_rgba(20,108,148,0.2)]",
  );

  if (slot.isBye) {
    const byeLabel = "부전승";

    return (
      <div
        className={cn(rowClassName, "cursor-default text-muted/80")}
        aria-label="부전승 슬롯"
      >
        <span className="flex h-5 w-5 items-center justify-center rounded-[5px] bg-line text-[10px] font-black text-muted">
          -
        </span>
        <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">
          {byeLabel}
        </span>
        <span
          aria-label="점수 없음"
          className="flex h-[22px] w-[23px] items-center justify-center rounded bg-surface-muted font-black text-muted"
        >
          {score}
        </span>
      </div>
    );
  }

  if (!participant) {
    return (
      <div
        className={rowClassName}
        aria-label={`${slot.placeholderLabel || "빈 슬롯"}, 점수 없음`}
      >
        <span className="flex h-5 w-5 items-center justify-center rounded-[5px] bg-line-strong text-[10px] font-black text-white">
          -
        </span>
        <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">
          {slot.placeholderLabel || "미정"}
        </span>
        <span
          aria-label="점수 없음"
          className="flex h-[22px] w-[23px] items-center justify-center rounded bg-surface-muted font-black text-foreground"
        >
          {score}
        </span>
      </div>
    );
  }

  return (
    <button
      type="button"
      className={cn(
        rowClassName,
        "w-full cursor-default focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-0",
      )}
      aria-label={`${participant.displayName}, ${formatScoreAria(scoreValue)}${
        isWinner ? ", 승자" : ""
      }`}
      onMouseEnter={() => onParticipantEnter(participant.id)}
      onMouseLeave={() => onParticipantLeave(participant.id)}
      onFocus={() => onParticipantEnter(participant.id)}
      onBlur={() => onParticipantLeave(participant.id)}
    >
      <span
        className="flex h-5 w-5 items-center justify-center rounded-[5px] text-[10px] font-black text-white"
        style={{ backgroundColor: participant.color }}
        aria-hidden="true"
      >
        {participant.seedLabel}
      </span>
      <span className="flex min-w-0 items-center overflow-hidden">
        <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">
          {participant.displayName}
        </span>
        {isWinner ? (
          <span
            aria-label="승자"
            className="ml-1 flex h-4 w-4 flex-none items-center justify-center rounded-full border border-success-ink text-[10px] font-black leading-none text-success-ink"
          >
            W
          </span>
        ) : null}
      </span>
      <span
        aria-label={formatScoreAria(scoreValue)}
        className={cn(
          "flex h-[22px] w-[23px] items-center justify-center rounded bg-surface-muted font-black text-foreground",
          isWinner && "bg-accent text-white",
        )}
      >
        {score}
      </span>
    </button>
  );
}

export function TournamentMatchCard({
  match,
  hoveredParticipantId,
  isSelected = false,
  onParticipantEnter,
  onParticipantLeave,
  onSelect,
  previewScores,
  previewWinnerSlotNo,
}: TournamentMatchCardProps) {
  const statusLabel = getMatchStatusLabel(match);
  const showMatchKeyBadge = !isSingleEliminationMatch(match);

  function handleSelect() {
    onSelect?.(match);
  }

  return (
    <article
      data-board-interactive="true"
      role={onSelect ? "button" : undefined}
      tabIndex={onSelect ? 0 : undefined}
      className={cn(
        "grid h-[84px] grid-rows-[23px_1fr_1fr] overflow-hidden rounded-md border bg-surface shadow-[0_10px_24px_rgba(23,33,43,0.08)]",
        roleBorderClassNames[match.matchRole],
        (match.matchRole === "DECIDER" || match.matchRole === "FINAL") &&
          "shadow-[0_0_0_1px_rgba(38,117,80,0.12),0_10px_24px_rgba(23,33,43,0.08)]",
        onSelect &&
          "cursor-pointer transition-transform hover:-translate-y-0.5 hover:border-accent/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
        isSelected && "ring-2 ring-accent ring-offset-2 ring-offset-background",
      )}
      aria-label={`${
        showMatchKeyBadge
          ? `${match.matchKey} ${match.displayName}`
          : match.displayName
      }, Bo${match.bestOf}`}
      onClick={onSelect ? handleSelect : undefined}
      onPointerDown={(event) => {
        event.stopPropagation();
      }}
      onKeyDown={
        onSelect
          ? (event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                handleSelect();
              }
            }
          : undefined
      }
    >
      <div className="flex min-w-0 items-center justify-between gap-1.5 bg-surface-muted px-2 text-[11px] text-muted">
        <span className="flex min-w-0 items-center gap-[5px] font-extrabold text-foreground">
          {showMatchKeyBadge ? (
            <span className="flex h-[18px] min-w-6 flex-none items-center justify-center rounded-full bg-accent-soft px-[5px] text-[10px] font-black text-accent-ink">
              {match.matchKey}
            </span>
          ) : null}
          <span className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">
            {match.displayName}
          </span>
        </span>
        <span className="flex flex-none items-center gap-1">
          <span
            className={cn(
              "rounded-full px-1.5 py-0.5 text-[9px] font-black",
              getMatchStatusClassName(match),
            )}
          >
            {statusLabel}
          </span>
          <span className="whitespace-nowrap text-muted">Bo{match.bestOf}</span>
        </span>
      </div>

      {match.slots.map((slot) => (
        <TournamentPlayerRow
          key={slot.slotNo}
          slot={slot}
          isHighlighted={slot.participant?.id === hoveredParticipantId}
          onParticipantEnter={onParticipantEnter}
          onParticipantLeave={onParticipantLeave}
          previewScore={previewScores?.[slot.slotNo]}
          previewWinnerSlotNo={previewWinnerSlotNo}
        />
      ))}
    </article>
  );
}
