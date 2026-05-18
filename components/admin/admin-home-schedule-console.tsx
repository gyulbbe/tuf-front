"use client";

import { type FormEvent, useEffect, useMemo, useState } from "react";
import {
  createAdminHomeSchedule,
  deleteAdminHomeSchedules,
  listAdminHomeSchedules,
  updateAdminHomeSchedule,
  type AdminHomeSchedule,
  type AdminHomeSchedulePage,
  type AdminHomeScheduleRequest,
  type HomeScheduleGroup,
  type HomeScheduleLinkType,
  type HomeScheduleStatus,
} from "@/lib/api/home-schedule";
import { SurfaceCard } from "@/components/site/surface-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  createMatchPayload,
  createMatchStateFromScheduleMatch,
  HomeScheduleMatchEditor,
  type MatchFormState,
} from "@/components/admin/home-schedule-match-editor";
import { cn } from "@/lib/utils";

type NoticeTone = "error" | "success";

type NoticeState = {
  tone: NoticeTone;
  text: string;
};

type ScheduleFormState = {
  scheduleGroup: HomeScheduleGroup;
  title: string;
  description: string;
  date: string;
  time: string;
  targetUrl: string;
  linkType: HomeScheduleLinkType;
  displayPriority: string;
  representativeTeamAName: string;
  representativeTeamBName: string;
  matches: MatchFormState[];
};

const PAGE_SIZE = 20;

const groupOptions: Array<{ label: string; value: HomeScheduleGroup }> = [
  { value: "PROLEAGUE", label: "프로리그" },
  { value: "PERSONAL_LEAGUE", label: "개인리그" },
  { value: "NOTICE", label: "공지" },
  { value: "BOT_BRIEFING", label: "터프봇 브리핑" },
  { value: "ETC", label: "기타" },
];

const linkTypeOptions: Array<{ label: string; value: HomeScheduleLinkType }> = [
  { value: "DIRECT", label: "바로 이동" },
  { value: "REDIRECT", label: "리다이렉트" },
];

const statusLabels: Record<HomeScheduleStatus, string> = {
  UPCOMING: "예정",
  EXPIRED: "지난 일정",
};

const emptyFormState: ScheduleFormState = {
  scheduleGroup: "PROLEAGUE",
  title: "",
  description: "",
  date: "",
  time: "",
  targetUrl: "",
  linkType: "DIRECT",
  displayPriority: "0",
  representativeTeamAName: "",
  representativeTeamBName: "",
  matches: [],
};

const selectClassName =
  "w-full rounded-lg border border-line-strong bg-surface-strong px-4 py-3 text-sm text-foreground outline-none transition-colors focus:border-accent focus:bg-white disabled:cursor-not-allowed disabled:opacity-70";

function padDatePart(value: number) {
  return String(value).padStart(2, "0");
}

const timeHourOptions = Array.from({ length: 24 }, (_, hour) => padDatePart(hour));
const timeMinuteOptions = ["00", "10", "20", "30", "40", "50"];

function formatInputDate(value: Date) {
  return [
    value.getFullYear(),
    padDatePart(value.getMonth() + 1),
    padDatePart(value.getDate()),
  ].join("-");
}

function formatInputTime(value: Date) {
  return [padDatePart(value.getHours()), padDatePart(value.getMinutes())].join(":");
}

function splitInputTime(value: string) {
  const [hour = "", minute = ""] = value.split(":");

  return {
    hour: /^\d{2}$/.test(hour) ? hour : "",
    minute: /^\d{2}$/.test(minute) ? minute : "",
  };
}

function updateInputTimePart(
  currentTime: string,
  part: "hour" | "minute",
  value: string,
) {
  const { hour, minute } = splitInputTime(currentTime);

  return [
    part === "hour" ? value : hour || "00",
    part === "minute" ? value : minute || "00",
  ].join(":");
}

function getDefaultScheduledDateTime(now = new Date()) {
  const rounded = new Date(now);
  rounded.setSeconds(0, 0);

  const minuteRemainder = rounded.getMinutes() % 10;

  if (minuteRemainder > 0) {
    rounded.setMinutes(rounded.getMinutes() + (10 - minuteRemainder));
  } else if (now.getSeconds() > 0 || now.getMilliseconds() > 0) {
    rounded.setMinutes(rounded.getMinutes() + 10);
  }

  return {
    date: formatInputDate(rounded),
    time: formatInputTime(rounded),
  };
}

function createInitialFormState(): ScheduleFormState {
  const { date, time } = getDefaultScheduledDateTime();

  return {
    ...emptyFormState,
    date,
    matches: [],
    time,
  };
}

function createEmptyPage(page = 0): AdminHomeSchedulePage {
  return {
    items: [],
    page,
    size: PAGE_SIZE,
    totalElements: 0,
    totalPages: 0,
    hasNext: false,
    hasPrevious: page > 0,
  };
}

function readErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return "요청을 처리하지 못했습니다. 잠시 후 다시 시도해주세요.";
}

function getGroupLabel(value: HomeScheduleGroup) {
  return groupOptions.find((option) => option.value === value)?.label ?? "기타";
}

function getLinkTypeLabel(value: HomeScheduleLinkType) {
  return linkTypeOptions.find((option) => option.value === value)?.label ?? "바로 이동";
}

function getNoticeClassName(tone: NoticeTone) {
  return tone === "error"
    ? "border border-danger-ink/15 bg-danger-soft text-danger-ink"
    : "border border-success-ink/15 bg-success-soft text-success-ink";
}

function getStatusClassName(status: HomeScheduleStatus) {
  return status === "EXPIRED"
    ? "bg-surface-muted text-muted"
    : "bg-success-soft text-success-ink";
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
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(timestamp);
}

function splitScheduledAt(value: string) {
  const [datePart = "", timePart = ""] = value.split("T");

  return {
    date: datePart.slice(0, 10),
    time: timePart.slice(0, 5),
  };
}

function createFormStateFromSchedule(schedule: AdminHomeSchedule): ScheduleFormState {
  const { date, time } = splitScheduledAt(schedule.scheduledAt);
  const matches = schedule.matches
    .slice()
    .sort((left, right) => left.displayOrder - right.displayOrder)
    .map((match, index) => ({
      ...createMatchStateFromScheduleMatch(match),
      displayOrder: index + 1,
    }));
  const firstMatch = matches[0] ?? null;

  return {
    scheduleGroup: schedule.scheduleGroup,
    title: schedule.title,
    description: schedule.description ?? "",
    date,
    time,
    targetUrl: schedule.targetUrl ?? "",
    linkType: schedule.linkType,
    displayPriority: String(schedule.displayPriority),
    representativeTeamAName: firstMatch?.teamAName ?? "",
    representativeTeamBName: firstMatch?.teamBName ?? "",
    matches,
  };
}

function createPayload(form: ScheduleFormState): AdminHomeScheduleRequest {
  const priority = Number.parseInt(form.displayPriority, 10);

  return {
    scheduleGroup: form.scheduleGroup,
    title: form.title.trim(),
    description: form.description.trim(),
    scheduledAt: `${form.date}T${form.time}:00`,
    targetUrl: form.targetUrl.trim() || null,
    linkType: form.linkType,
    displayPriority: Number.isFinite(priority) ? priority : 0,
    matches: form.matches.map((match, index) =>
      createMatchPayload(match, index + 1, {
        forceSingleMatch: form.scheduleGroup === "PERSONAL_LEAGUE",
        teamAName:
          form.scheduleGroup === "PROLEAGUE"
            ? form.representativeTeamAName
            : match.teamAName,
        teamBName:
          form.scheduleGroup === "PROLEAGUE"
            ? form.representativeTeamBName
            : match.teamBName,
      }),
    ),
  };
}

function validateForm(form: ScheduleFormState) {
  if (!form.title.trim()) {
    return "제목을 입력해주세요.";
  }

  if (!form.scheduleGroup) {
    return "일정 그룹을 선택해주세요.";
  }

  if (!form.date) {
    return "날짜를 선택해주세요.";
  }

  if (!form.time) {
    return "시간을 선택해주세요.";
  }

  if (!form.linkType) {
    return "이동 방식을 선택해주세요.";
  }

  return null;
}

function SchedulePreview({ form }: { form: ScheduleFormState }) {
  const title = form.title.trim() || "일정 제목";
  const description = form.description.trim() || "일정 설명";
  const timeLabel =
    form.date && form.time ? formatDateTime(`${form.date}T${form.time}:00`) : "시간 미정";

  return (
    <div className="rounded-lg border border-line bg-surface-strong p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-accent-soft px-3 py-1 text-xs font-semibold text-accent-ink">
          {getGroupLabel(form.scheduleGroup)}
        </span>
        <span className="rounded-full bg-surface-muted px-3 py-1 text-xs font-semibold text-muted">
          {getLinkTypeLabel(form.linkType)}
        </span>
        <span className="rounded-full bg-surface-muted px-3 py-1 text-xs font-semibold text-muted">
          우선순위 {form.displayPriority.trim() || "0"}
        </span>
        <span className="rounded-full bg-surface-muted px-3 py-1 text-xs font-semibold text-muted">
          세트 {form.matches.length}
        </span>
      </div>
      <p className="mt-4 text-sm font-semibold text-muted">{timeLabel}</p>
      <p className="mt-2 truncate text-lg font-semibold text-foreground">{title}</p>
      <p className="mt-2 line-clamp-2 text-sm leading-6 text-muted">{description}</p>
    </div>
  );
}

export function AdminHomeScheduleConsole() {
  const [schedulePage, setSchedulePage] = useState<AdminHomeSchedulePage>(() =>
    createEmptyPage(),
  );
  const [page, setPage] = useState(0);
  const [searchInput, setSearchInput] = useState("");
  const [keyword, setKeyword] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [scheduleGroupFilter, setScheduleGroupFilter] = useState<
    HomeScheduleGroup | ""
  >("");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(() => new Set());
  const [editingScheduleId, setEditingScheduleId] = useState<number | null>(null);
  const [form, setForm] = useState<ScheduleFormState>(() => createInitialFormState());
  const [reloadKey, setReloadKey] = useState(0);
  const [notice, setNotice] = useState<NoticeState | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [deletingSelected, setDeletingSelected] = useState(false);

  const schedules = schedulePage.items;
  const hasSchedules = schedules.length > 0;
  const selectedCount = selectedIds.size;
  const currentPageLabel = schedulePage.totalPages > 0 ? schedulePage.page + 1 : 0;
  const allCurrentSelected =
    hasSchedules && schedules.every((schedule) => selectedIds.has(schedule.id));
  const selectedTime = splitInputTime(form.time);
  const minuteSelectOptions =
    selectedTime.minute && !timeMinuteOptions.includes(selectedTime.minute)
      ? [selectedTime.minute, ...timeMinuteOptions]
      : timeMinuteOptions;

  const editingSchedule = useMemo(
    () => schedules.find((schedule) => schedule.id === editingScheduleId) ?? null,
    [editingScheduleId, schedules],
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setKeyword(searchInput.trim());
      setPage(0);
    }, 300);

    return () => window.clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    let cancelled = false;

    async function loadSchedules() {
      setLoading(true);

      try {
        const nextPage = await listAdminHomeSchedules({
          page,
          size: PAGE_SIZE,
          keyword,
          fromDate,
          toDate,
          scheduleGroup: scheduleGroupFilter || null,
        });

        if (!cancelled) {
          setSchedulePage(nextPage);
          setSelectedIds(new Set());
        }
      } catch (error) {
        if (!cancelled) {
          setSchedulePage(createEmptyPage(page));
          setSelectedIds(new Set());
          setNotice({
            tone: "error",
            text: readErrorMessage(error),
          });
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadSchedules();

    return () => {
      cancelled = true;
    };
  }, [fromDate, keyword, page, reloadKey, scheduleGroupFilter, toDate]);

  function requestReloadAfterDelete(scheduleIds: number[]) {
    const deletedCurrentPage =
      schedules.length > 0 &&
      schedules.every((schedule) => scheduleIds.includes(schedule.id));

    if (deletedCurrentPage && page > 0) {
      setPage((current) => Math.max(0, current - 1));
      return;
    }

    setReloadKey((current) => current + 1);
  }

  function resetForm() {
    setEditingScheduleId(null);
    setForm(createInitialFormState());
  }

  function updateForm<K extends keyof ScheduleFormState>(
    key: K,
    value: ScheduleFormState[K],
  ) {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validationMessage = validateForm(form);

    if (validationMessage) {
      setNotice({ tone: "error", text: validationMessage });
      return;
    }

    setSaving(true);
    setNotice(null);

    try {
      const payload = createPayload(form);

      if (editingScheduleId === null) {
        await createAdminHomeSchedule(payload);
        setNotice({ tone: "success", text: "일정이 등록되었습니다." });
      } else {
        await updateAdminHomeSchedule(editingScheduleId, payload);
        setNotice({ tone: "success", text: "일정이 수정되었습니다." });
      }

      resetForm();
      setSelectedIds(new Set());

      if (page !== 0) {
        setPage(0);
      } else {
        setReloadKey((current) => current + 1);
      }
    } catch (error) {
      setNotice({ tone: "error", text: readErrorMessage(error) });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(scheduleIds: number[], successText: string) {
    if (scheduleIds.length === 0) {
      return;
    }

    try {
      await deleteAdminHomeSchedules(scheduleIds);
      setNotice({ tone: "success", text: successText });
      setSelectedIds(new Set());

      if (editingScheduleId !== null && scheduleIds.includes(editingScheduleId)) {
        resetForm();
      }

      requestReloadAfterDelete(scheduleIds);
    } catch (error) {
      setNotice({ tone: "error", text: readErrorMessage(error) });
    }
  }

  function handleToggleSelected(scheduleId: number) {
    setSelectedIds((current) => {
      const next = new Set(current);

      if (next.has(scheduleId)) {
        next.delete(scheduleId);
      } else {
        next.add(scheduleId);
      }

      return next;
    });
  }

  function handleToggleAllCurrent() {
    setSelectedIds((current) => {
      const next = new Set(current);

      if (allCurrentSelected) {
        schedules.forEach((schedule) => next.delete(schedule.id));
      } else {
        schedules.forEach((schedule) => next.add(schedule.id));
      }

      return next;
    });
  }

  function handleEdit(schedule: AdminHomeSchedule) {
    setNotice(null);
    setEditingScheduleId(schedule.id);
    setForm(createFormStateFromSchedule(schedule));
  }

  async function handleSingleDelete(scheduleId: number) {
    setDeletingId(scheduleId);
    await handleDelete([scheduleId], "삭제되었습니다.");
    setDeletingId(null);
  }

  async function handleSelectedDelete() {
    const ids = Array.from(selectedIds);

    setDeletingSelected(true);
    await handleDelete(ids, "선택한 일정이 삭제되었습니다.");
    setDeletingSelected(false);
  }

  return (
    <div className="space-y-4">
      <SurfaceCard className="p-7 sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-accent">
          Admin Schedule
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          일정 관리
        </h1>
      </SurfaceCard>

      {notice ? (
        <div className={cn("rounded-lg px-4 py-3 text-sm", getNoticeClassName(notice.tone))}>
          {notice.text}
        </div>
      ) : null}

      <div className="grid gap-4 2xl:grid-cols-[minmax(0,1fr)_minmax(620px,0.76fr)]">
        <div className="space-y-4">
          <SurfaceCard className="space-y-4 p-5 sm:p-6">
            <Input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="일정 설명 검색"
            />
            <div className="grid gap-3 md:grid-cols-3">
              <label className="grid gap-2 text-sm font-semibold text-foreground">
                시작일
                <Input
                  type="date"
                  value={fromDate}
                  onChange={(event) => {
                    setFromDate(event.target.value);
                    setPage(0);
                  }}
                />
              </label>
              <label className="grid gap-2 text-sm font-semibold text-foreground">
                종료일
                <Input
                  type="date"
                  value={toDate}
                  onChange={(event) => {
                    setToDate(event.target.value);
                    setPage(0);
                  }}
                />
              </label>
              <label className="grid gap-2 text-sm font-semibold text-foreground">
                일정 그룹
                <select
                  className={selectClassName}
                  value={scheduleGroupFilter}
                  onChange={(event) => {
                    setScheduleGroupFilter(event.target.value as HomeScheduleGroup | "");
                    setPage(0);
                  }}
                >
                  <option value="">전체</option>
                  {groupOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </SurfaceCard>

          <SurfaceCard className="overflow-hidden p-0">
            <div className="flex flex-col gap-3 border-b border-line px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm font-semibold text-muted">
                {selectedCount > 0
                  ? `${selectedCount}개 선택됨`
                  : `총 ${schedulePage.totalElements}개`}
              </p>
              <Button
                variant="danger"
                disabled={selectedCount === 0 || deletingSelected}
                onClick={handleSelectedDelete}
              >
                {deletingSelected ? "삭제 중" : "선택 삭제"}
              </Button>
            </div>

            <div className="overflow-x-auto">
              <div className="min-w-[1180px]">
                <div className="grid grid-cols-[48px_120px_120px_minmax(150px,1fr)_minmax(200px,1.2fr)_120px_minmax(170px,1fr)_90px_110px_150px] gap-3 bg-surface-muted px-5 py-3 text-xs font-semibold text-muted">
                  <label className="flex items-center justify-center">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-line-strong text-accent focus:ring-accent"
                      checked={allCurrentSelected}
                      disabled={!hasSchedules}
                      onChange={handleToggleAllCurrent}
                      aria-label="현재 페이지 전체 선택"
                    />
                  </label>
                  <span>시간</span>
                  <span>그룹</span>
                  <span>제목</span>
                  <span>설명</span>
                  <span>이동 방식</span>
                  <span>이동 URL</span>
                  <span>우선순위</span>
                  <span>상태</span>
                  <span className="text-right">관리</span>
                </div>

                {loading ? (
                  <p className="px-5 py-8 text-center text-sm text-muted">
                    일정 목록을 불러오는 중입니다.
                  </p>
                ) : schedules.length === 0 ? (
                  <p className="px-5 py-8 text-center text-sm text-muted">
                    등록된 일정이 없습니다.
                  </p>
                ) : (
                  schedules.map((schedule) => (
                    <div
                      key={schedule.id}
                      role="button"
                      tabIndex={0}
                      aria-label={`${schedule.title} 수정`}
                      onClick={() => handleEdit(schedule)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          handleEdit(schedule);
                        }
                      }}
                      className={cn(
                        "grid cursor-pointer grid-cols-[48px_120px_120px_minmax(150px,1fr)_minmax(200px,1.2fr)_120px_minmax(170px,1fr)_90px_110px_150px] gap-3 border-t border-line px-5 py-4 text-sm transition-colors first:border-t-0 hover:bg-accent-soft/25 focus-visible:bg-accent-soft/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent",
                        editingScheduleId === schedule.id && "bg-accent-soft/40",
                      )}
                    >
                      <label
                        className="flex items-center justify-center"
                        onClick={(event) => event.stopPropagation()}
                        onKeyDown={(event) => event.stopPropagation()}
                      >
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-line-strong text-accent focus:ring-accent"
                          checked={selectedIds.has(schedule.id)}
                          onChange={() => handleToggleSelected(schedule.id)}
                          aria-label={`${schedule.title} 선택`}
                        />
                      </label>
                      <span className="text-muted">{formatDateTime(schedule.scheduledAt)}</span>
                      <span className="font-semibold text-foreground">
                        {getGroupLabel(schedule.scheduleGroup)}
                      </span>
                      <span className="truncate font-semibold text-foreground">
                        {schedule.title}
                      </span>
                      <span className="truncate text-muted">
                        {schedule.description || "-"}
                      </span>
                      <span className="text-muted">
                        {getLinkTypeLabel(schedule.linkType)}
                      </span>
                      <span className="truncate text-muted">{schedule.targetUrl || "-"}</span>
                      <span className="text-muted">{schedule.displayPriority}</span>
                      <span>
                        <span
                          className={cn(
                            "rounded-full px-3 py-1 text-xs font-semibold",
                            getStatusClassName(schedule.status),
                          )}
                        >
                          {statusLabels[schedule.status]}
                        </span>
                      </span>
                      <span
                        className="flex justify-end gap-2"
                        onClick={(event) => event.stopPropagation()}
                        onKeyDown={(event) => event.stopPropagation()}
                      >
                        <Button
                          size="sm"
                          onClick={(event) => {
                            event.stopPropagation();
                            handleEdit(schedule);
                          }}
                        >
                          수정
                        </Button>
                        <Button
                          size="sm"
                          variant="danger"
                          disabled={deletingId === schedule.id}
                          onClick={(event) => {
                            event.stopPropagation();
                            void handleSingleDelete(schedule.id);
                          }}
                        >
                          {deletingId === schedule.id ? "삭제 중" : "삭제"}
                        </Button>
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="flex flex-col gap-3 border-t border-line px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex gap-2">
                <Button
                  disabled={loading || !schedulePage.hasPrevious}
                  onClick={() => setPage((current) => Math.max(0, current - 1))}
                >
                  이전
                </Button>
                <Button
                  disabled={loading || !schedulePage.hasNext}
                  onClick={() => setPage((current) => current + 1)}
                >
                  다음
                </Button>
              </div>
              <p className="text-sm text-muted">
                {currentPageLabel} / {schedulePage.totalPages} 페이지 · 총{" "}
                {schedulePage.totalElements}개
              </p>
            </div>
          </SurfaceCard>
        </div>

        <SurfaceCard className="space-y-5 p-5 sm:p-6 2xl:sticky 2xl:top-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">
                {editingScheduleId === null ? "Create" : "Edit"}
              </p>
              <h2 className="mt-2 text-2xl font-semibold text-foreground">
                {editingScheduleId === null ? "일정 등록" : "일정 수정"}
              </h2>
            </div>
            <Button onClick={resetForm}>처음부터</Button>
          </div>

          {editingScheduleId !== null && !editingSchedule ? (
            <p className="rounded-lg border border-line bg-surface-muted px-4 py-3 text-sm text-muted">
              수정 중인 일정이 현재 페이지에 없습니다. 입력값은 유지됩니다.
            </p>
          ) : null}

          <form className="space-y-4" onSubmit={handleSubmit}>
            <label className="grid gap-2 text-sm font-semibold text-foreground">
              일정 그룹
              <select
                className={selectClassName}
                value={form.scheduleGroup}
                onChange={(event) =>
                  updateForm("scheduleGroup", event.target.value as HomeScheduleGroup)
                }
              >
                {groupOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="grid gap-2 text-sm font-semibold text-foreground">
              제목
              <Input
                value={form.title}
                onChange={(event) => updateForm("title", event.target.value)}
                placeholder="예: 5월 프로리그"
              />
            </label>

            <label className="grid gap-2 text-sm font-semibold text-foreground">
              설명
              <Textarea
                value={form.description}
                onChange={(event) => updateForm("description", event.target.value)}
                placeholder="메인 일정 카드에 표시할 설명"
                rows={4}
              />
            </label>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="grid gap-2 text-sm font-semibold text-foreground">
                날짜
                <Input
                  type="date"
                  value={form.date}
                  onChange={(event) => updateForm("date", event.target.value)}
                />
              </label>
              <label className="grid gap-2 text-sm font-semibold text-foreground">
                시간
                <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-2">
                  <select
                    className={selectClassName}
                    value={selectedTime.hour}
                    onChange={(event) =>
                      updateForm(
                        "time",
                        updateInputTimePart(form.time, "hour", event.target.value),
                      )
                    }
                    aria-label="시간"
                  >
                    {timeHourOptions.map((hour) => (
                      <option key={hour} value={hour}>
                        {hour}시
                      </option>
                    ))}
                  </select>
                  <select
                    className={selectClassName}
                    value={selectedTime.minute}
                    onChange={(event) =>
                      updateForm(
                        "time",
                        updateInputTimePart(form.time, "minute", event.target.value),
                      )
                    }
                    aria-label="분"
                  >
                    {minuteSelectOptions.map((minute) => (
                      <option key={minute} value={minute}>
                        {minute}
                        {timeMinuteOptions.includes(minute) ? "분" : "분 (기존)"}
                      </option>
                    ))}
                  </select>
                </div>
              </label>
            </div>

            <label className="grid gap-2 text-sm font-semibold text-foreground">
              이동 URL
              <Input
                value={form.targetUrl}
                onChange={(event) => updateForm("targetUrl", event.target.value)}
                placeholder="https://... 또는 /..."
              />
            </label>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="grid gap-2 text-sm font-semibold text-foreground">
                이동 방식
                <select
                  className={selectClassName}
                  value={form.linkType}
                  onChange={(event) =>
                    updateForm("linkType", event.target.value as HomeScheduleLinkType)
                  }
                >
                  {linkTypeOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-2 text-sm font-semibold text-foreground">
                우선순위
                <Input
                  type="number"
                  value={form.displayPriority}
                  onChange={(event) => updateForm("displayPriority", event.target.value)}
                  placeholder="0"
                />
              </label>
            </div>

            <HomeScheduleMatchEditor
              matches={form.matches}
              onChange={(matches) => updateForm("matches", matches)}
              onRepresentativeTeamANameChange={(value) =>
                updateForm("representativeTeamAName", value)
              }
              onRepresentativeTeamBNameChange={(value) =>
                updateForm("representativeTeamBName", value)
              }
              representativeTeamAName={form.representativeTeamAName}
              representativeTeamBName={form.representativeTeamBName}
              scheduleGroup={form.scheduleGroup}
            />

            <div className="rounded-lg border border-line bg-surface-muted px-4 py-3 text-sm leading-6 text-muted">
              같은 그룹에 여러 미래 일정이 있으면 우선순위가 가장 높은 1개만
              메인에 노출됩니다.
            </div>

            <Button type="submit" variant="accent" fullWidth disabled={saving}>
              {saving
                ? "저장 중"
                : editingScheduleId === null
                  ? "등록"
                  : "수정 완료"}
            </Button>
          </form>

          <div className="space-y-3 border-t border-line pt-5">
            <h3 className="text-lg font-semibold text-foreground">현재 입력값 미리보기</h3>
            <SchedulePreview form={form} />
            <p className="text-sm leading-6 text-muted">
              지난 일정은 자동으로 메인에서 빠지고, 같은 그룹에서는 우선순위가
              가장 높은 일정 1개만 노출됩니다.
            </p>
          </div>
        </SurfaceCard>
      </div>
    </div>
  );
}
