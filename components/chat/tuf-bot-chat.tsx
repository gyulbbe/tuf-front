"use client";

import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { requestTufBotChat } from "@/lib/api/chat";
import { cn } from "@/lib/utils";

type ChatMessageState = "complete" | "thinking" | "streaming" | "error";

type ChatMessage = {
  id: string;
  role: "assistant" | "user";
  text: string;
  state: ChatMessageState;
};

function readErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return "요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.";
}

function ThinkingDots() {
  return (
    <div className="flex items-center gap-1.5 py-1" aria-label="답변 생성 중">
      {Array.from({ length: 3 }).map((_, index) => (
        <span
          key={index}
          className="h-2.5 w-2.5 rounded-full bg-current/55 animate-pulse"
          style={{ animationDelay: `${index * 140}ms` }}
        />
      ))}
    </div>
  );
}

export function TufBotChat() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [composer, setComposer] = useState("");
  const [phase, setPhase] = useState<"idle" | "waiting" | "streaming">("idle");
  const transcriptRef = useRef<HTMLDivElement | null>(null);
  const typingTimerRef = useRef<number | null>(null);
  const requestVersionRef = useRef(0);

  const activeUserId = user?.username?.trim() || "guest";
  const isBusy = phase !== "idle";

  useEffect(() => {
    return () => {
      if (typingTimerRef.current !== null) {
        window.clearInterval(typingTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const transcript = transcriptRef.current;

    if (!transcript) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      transcript.scrollTop = transcript.scrollHeight;
    });

    return () => window.cancelAnimationFrame(frame);
  }, [messages]);

  function stopTypingTimer() {
    if (typingTimerRef.current !== null) {
      window.clearInterval(typingTimerRef.current);
      typingTimerRef.current = null;
    }
  }

  function streamReply(messageId: string, text: string) {
    stopTypingTimer();

    return new Promise<void>((resolve) => {
      const segments = Array.from(text);

      if (segments.length === 0) {
        setMessages((current) =>
          current.map((message) =>
            message.id === messageId
              ? { ...message, text, state: "complete" }
              : message,
          ),
        );
        resolve();
        return;
      }

      const step = segments.length > 240 ? 7 : segments.length > 120 ? 4 : 2;
      let cursor = 0;

      typingTimerRef.current = window.setInterval(() => {
        cursor = Math.min(cursor + step, segments.length);

        setMessages((current) =>
          current.map((message) =>
            message.id === messageId
              ? {
                  ...message,
                  text: segments.slice(0, cursor).join(""),
                  state: cursor >= segments.length ? "complete" : "streaming",
                }
              : message,
          ),
        );

        if (cursor >= segments.length) {
          stopTypingTimer();
          resolve();
        }
      }, 18);
    });
  }

  async function submitMessage() {
    const text = composer.trim();

    if (!text || isBusy) {
      return;
    }

    const userMessageId = crypto.randomUUID();
    const assistantMessageId = crypto.randomUUID();
    const nextRequestVersion = requestVersionRef.current + 1;

    requestVersionRef.current = nextRequestVersion;
    stopTypingTimer();
    setComposer("");
    setPhase("waiting");
    setMessages((current) => [
      ...current,
      {
        id: userMessageId,
        role: "user",
        text,
        state: "complete",
      },
      {
        id: assistantMessageId,
        role: "assistant",
        text: "",
        state: "thinking",
      },
    ]);

    try {
      const response = await requestTufBotChat({
        userId: activeUserId,
        text,
      });

      if (requestVersionRef.current !== nextRequestVersion) {
        return;
      }

      setPhase("streaming");
      await streamReply(assistantMessageId, response.data);

      if (requestVersionRef.current === nextRequestVersion) {
        setPhase("idle");
      }
    } catch (error) {
      if (requestVersionRef.current !== nextRequestVersion) {
        return;
      }

      setMessages((current) =>
        current.map((message) =>
          message.id === assistantMessageId
            ? {
                ...message,
                text: readErrorMessage(error),
                state: "error",
              }
            : message,
        ),
      );
      setPhase("idle");
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-[linear-gradient(180deg,rgba(255,255,255,0.78)_0%,rgba(244,246,241,0.94)_100%)]">
      <div
        ref={transcriptRef}
        className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-5 sm:px-6"
      >
        {messages.map((message) => {
          const isAssistant = message.role === "assistant";
          const bubbleClassName = cn(
            "max-w-[88%] rounded-[24px] px-4 py-3 shadow-[0_12px_40px_-32px_rgba(31,42,40,0.75)]",
            isAssistant
              ? message.state === "error"
                ? "border border-danger-ink/20 bg-danger-soft text-danger-ink"
                : "border border-line bg-surface-strong text-foreground"
              : "bg-accent text-white",
          );

          return (
            <div
              key={message.id}
              className={cn("flex", isAssistant ? "justify-start" : "justify-end")}
            >
              <div className={bubbleClassName}>
                {message.state === "thinking" && !message.text ? (
                  <ThinkingDots />
                ) : (
                  <p className="whitespace-pre-wrap text-sm leading-7">
                    {message.text}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          void submitMessage();
        }}
        className="border-t border-line bg-white/55 p-4 sm:p-5"
      >
        <div className="rounded-[26px] border border-line bg-surface-strong p-3 shadow-[0_18px_50px_-36px_rgba(31,42,40,0.7)]">
          <Textarea
            value={composer}
            onChange={(event) => setComposer(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void submitMessage();
              }
            }}
            placeholder="메시지를 입력하세요"
            rows={3}
            disabled={isBusy}
            className="resize-none border-none bg-transparent px-1 py-1 shadow-none focus:border-none focus:bg-transparent"
          />

          <div className="mt-3 flex justify-end border-t border-line pt-3">
            <Button
              type="submit"
              disabled={!composer.trim() || isBusy}
              variant="accent"
              className="min-w-24"
            >
              전송
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
