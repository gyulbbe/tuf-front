"use client";

import { type FormEvent, useEffect, useMemo, useState } from "react";
import { SurfaceCard } from "@/components/site/surface-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  getAdminAiSettings,
  testAdminAiProvider,
  updateAdminAiSettings,
  type AiChatRoutingMode,
  type AiChatSettings,
  type AiChatTestProvider,
} from "@/lib/api/ai-settings";
import { cn } from "@/lib/utils";

type NoticeTone = "error" | "success";

type NoticeState = {
  tone: NoticeTone;
  text: string;
};

type TestState = {
  message: string;
  response: string;
  model: string;
  notice: NoticeState | null;
  loading: boolean;
};

const ROUTING_OPTIONS: Array<{
  value: AiChatRoutingMode;
  label: string;
  description: string;
}> = [
  {
    value: "AUTO",
    label: "자동",
    description: "Cloudflare를 먼저 쓰고 실패하면 로컬로 전환",
  },
  {
    value: "CLOUDFLARE_ONLY",
    label: "Cloudflare만",
    description: "Cloudflare 모델만 사용",
  },
  {
    value: "OLLAMA_ONLY",
    label: "로컬만",
    description: "로컬 Ollama 모델만 사용",
  },
];

const DEFAULT_SETTINGS: AiChatSettings = {
  routingMode: "AUTO",
  cloudflareModel: "@cf/google/gemma-4-26b-a4b-it",
  ollamaModel: "gemma4:e4b",
  updatedBy: null,
  updatedAt: null,
};

const DEFAULT_TEST_STATE: TestState = {
  message: "안녕. 지금 어떤 모델로 응답하고 있는지 짧게 말해줘.",
  response: "",
  model: "",
  notice: null,
  loading: false,
};

function readErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return "요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.";
}

function getNoticeClassName(tone: NoticeTone) {
  return tone === "error"
    ? "border border-danger-ink/15 bg-danger-soft text-danger-ink"
    : "border border-success-ink/15 bg-success-soft text-success-ink";
}

function normalizeSettings(settings: AiChatSettings): AiChatSettings {
  return {
    routingMode: settings.routingMode,
    cloudflareModel: settings.cloudflareModel.trim(),
    ollamaModel: settings.ollamaModel.trim(),
    updatedBy: settings.updatedBy ?? null,
    updatedAt: settings.updatedAt ?? null,
  };
}

function createTestState(): TestState {
  return { ...DEFAULT_TEST_STATE };
}

export function AdminAiSettingsConsole() {
  const [savedSettings, setSavedSettings] =
    useState<AiChatSettings>(DEFAULT_SETTINGS);
  const [draftSettings, setDraftSettings] =
    useState<AiChatSettings>(DEFAULT_SETTINGS);
  const [notice, setNotice] = useState<NoticeState | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tests, setTests] = useState<Record<AiChatTestProvider, TestState>>({
    CLOUDFLARE: createTestState(),
    OLLAMA: createTestState(),
  });

  const hasChanges = useMemo(() => {
    const saved = normalizeSettings(savedSettings);
    const draft = normalizeSettings(draftSettings);

    return (
      saved.routingMode !== draft.routingMode ||
      saved.cloudflareModel !== draft.cloudflareModel ||
      saved.ollamaModel !== draft.ollamaModel
    );
  }, [draftSettings, savedSettings]);

  useEffect(() => {
    let cancelled = false;

    async function loadSettings() {
      setLoading(true);

      try {
        const data = await getAdminAiSettings();

        if (!cancelled) {
          const nextSettings = normalizeSettings(data);
          setSavedSettings(nextSettings);
          setDraftSettings(nextSettings);
          setNotice(null);
        }
      } catch (error) {
        if (!cancelled) {
          setNotice({ tone: "error", text: readErrorMessage(error) });
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadSettings();

    return () => {
      cancelled = true;
    };
  }, []);

  function updateDraft<K extends keyof AiChatSettings>(
    key: K,
    value: AiChatSettings[K],
  ) {
    setNotice(null);
    setDraftSettings((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function updateTestMessage(provider: AiChatTestProvider, message: string) {
    setTests((current) => ({
      ...current,
      [provider]: {
        ...current[provider],
        message,
        notice: null,
      },
    }));
  }

  async function handleSave() {
    const payload = normalizeSettings(draftSettings);

    if (!payload.cloudflareModel || !payload.ollamaModel || saving) {
      setNotice({ tone: "error", text: "모델명을 모두 입력해 주세요." });
      return;
    }

    setSaving(true);
    setNotice(null);

    try {
      const data = await updateAdminAiSettings({
        routingMode: payload.routingMode,
        cloudflareModel: payload.cloudflareModel,
        ollamaModel: payload.ollamaModel,
      });
      const nextSettings = normalizeSettings(data);
      setSavedSettings(nextSettings);
      setDraftSettings(nextSettings);
      setNotice({ tone: "success", text: "AI 모델 설정을 저장했습니다." });
    } catch (error) {
      setNotice({ tone: "error", text: readErrorMessage(error) });
    } finally {
      setSaving(false);
    }
  }

  async function handleTest(event: FormEvent<HTMLFormElement>, provider: AiChatTestProvider) {
    event.preventDefault();
    const message = tests[provider].message.trim();

    if (!message || tests[provider].loading) {
      return;
    }

    setTests((current) => ({
      ...current,
      [provider]: {
        ...current[provider],
        loading: true,
        response: "",
        model: "",
        notice: null,
      },
    }));

    try {
      const data = await testAdminAiProvider({ provider, message });

      setTests((current) => ({
        ...current,
        [provider]: {
          ...current[provider],
          loading: false,
          response: data.response,
          model: data.model,
          notice: { tone: "success", text: "테스트 응답을 받았습니다." },
        },
      }));
    } catch (error) {
      setTests((current) => ({
        ...current,
        [provider]: {
          ...current[provider],
          loading: false,
          response: "",
          model: "",
          notice: { tone: "error", text: readErrorMessage(error) },
        },
      }));
    }
  }

  return (
    <div className="space-y-4">
      <SurfaceCard className="p-7 sm:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-accent">
              Admin AI
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
              AI 모델 설정
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-8 text-muted">
              전체 AI 호출에 사용할 Cloudflare 모델과 로컬 Ollama 모델을 관리합니다.
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
            AI 모델 설정을 불러오는 중입니다.
          </p>
        ) : null}

        <div className="mt-6 grid gap-5">
          <div className="grid gap-3">
            <p className="text-sm font-semibold text-foreground">전역 라우팅 모드</p>
            <div className="grid gap-3 lg:grid-cols-3">
              {ROUTING_OPTIONS.map((option) => {
                const selected = draftSettings.routingMode === option.value;

                return (
                  <button
                    key={option.value}
                    type="button"
                    disabled={loading || saving}
                    onClick={() => updateDraft("routingMode", option.value)}
                    className={cn(
                      "rounded-lg border px-4 py-4 text-left transition-colors",
                      selected
                        ? "border-accent bg-accent-soft text-accent-ink"
                        : "border-line bg-surface-strong text-foreground hover:border-accent-soft",
                    )}
                  >
                    <span className="block text-base font-semibold">
                      {option.label}
                    </span>
                    <span className="mt-2 block text-sm leading-6 text-muted">
                      {option.description}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <label className="grid gap-2 text-sm font-semibold text-foreground">
              Cloudflare 모델명
              <Input
                value={draftSettings.cloudflareModel}
                disabled={loading || saving}
                onChange={(event) =>
                  updateDraft("cloudflareModel", event.target.value)
                }
                placeholder="@cf/google/gemma-4-26b-a4b-it"
              />
            </label>
            <label className="grid gap-2 text-sm font-semibold text-foreground">
              로컬 Ollama 모델명
              <Input
                value={draftSettings.ollamaModel}
                disabled={loading || saving}
                onChange={(event) => updateDraft("ollamaModel", event.target.value)}
                placeholder="gemma4:e4b"
              />
            </label>
          </div>
        </div>
      </SurfaceCard>

      <div className="grid gap-4 xl:grid-cols-2">
        <ProviderTestPanel
          title="Cloudflare 테스트"
          description="저장된 Cloudflare 모델로만 테스트합니다."
          state={tests.CLOUDFLARE}
          onMessageChange={(message) => updateTestMessage("CLOUDFLARE", message)}
          onSubmit={(event) => void handleTest(event, "CLOUDFLARE")}
        />
        <ProviderTestPanel
          title="로컬 Ollama 테스트"
          description="저장된 로컬 Ollama 모델로만 테스트합니다."
          state={tests.OLLAMA}
          onMessageChange={(message) => updateTestMessage("OLLAMA", message)}
          onSubmit={(event) => void handleTest(event, "OLLAMA")}
        />
      </div>
    </div>
  );
}

function ProviderTestPanel({
  title,
  description,
  state,
  onMessageChange,
  onSubmit,
}: {
  title: string;
  description: string;
  state: TestState;
  onMessageChange: (message: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <SurfaceCard className="p-5 sm:p-6">
      <div>
        <h2 className="text-2xl font-semibold text-foreground">{title}</h2>
        <p className="mt-2 text-sm leading-6 text-muted">{description}</p>
      </div>

      {state.notice ? (
        <div
          className={cn(
            "mt-4 rounded-lg px-4 py-3 text-sm",
            getNoticeClassName(state.notice.tone),
          )}
        >
          {state.notice.text}
        </div>
      ) : null}

      <form className="mt-5 space-y-4" onSubmit={onSubmit}>
        <Textarea
          value={state.message}
          onChange={(event) => onMessageChange(event.target.value)}
          rows={4}
          disabled={state.loading}
          className="resize-none"
        />
        <Button
          type="submit"
          variant="accent"
          disabled={!state.message.trim() || state.loading}
        >
          {state.loading ? "테스트 중" : "테스트 보내기"}
        </Button>
      </form>

      {state.response ? (
        <div className="mt-5 rounded-lg border border-line bg-surface-muted px-4 py-4">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
            {state.model}
          </p>
          <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-foreground">
            {state.response}
          </p>
        </div>
      ) : null}
    </SurfaceCard>
  );
}
