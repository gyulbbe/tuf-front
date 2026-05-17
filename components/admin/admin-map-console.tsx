"use client";

import { type CSSProperties, type FormEvent, useEffect, useState } from "react";
import { SurfaceCard } from "@/components/site/surface-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  createAdminMap,
  deleteAdminMap,
  listAdminMaps,
  updateAdminMap,
  type AdminMap,
  type AdminMapPage,
  type AdminMapRequest,
} from "@/lib/api/maps";
import { cn } from "@/lib/utils";

type NoticeTone = "error" | "success";

type NoticeState = {
  tone: NoticeTone;
  text: string;
};

type MapFormState = {
  mapName: string;
  image: string;
};

const PAGE_SIZE = 20;

const initialFormState: MapFormState = {
  mapName: "",
  image: "",
};

function createEmptyPage(page = 0): AdminMapPage {
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

function getNoticeClassName(tone: NoticeTone) {
  return tone === "error"
    ? "border border-danger-ink/15 bg-danger-soft text-danger-ink"
    : "border border-success-ink/15 bg-success-soft text-success-ink";
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

function createImagePreviewStyle(imageUrl: string): CSSProperties {
  const safeImageUrl = imageUrl.replace(/["\\\n\r]/g, "");

  return {
    backgroundImage: `url("${safeImageUrl}")`,
  };
}

function createPayload(form: MapFormState): AdminMapRequest {
  return {
    mapName: form.mapName.trim(),
    image: form.image.trim() || null,
  };
}

function validateForm(form: MapFormState) {
  if (!form.mapName.trim()) {
    return "맵명을 입력해주세요.";
  }

  return null;
}

export function AdminMapConsole() {
  const [mapPage, setMapPage] = useState<AdminMapPage>(() => createEmptyPage());
  const [page, setPage] = useState(0);
  const [searchInput, setSearchInput] = useState("");
  const [keyword, setKeyword] = useState("");
  const [form, setForm] = useState<MapFormState>(initialFormState);
  const [editingMapId, setEditingMapId] = useState<number | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [notice, setNotice] = useState<NoticeState | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setKeyword(searchInput.trim());
      setPage(0);
    }, 300);

    return () => window.clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    let cancelled = false;

    async function loadMaps() {
      setLoading(true);

      try {
        const nextPage = await listAdminMaps({
          keyword,
          page,
          size: PAGE_SIZE,
        });

        if (!cancelled) {
          setMapPage(nextPage);
        }
      } catch (error) {
        if (!cancelled) {
          setMapPage(createEmptyPage(page));
          setNotice({ tone: "error", text: readErrorMessage(error) });
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadMaps();

    return () => {
      cancelled = true;
    };
  }, [keyword, page, reloadKey]);

  function resetForm() {
    setEditingMapId(null);
    setForm(initialFormState);
  }

  function updateForm<K extends keyof MapFormState>(key: K, value: MapFormState[K]) {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function handleEdit(map: AdminMap) {
    setNotice(null);
    setEditingMapId(map.id);
    setForm({
      mapName: map.mapName,
      image: map.image ?? "",
    });
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

      if (editingMapId === null) {
        await createAdminMap(payload);
        setNotice({ tone: "success", text: "맵을 추가했습니다." });
      } else {
        await updateAdminMap(editingMapId, payload);
        setNotice({ tone: "success", text: "맵을 수정했습니다." });
      }

      resetForm();

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

  async function handleDelete(map: AdminMap) {
    if (!window.confirm(`${map.mapName} 맵을 삭제할까요?`)) {
      return;
    }

    setDeletingId(map.id);
    setNotice(null);

    try {
      await deleteAdminMap(map.id);
      setNotice({ tone: "success", text: "맵을 삭제했습니다." });

      if (editingMapId === map.id) {
        resetForm();
      }

      if (mapPage.items.length === 1 && page > 0) {
        setPage((current) => Math.max(0, current - 1));
      } else {
        setReloadKey((current) => current + 1);
      }
    } catch (error) {
      setNotice({ tone: "error", text: readErrorMessage(error) });
    } finally {
      setDeletingId(null);
    }
  }

  const currentPageLabel = mapPage.totalPages > 0 ? mapPage.page + 1 : 0;

  return (
    <div className="space-y-4">
      <SurfaceCard className="p-7 sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-accent">
          Admin Maps
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          맵 관리
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-8 text-muted">
          일정 세트 대진에서 선택할 스타크래프트 맵을 추가하고 수정합니다.
        </p>
      </SurfaceCard>

      {notice ? (
        <div className={cn("rounded-lg px-4 py-3 text-sm", getNoticeClassName(notice.tone))}>
          {notice.text}
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="space-y-4">
          <SurfaceCard className="p-5 sm:p-6">
            <Input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="맵명 검색"
            />
          </SurfaceCard>

          <SurfaceCard className="overflow-hidden p-0">
            <div className="flex flex-col gap-3 border-b border-line px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm font-semibold text-muted">
                총 {mapPage.totalElements}개
              </p>
            </div>

            <div className="overflow-x-auto">
              <div className="min-w-[860px]">
                <div className="grid grid-cols-[88px_minmax(180px,1fr)_minmax(220px,1.2fr)_150px_140px] gap-3 bg-surface-muted px-5 py-3 text-xs font-semibold text-muted">
                  <span>미리보기</span>
                  <span>맵명</span>
                  <span>이미지 URL</span>
                  <span>수정일</span>
                  <span className="text-right">관리</span>
                </div>

                {loading ? (
                  <p className="px-5 py-8 text-center text-sm text-muted">
                    맵 목록을 불러오는 중입니다.
                  </p>
                ) : mapPage.items.length === 0 ? (
                  <p className="px-5 py-8 text-center text-sm text-muted">
                    등록된 맵이 없습니다.
                  </p>
                ) : (
                  mapPage.items.map((map) => (
                    <div
                      key={map.id}
                      className={cn(
                        "grid grid-cols-[88px_minmax(180px,1fr)_minmax(220px,1.2fr)_150px_140px] gap-3 border-t border-line px-5 py-4 text-sm first:border-t-0",
                        editingMapId === map.id && "bg-accent-soft/40",
                      )}
                    >
                      <span className="flex items-center">
                        {map.image ? (
                          <span
                            aria-label={`${map.mapName} 미리보기`}
                            role="img"
                            className="h-12 w-16 rounded-lg border border-line bg-white bg-cover bg-center"
                            style={createImagePreviewStyle(map.image)}
                          />
                        ) : (
                          <span className="grid h-12 w-16 place-items-center rounded-lg border border-line bg-surface-muted text-xs text-muted">
                            없음
                          </span>
                        )}
                      </span>
                      <span className="truncate font-semibold text-foreground">
                        {map.mapName}
                      </span>
                      <span className="truncate text-muted">{map.image || "-"}</span>
                      <span className="text-muted">
                        {formatDateTime(map.updateDate ?? map.regDate)}
                      </span>
                      <span className="flex justify-end gap-2">
                        <Button size="sm" onClick={() => handleEdit(map)}>
                          수정
                        </Button>
                        <Button
                          size="sm"
                          variant="danger"
                          disabled={deletingId === map.id}
                          onClick={() => void handleDelete(map)}
                        >
                          {deletingId === map.id ? "삭제 중" : "삭제"}
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
                  disabled={loading || !mapPage.hasPrevious}
                  onClick={() => setPage((current) => Math.max(0, current - 1))}
                >
                  이전
                </Button>
                <Button
                  disabled={loading || !mapPage.hasNext}
                  onClick={() => setPage((current) => current + 1)}
                >
                  다음
                </Button>
              </div>
              <p className="text-sm text-muted">
                {currentPageLabel} / {mapPage.totalPages} 페이지 · 총{" "}
                {mapPage.totalElements}개
              </p>
            </div>
          </SurfaceCard>
        </div>

        <SurfaceCard className="space-y-5 p-5 sm:p-6 xl:sticky xl:top-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">
                {editingMapId === null ? "Create" : "Edit"}
              </p>
              <h2 className="mt-2 text-2xl font-semibold text-foreground">
                {editingMapId === null ? "맵 추가" : "맵 수정"}
              </h2>
            </div>
            <Button onClick={resetForm}>처음부터</Button>
          </div>

          <form className="space-y-4" onSubmit={handleSubmit}>
            <label className="grid gap-2 text-sm font-semibold text-foreground">
              맵명
              <Input
                value={form.mapName}
                onChange={(event) => updateForm("mapName", event.target.value)}
                placeholder="Fighting Spirit"
              />
            </label>

            <label className="grid gap-2 text-sm font-semibold text-foreground">
              이미지 URL
              <Input
                value={form.image}
                onChange={(event) => updateForm("image", event.target.value)}
                placeholder="/maps/fighting-spirit.png"
              />
            </label>

            {form.image.trim() ? (
              <div className="rounded-lg border border-line bg-surface-muted p-3">
                <p className="mb-2 text-xs font-semibold text-muted">미리보기</p>
                <div
                  aria-label="맵 이미지 미리보기"
                  role="img"
                  className="h-28 w-full rounded-lg border border-line bg-white bg-cover bg-center"
                  style={createImagePreviewStyle(form.image.trim())}
                />
              </div>
            ) : null}

            <Button type="submit" variant="accent" fullWidth disabled={saving}>
              {saving
                ? "저장 중"
                : editingMapId === null
                  ? "추가"
                  : "수정 완료"}
            </Button>
          </form>
        </SurfaceCard>
      </div>
    </div>
  );
}
