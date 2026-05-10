"use client";

import { useEffect, useMemo, useState } from "react";
import { SurfaceCard } from "@/components/site/surface-card";
import { Button } from "@/components/ui/button";
import {
  getSiteMenuVisibility,
  updateAdminMenuVisibility,
  type SiteMenuVisibilityItem,
} from "@/lib/api/menu-visibility";
import {
  siteMenuVisibilityItems,
  type SiteMenuVisibilityKey,
} from "@/content/site";
import { cn } from "@/lib/utils";

type NoticeTone = "error" | "neutral" | "success";

type NoticeState = {
  tone: NoticeTone;
  text: string;
};

type VisibilityRecord = Record<SiteMenuVisibilityKey, boolean>;

const MENU_VISIBILITY_CHANGED_EVENT = "site-menu-visibility-changed";

const DEFAULT_VISIBILITY_RECORD = siteMenuVisibilityItems.reduce(
  (record, item) => {
    record[item.menuKey] = true;
    return record;
  },
  {} as VisibilityRecord,
);

function readErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return "요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.";
}

function getNoticeClassName(tone: NoticeTone) {
  switch (tone) {
    case "error":
      return "border border-danger-ink/15 bg-danger-soft text-danger-ink";
    case "success":
      return "border border-success-ink/15 bg-success-soft text-success-ink";
    default:
      return "border border-line bg-surface-muted text-foreground";
  }
}

function isManagedMenuKey(menuKey: string): menuKey is SiteMenuVisibilityKey {
  return siteMenuVisibilityItems.some((item) => item.menuKey === menuKey);
}

function buildVisibilityRecord(items: SiteMenuVisibilityItem[]) {
  const record: VisibilityRecord = { ...DEFAULT_VISIBILITY_RECORD };

  for (const item of items) {
    if (isManagedMenuKey(item.menuKey)) {
      record[item.menuKey] = item.visible !== false;
    }
  }

  return record;
}

function buildChangedItems(
  savedVisibility: VisibilityRecord,
  draftVisibility: VisibilityRecord,
) {
  return siteMenuVisibilityItems
    .filter((item) => savedVisibility[item.menuKey] !== draftVisibility[item.menuKey])
    .map((item) => ({
      menuKey: item.menuKey,
      visible: draftVisibility[item.menuKey],
    }));
}

export function AdminMenuVisibilityConsole() {
  const [savedVisibility, setSavedVisibility] = useState<VisibilityRecord>(
    DEFAULT_VISIBILITY_RECORD,
  );
  const [draftVisibility, setDraftVisibility] = useState<VisibilityRecord>(
    DEFAULT_VISIBILITY_RECORD,
  );
  const [notice, setNotice] = useState<NoticeState | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const changedItems = useMemo(
    () => buildChangedItems(savedVisibility, draftVisibility),
    [draftVisibility, savedVisibility],
  );
  const hasChanges = changedItems.length > 0;

  useEffect(() => {
    let cancelled = false;

    async function loadVisibility() {
      setLoading(true);

      try {
        const data = await getSiteMenuVisibility();
        const nextVisibility = buildVisibilityRecord(data.items);

        if (!cancelled) {
          setSavedVisibility(nextVisibility);
          setDraftVisibility(nextVisibility);
          setNotice(null);
        }
      } catch (error) {
        if (!cancelled) {
          setSavedVisibility(DEFAULT_VISIBILITY_RECORD);
          setDraftVisibility(DEFAULT_VISIBILITY_RECORD);
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

    void loadVisibility();

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSave() {
    if (!hasChanges || saving) {
      return;
    }

    setSaving(true);
    setNotice(null);

    try {
      const data = await updateAdminMenuVisibility(changedItems);
      const nextVisibility = buildVisibilityRecord(data.items);

      setSavedVisibility(nextVisibility);
      setDraftVisibility(nextVisibility);
      window.dispatchEvent(
        new CustomEvent(MENU_VISIBILITY_CHANGED_EVENT, { detail: data.items }),
      );
      setNotice({
        tone: "success",
        text: "메뉴 노출 설정을 저장했습니다.",
      });
    } catch (error) {
      setNotice({
        tone: "error",
        text: readErrorMessage(error),
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <SurfaceCard className="p-7 sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-accent">
          Admin Menu
        </p>
        <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
              메뉴 설정
            </h1>
            <p className="mt-4 max-w-3xl text-base leading-8 text-muted">
              숨김은 메뉴에서만 적용되며 직접 URL 접근 권한은 기존 정책을 따릅니다.
            </p>
          </div>

          <Button
            variant="accent"
            disabled={!hasChanges || loading || saving}
            onClick={handleSave}
          >
            {saving ? "저장 중" : hasChanges ? "변경사항 저장" : "저장됨"}
          </Button>
        </div>

        {notice ? (
          <div
            className={cn(
              "mt-5 rounded-lg px-4 py-4 text-sm",
              getNoticeClassName(notice.tone),
            )}
          >
            {notice.text}
          </div>
        ) : null}

        {loading ? (
          <p className="mt-6 rounded-lg bg-surface-muted px-4 py-5 text-sm text-muted">
            메뉴 노출 설정을 불러오는 중입니다.
          </p>
        ) : null}

        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          {siteMenuVisibilityItems.map((item) => {
            const visible = draftVisibility[item.menuKey] !== false;
            const changed =
              savedVisibility[item.menuKey] !== draftVisibility[item.menuKey];

            return (
              <div
                key={item.menuKey}
                className="rounded-lg border border-line bg-surface-strong px-5 py-5"
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-lg font-semibold text-foreground">
                        {item.label}
                      </p>
                      <span
                        className={cn(
                          "rounded-full px-3 py-1 text-xs font-semibold",
                          visible
                            ? "bg-success-soft text-success-ink"
                            : "bg-danger-soft text-danger-ink",
                        )}
                      >
                        {visible ? "표시 중" : "숨김"}
                      </span>
                      {changed ? (
                        <span className="rounded-full bg-accent-soft px-3 py-1 text-xs font-semibold text-accent-ink">
                          저장 전 변경됨
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-3 text-sm leading-7 text-muted">
                      {item.description}
                    </p>
                    <p className="mt-2 text-xs font-semibold text-muted">
                      {item.menuKey}
                    </p>
                  </div>

                  <Button
                    size="sm"
                    variant={visible ? "danger" : "accent"}
                    disabled={loading || saving}
                    onClick={() => {
                      setNotice(null);
                      setDraftVisibility((current) => ({
                        ...current,
                        [item.menuKey]: !visible,
                      }));
                    }}
                  >
                    {visible ? "숨기기" : "표시하기"}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </SurfaceCard>
    </div>
  );
}
