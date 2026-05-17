import Link from "next/link";
import type {
  HomeMainBotAlert,
  HomeMainGalleryPost,
  HomeMainOngoingItem,
  HomeMainResponse,
  HomeMainSchedule,
} from "@/lib/api/home";
import { proleagueDraftLivePath } from "@/lib/proleague-draft/routes";
import { cn } from "@/lib/utils";

const ongoingTypeLabels: Record<string, string> = {
  DRAFT: "드래프트",
  TOURNAMENT: "토너먼트",
};

const statusLabels: Record<string, string> = {
  LIVE: "진행중",
  PAUSED: "일시정지",
};

const scheduleGroupLabels: Record<string, string> = {
  BOT_BRIEFING: "터프봇 브리핑",
  ETC: "기타",
  EVENT: "이벤트",
  NOTICE: "공지",
  PERSONAL: "개인리그",
  PERSONAL_LEAGUE: "개인리그",
  PROLEAGUE: "프로리그",
};

const weekdayLabels = ["일", "월", "화", "수", "목", "금", "토"];

function padDateTimePart(value: number) {
  return String(value).padStart(2, "0");
}

function formatDateTime(value: string | null | undefined) {
  if (!value) {
    return "-";
  }

  const timestamp = Date.parse(value);

  if (Number.isNaN(timestamp)) {
    return value.replace("T", " ").slice(0, 16);
  }

  return new Intl.DateTimeFormat("ko-KR", {
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    month: "numeric",
  }).format(timestamp);
}

function formatScheduleHeaderDateTime(schedule: HomeMainSchedule) {
  const timestamp = Date.parse(schedule.scheduledAt ?? "");

  if (Number.isNaN(timestamp)) {
    return schedule.timeLabel || formatDateTime(schedule.scheduledAt);
  }

  const date = new Date(timestamp);
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const weekday = weekdayLabels[date.getDay()] ?? "";
  const hour = padDateTimePart(date.getHours());
  const minute = padDateTimePart(date.getMinutes());

  return `${month}.${day} ${weekday} ${hour}:${minute}`;
}

function getStatusLabel(status: string) {
  return statusLabels[status] ?? status;
}

function getOngoingTypeLabel(type: string) {
  return ongoingTypeLabels[type] ?? type;
}

function getScheduleGroupLabel(group: string) {
  return scheduleGroupLabels[group] ?? group;
}

function getOngoingHref(item: HomeMainOngoingItem) {
  if (item.type === "DRAFT") {
    return proleagueDraftLivePath(item.id);
  }

  if (item.type === "TOURNAMENT") {
    return `/tournament/${item.id}`;
  }

  return null;
}

function getScheduleHref(schedule: HomeMainSchedule) {
  if (!schedule.targetUrl?.trim()) {
    return null;
  }

  if (schedule.navigationUrl) {
    return schedule.navigationUrl;
  }

  if (schedule.linkType === "REDIRECT") {
    return `/home/schedules/${schedule.id}/redirect`;
  }

  if (schedule.linkType === "DIRECT") {
    return schedule.targetUrl;
  }

  return null;
}

function isInternalHref(href: string) {
  return href.startsWith("/");
}

function SectionTitle({
  eyebrow,
  title,
}: {
  eyebrow?: string;
  title: string;
}) {
  return (
    <div>
      {eyebrow ? (
        <p className="text-xs font-black uppercase tracking-[0.16em] text-accent">
          {eyebrow}
        </p>
      ) : null}
      <h2 className={cn("text-2xl font-black tracking-tight text-foreground", eyebrow && "mt-2")}>
        {title}
      </h2>
    </div>
  );
}

function EmptyState({ children }: { children: string }) {
  return (
    <p className="rounded-lg bg-surface-muted px-4 py-5 text-sm text-muted">
      {children}
    </p>
  );
}

function Chip({ children }: { children: string }) {
  return (
    <span className="inline-flex min-h-8 items-center justify-center rounded-full bg-accent-soft px-3 text-xs font-black text-accent-ink">
      {children}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const isPaused = status === "PAUSED";

  return (
    <span
      className={cn(
        "inline-flex min-h-8 items-center justify-center rounded-full px-3 text-xs font-black",
        isPaused
          ? "bg-warning-soft text-warning-ink"
          : "bg-success-soft text-success-ink",
      )}
    >
      {getStatusLabel(status)}
    </span>
  );
}

function Panel({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-lg border border-line bg-white/95 shadow-[0_14px_44px_rgba(15,23,42,0.06)]",
        className,
      )}
    >
      {children}
    </div>
  );
}

function PanelHead({
  children,
  action,
}: {
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 border-b border-line px-5 py-5 sm:flex-row sm:items-start sm:justify-between">
      {children}
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

function LinkedShell({
  href,
  children,
  className,
}: {
  href: string | null;
  children: React.ReactNode;
  className?: string;
}) {
  if (!href) {
    return <div className={className}>{children}</div>;
  }

  if (isInternalHref(href)) {
    return (
      <Link href={href} className={className}>
        {children}
      </Link>
    );
  }

  return (
    <a href={href} className={className} rel="noreferrer noopener">
      {children}
    </a>
  );
}

function NoticeSection({ schedule }: { schedule: HomeMainSchedule }) {
  const href = getScheduleHref(schedule);

  return (
    <Panel>
      <PanelHead>
        <SectionTitle title="공지" />
      </PanelHead>

      <div className="grid gap-4 px-5 py-5">
        <div className="flex flex-wrap gap-2 font-mono text-xs font-bold text-muted">
          <span>관리자 일정 관리</span>
          <span>{schedule.timeLabel || formatDateTime(schedule.scheduledAt)}</span>
        </div>

        <div className="border-l-[3px] border-accent pl-4">
          <strong className="block text-xl font-black leading-8 text-foreground">
            {schedule.title}
          </strong>
          {schedule.description ? (
            <p className="mt-2 line-clamp-3 text-sm leading-7 text-muted">
              {schedule.description}
            </p>
          ) : null}
        </div>

        {schedule.description ? (
          <details className="rounded-lg border border-line bg-surface-muted">
            <summary className="cursor-pointer list-none px-4 py-3 text-sm font-black text-accent-ink [&::-webkit-details-marker]:hidden">
              상세 공지 내용 보기
            </summary>
            <p className="border-t border-line px-4 py-4 text-sm leading-7 text-muted">
              {schedule.description}
            </p>
          </details>
        ) : null}

        {href ? (
          <LinkedShell
            href={href}
            className="inline-flex min-h-10 w-fit items-center justify-center rounded-full border border-line bg-white px-4 text-sm font-black text-foreground transition-colors hover:border-accent hover:bg-accent-soft"
          >
            공지 바로가기
          </LinkedShell>
        ) : null}
      </div>
    </Panel>
  );
}

function formatMatchFormat(format: string) {
  switch (format) {
    case "1V1":
      return "1:1";
    case "2V2":
      return "2:2";
    case "3V3":
      return "3:3";
    default:
      return format;
  }
}

function getMatchDisplayFormat(match: HomeMainSchedule["matches"][number]) {
  if (
    match.matchFormat === "CUSTOM" &&
    Math.max(match.sideAPlayers.length, match.sideBPlayers.length) === 4
  ) {
    return "4:4";
  }

  return formatMatchFormat(match.matchFormat);
}

function getMatchSetLabel(match: HomeMainSchedule["matches"][number]) {
  const setLabel = match.setLabel.trim();

  if (setLabel && setLabel !== "SET") {
    return setLabel;
  }

  return match.displayOrder > 0 ? `SET ${match.displayOrder}` : "SET";
}

function formatRace(race: string | null | undefined) {
  switch (race) {
    case "TERRAN":
      return "Terran";
    case "ZERG":
      return "Zerg";
    case "PROTOSS":
      return "Protoss";
    case "RANDOM":
      return "Random";
    default:
      return race || null;
  }
}

function MatchPlayerPill({
  player,
}: {
  player: HomeMainSchedule["matches"][number]["sideAPlayers"][number];
}) {
  const race = formatRace(player.playerRace);
  const meta = [player.playerRank, race].filter(Boolean).join(" · ");

  return (
    <span className="inline-flex min-w-0 max-w-full flex-col rounded-lg border border-line bg-white px-3 py-2">
      <span className="truncate text-sm font-black text-foreground">
        {player.playerName || "미정"}
      </span>
      {meta ? (
        <span className="mt-1 truncate text-xs font-bold text-muted">{meta}</span>
      ) : null}
    </span>
  );
}

function MatchSide({
  players,
  title,
}: {
  players: HomeMainSchedule["matches"][number]["sideAPlayers"];
  title: string;
}) {
  const displayPlayers = players.length > 0 ? players : [];

  return (
    <div className="min-w-0 rounded-lg bg-surface-muted px-3 py-3">
      <p className="mb-2 truncate text-xs font-black uppercase tracking-[0.12em] text-accent">
        {title}
      </p>
      {displayPlayers.length === 0 ? (
        <span className="inline-flex min-h-10 items-center rounded-lg border border-line bg-white px-3 text-sm font-semibold text-muted">
          선수 미정
        </span>
      ) : (
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          {displayPlayers.map((player, index) => (
            <span
              key={`${player.id}-${player.side}-${player.slotOrder}-${index}`}
              className="inline-flex min-w-0 items-center gap-2"
            >
              <MatchPlayerPill player={player} />
              {index < displayPlayers.length - 1 ? (
                <span className="font-mono text-sm font-black text-accent">+</span>
              ) : null}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function MatchSetCard({
  match,
}: {
  match: HomeMainSchedule["matches"][number];
}) {
  return (
    <article className="rounded-lg border border-line bg-white px-4 py-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Chip>{getMatchSetLabel(match)}</Chip>
            <span className="rounded-full bg-surface-muted px-3 py-1 text-xs font-black text-muted">
              {getMatchDisplayFormat(match)}
            </span>
            {match.mapName ? (
              <span className="rounded-full bg-[linear-gradient(180deg,#17212b,#0d4f73)] px-3 py-1 text-xs font-black text-white">
                {match.mapName}
              </span>
            ) : null}
          </div>
          {match.note ? (
            <p className="mt-2 line-clamp-2 text-sm leading-6 text-muted">
              {match.note}
            </p>
          ) : null}
        </div>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_32px_minmax(0,1fr)] sm:items-stretch">
        <MatchSide title={match.teamAName || "A"} players={match.sideAPlayers} />
        <div className="grid place-items-center font-mono text-sm font-black text-accent">
          VS
        </div>
        <MatchSide title={match.teamBName || "B"} players={match.sideBPlayers} />
      </div>
    </article>
  );
}

function LeagueScheduleMatchCard({ schedule }: { schedule: HomeMainSchedule }) {
  const href = getScheduleHref(schedule);
  const hasMatches = schedule.matches.length > 0;

  if (!hasMatches) {
    return <ScheduleListItem schedule={schedule} />;
  }

  return (
    <div className="rounded-lg border border-line bg-white/80 px-4 py-4">
      <LinkedShell href={href} className={href ? "block hover:text-accent-ink" : "block"}>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="font-mono text-xs font-bold text-muted">
              {schedule.timeLabel || formatDateTime(schedule.scheduledAt)}
            </p>
            <strong className="mt-1 block truncate text-lg font-black text-foreground">
              {schedule.title}
            </strong>
            {schedule.description ? (
              <p className="mt-1 line-clamp-2 text-sm leading-6 text-muted">
                {schedule.description}
              </p>
            ) : null}
          </div>
          <span className="w-fit rounded-full bg-accent-soft px-3 py-1 text-xs font-black text-accent-ink">
            {schedule.matches.length}세트
          </span>
        </div>
      </LinkedShell>

      <div className="mt-4 grid gap-3 xl:grid-cols-2">
        {schedule.matches
          .slice()
          .sort((left, right) => left.displayOrder - right.displayOrder)
          .map((match) => (
            <MatchSetCard key={match.id || `${schedule.id}-${match.displayOrder}`} match={match} />
          ))}
      </div>
    </div>
  );
}

function OngoingCard({ item }: { item: HomeMainOngoingItem }) {
  const href = getOngoingHref(item);
  const meta = [item.primaryText, item.secondaryText].filter(Boolean).join(" · ");
  const content = (
    <div className="grid min-h-[178px] content-between gap-4 rounded-lg border border-line bg-[radial-gradient(circle_at_92%_0%,rgba(20,108,148,0.12),transparent_12rem),#fff] px-5 py-5 transition hover:-translate-y-px hover:border-accent/50 hover:shadow-[0_14px_36px_rgba(23,33,43,0.08)]">
      <div>
        <div className="flex flex-wrap gap-2">
          <Chip>{getOngoingTypeLabel(item.type)}</Chip>
          <StatusBadge status={item.status} />
        </div>
        <strong className="mt-4 block truncate text-xl font-black leading-7 text-foreground">
          {item.title}
        </strong>
        {meta ? (
          <p className="mt-2 line-clamp-2 text-sm leading-6 text-muted">{meta}</p>
        ) : null}
      </div>
      <p className="font-mono text-xs font-bold text-muted">
        {formatDateTime(item.updatedAt)}
      </p>
    </div>
  );

  return (
    <LinkedShell href={href} className="block h-full">
      {content}
    </LinkedShell>
  );
}

function OngoingSection({ items }: { items: HomeMainOngoingItem[] }) {
  return (
    <Panel>
      <PanelHead action={<Chip>드래프트 · 토너먼트</Chip>}>
        <SectionTitle eyebrow="Live" title="지금 진행 중" />
      </PanelHead>

      <div className="px-5 py-5">
        {items.length === 0 ? (
          <EmptyState>진행 중인 드래프트나 토너먼트가 없습니다.</EmptyState>
        ) : (
          <div className="grid gap-3 xl:grid-cols-2">
            {items.map((item) => (
              <OngoingCard key={`${item.type}-${item.id}`} item={item} />
            ))}
          </div>
        )}
      </div>
    </Panel>
  );
}

function ScheduleListItem({ schedule }: { schedule: HomeMainSchedule }) {
  const href = getScheduleHref(schedule);
  const content = (
    <div
      className={cn(
        "grid gap-3 rounded-lg border border-line bg-white px-4 py-4 transition-colors md:grid-cols-[96px_minmax(0,1fr)_auto] md:items-center",
        href ? "hover:border-accent hover:bg-accent-soft/35" : "cursor-default",
      )}
    >
      <div className="grid min-h-12 place-items-center rounded-lg bg-surface-muted px-3 text-center font-mono text-xs font-black text-accent-ink">
        {schedule.timeLabel || formatDateTime(schedule.scheduledAt)}
      </div>
      <div className="min-w-0">
        <strong className="block truncate text-base font-black text-foreground">
          {schedule.title}
        </strong>
        {schedule.description ? (
          <p className="mt-1 line-clamp-2 text-sm leading-6 text-muted">
            {schedule.description}
          </p>
        ) : null}
      </div>
      <span className="hidden rounded-full bg-surface-muted px-3 py-1 text-xs font-black text-muted md:inline-flex">
        {getScheduleGroupLabel(schedule.scheduleGroup)}
      </span>
    </div>
  );

  return (
    <LinkedShell href={href} className="block">
      {content}
    </LinkedShell>
  );
}

function LeagueScheduleSection({
  schedules,
  title,
}: {
  schedules: HomeMainSchedule[];
  title: string;
}) {
  return (
    <Panel className={title === "프로리그" ? "bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(217,238,247,0.58))]" : undefined}>
      <PanelHead
        action={
          <Chip>
            {schedules.length === 1
              ? formatScheduleHeaderDateTime(schedules[0])
              : `${schedules.length}개`}
          </Chip>
        }
      >
        <SectionTitle title={title} />
      </PanelHead>

      <div className="px-5 py-5">
        <div className="grid gap-3">
          {schedules.map((schedule) => (
            <LeagueScheduleMatchCard key={schedule.id} schedule={schedule} />
          ))}
        </div>
      </div>
    </Panel>
  );
}

function PrimaryContentEmptyState() {
  return (
    <Panel>
      <div className="px-5 py-8 text-center sm:px-8 sm:py-10">
        <strong className="block text-xl font-black text-foreground">
          오늘 표시할 공지/리그 일정이 없습니다.
        </strong>
        <p className="mt-2 text-sm leading-6 text-muted">
          LIVE 드래프트와 토너먼트 영역은 별도로 유지됩니다.
        </p>
      </div>
    </Panel>
  );
}

function BotAlertSection({ alerts }: { alerts: HomeMainBotAlert[] }) {
  const displayAlerts = alerts.slice(0, 3);

  return (
    <Panel>
      <PanelHead>
        <SectionTitle title="터프봇 알림" />
      </PanelHead>

      <div className="grid gap-3 px-5 py-5">
        {displayAlerts.length === 0 ? (
          <EmptyState>오늘 표시할 터프봇 알림이 없습니다.</EmptyState>
        ) : (
          displayAlerts.map((alert, index) => (
            <article
              key={`${alert.type}-${alert.sourceId ?? index}`}
              className="rounded-lg border border-line bg-white px-4 py-4"
            >
              <strong className="block text-sm font-black text-foreground">
                {alert.type}
              </strong>
              <p className="mt-1 line-clamp-3 text-sm leading-6 text-muted">
                {alert.message}
              </p>
            </article>
          ))
        )}
      </div>
    </Panel>
  );
}

function GalleryPostRow({ post }: { post: HomeMainGalleryPost }) {
  return (
    <Link
      href={`/gallery/${post.id}`}
      className="block rounded-lg border border-line bg-white px-4 py-4 transition-colors hover:border-accent hover:bg-accent-soft/35"
    >
      <p className="truncate text-base font-black text-foreground">
        {post.title}
      </p>
      {post.summaryText ? (
        <p className="mt-2 line-clamp-2 text-sm leading-6 text-muted">
          {post.summaryText}
        </p>
      ) : null}
      <div className="mt-3 flex flex-wrap items-center gap-2 font-mono text-xs font-bold text-muted">
        <span>{post.authorUserId?.trim() || "익명"}</span>
        <span>{formatDateTime(post.regDate)}</span>
      </div>
    </Link>
  );
}

function GallerySection({ posts }: { posts: HomeMainGalleryPost[] }) {
  return (
    <Panel>
      <PanelHead
        action={
          <Link
            href="/gallery"
            className="inline-flex min-h-10 items-center justify-center rounded-full border border-line bg-white px-4 text-sm font-black text-foreground transition-colors hover:border-accent hover:bg-accent-soft"
          >
            전체 보기
          </Link>
        }
      >
        <SectionTitle title="최근 갤러리" />
      </PanelHead>

      <div className="grid gap-3 px-5 py-5">
        {posts.length === 0 ? (
          <EmptyState>최근 갤러리 글이 없습니다.</EmptyState>
        ) : (
          posts.map((post) => <GalleryPostRow key={post.id} post={post} />)
        )}
      </div>
    </Panel>
  );
}

export function HomeMainDashboard({
  data,
  error,
}: {
  data: HomeMainResponse;
  error?: string | null;
}) {
  const notice = data.notice;
  const proleagueSchedules = data.proleagueSchedules;
  const personalLeagueSchedules = data.personalLeagueSchedules;
  const hasNotice = notice !== null;
  const hasProleague = proleagueSchedules.length > 0;
  const hasPersonalLeague = personalLeagueSchedules.length > 0;
  const hasLeague = hasProleague || hasPersonalLeague;
  const hasPrimaryContent = hasNotice || hasLeague;

  return (
    <div aria-label="메인 화면" className="space-y-4">
      {error ? (
        <div className="rounded-lg border border-danger-ink/15 bg-danger-soft px-4 py-3 text-sm text-danger-ink">
          {error}
        </div>
      ) : null}

      <section
        className="overflow-hidden rounded-lg border border-line bg-[radial-gradient(circle_at_84%_8%,rgba(20,108,148,0.22),transparent_26rem),linear-gradient(135deg,#ffffff,#d9eef7)] p-4 shadow-[0_18px_56px_rgba(23,33,43,0.10)] sm:p-5"
        aria-label="라이브 메인"
      >
        <div className="grid gap-4">
          {hasPrimaryContent ? (
            <div
              className={cn(
                "grid gap-4",
                hasNotice && hasLeague && "lg:grid-cols-[0.72fr_1.28fr]",
                hasNotice && !hasLeague && "mx-auto w-full max-w-[920px]",
              )}
            >
              {hasNotice ? <NoticeSection schedule={notice} /> : null}
              {hasLeague ? (
                <div className="grid gap-4">
                  {hasProleague ? (
                    <LeagueScheduleSection
                      title="프로리그"
                      schedules={proleagueSchedules}
                    />
                  ) : null}
                  {hasPersonalLeague ? (
                    <LeagueScheduleSection
                      title="개인리그"
                      schedules={personalLeagueSchedules}
                    />
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : (
            <PrimaryContentEmptyState />
          )}
          <OngoingSection items={data.ongoing} />
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-[0.72fr_1.28fr]">
        <BotAlertSection alerts={data.botAlerts} />
        <GallerySection posts={data.galleryPosts} />
      </div>
    </div>
  );
}
