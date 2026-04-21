"use client";

import { readStoredToken } from "@/lib/auth/auth-storage";
import {
  buildRpsDraftWebSocketUrl,
  type RpsDraftLiveEvent,
} from "@/lib/api/rps-draft";
import { rpsDraftQueryKeys } from "@/lib/rps-draft/query-keys";

export type RpsDraftConnectionState =
  | "connecting"
  | "connected"
  | "reconnecting"
  | "disconnected"
  | "error";

type SubscribeToRpsDraftSessionOptions = {
  sessionId: number;
  onEvent: (event: RpsDraftLiveEvent) => void;
  onStateChange?: (state: RpsDraftConnectionState) => void;
  onError?: (message: string) => void;
};

type StompFrame = {
  command: string;
  headers: Record<string, string>;
  body: string;
};

export type RpsDraftSessionSubscription = {
  unsubscribe: () => void;
};

function buildFrame(command: string, headers: Record<string, string>, body = "") {
  const headerLines = Object.entries(headers).map(([key, value]) => `${key}:${value}`);
  const head = [command, ...headerLines].join("\n");

  return `${head}\n\n${body}\u0000`;
}

function parseFrame(rawFrame: string) {
  const normalized = rawFrame.replace(/^\s+/, "");

  if (!normalized) {
    return null;
  }

  const separatorIndex = normalized.indexOf("\n\n");
  const head =
    separatorIndex >= 0 ? normalized.slice(0, separatorIndex) : normalized;
  const body =
    separatorIndex >= 0 ? normalized.slice(separatorIndex + 2) : "";
  const [command, ...headerLines] = head.split("\n");

  if (!command) {
    return null;
  }

  const headers: Record<string, string> = {};

  for (const headerLine of headerLines) {
    const delimiterIndex = headerLine.indexOf(":");

    if (delimiterIndex < 0) {
      continue;
    }

    const key = headerLine.slice(0, delimiterIndex).trim();
    const value = headerLine.slice(delimiterIndex + 1).trim();

    if (key) {
      headers[key] = value;
    }
  }

  return {
    command: command.trim(),
    headers,
    body,
  } satisfies StompFrame;
}

function extractFrames(chunk: string, pending: string) {
  const combined = `${pending}${chunk}`;
  const rawFrames = combined.split("\u0000");
  const nextPending = rawFrames.pop() ?? "";
  const frames = rawFrames
    .map((rawFrame) => parseFrame(rawFrame))
    .filter((frame): frame is StompFrame => frame !== null);

  return {
    frames,
    pending: nextPending,
  };
}

export function subscribeToRpsDraftSession({
  sessionId,
  onEvent,
  onStateChange,
  onError,
}: SubscribeToRpsDraftSessionOptions) {
  const wsUrl = buildRpsDraftWebSocketUrl();
  const subscriptionId = rpsDraftQueryKeys.liveSubscription(sessionId);
  const authorization = readStoredToken() ?? "";
  let socket: WebSocket | null = null;
  let reconnectTimer: number | null = null;
  let reconnectAttempt = 0;
  let pendingChunk = "";
  let disposed = false;

  function scheduleReconnect() {
    if (disposed) {
      return;
    }

    reconnectAttempt += 1;
    onStateChange?.("reconnecting");

    reconnectTimer = window.setTimeout(() => {
      connect();
    }, Math.min(5000, 1000 * reconnectAttempt));
  }

  function cleanupReconnectTimer() {
    if (reconnectTimer === null) {
      return;
    }

    window.clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }

  function handleFrame(frame: StompFrame) {
    if (!socket) {
      return;
    }

    if (frame.command === "CONNECTED") {
      reconnectAttempt = 0;
      onStateChange?.("connected");
      socket.send(
        buildFrame("SUBSCRIBE", {
          id: subscriptionId,
          destination: `/topic/rps-drafts/${sessionId}`,
        }),
      );
      return;
    }

    if (frame.command === "MESSAGE") {
      try {
        onEvent(JSON.parse(frame.body) as RpsDraftLiveEvent);
      } catch {
        onError?.("실시간 이벤트를 해석하지 못했습니다.");
      }
      return;
    }

    if (frame.command === "ERROR") {
      onStateChange?.("error");
      onError?.(frame.body || "가위바위보 드래프트 소켓 연결 중 오류가 발생했습니다.");
    }
  }

  function connect() {
    cleanupReconnectTimer();
    pendingChunk = "";
    onStateChange?.(reconnectAttempt === 0 ? "connecting" : "reconnecting");
    socket = new WebSocket(wsUrl);

    socket.onopen = () => {
      if (!socket) {
        return;
      }

      const headers: Record<string, string> = {
        "accept-version": "1.2",
        "heart-beat": "0,0",
      };

      if (authorization) {
        headers.authorization = authorization;
      }

      socket.send(buildFrame("CONNECT", headers));
    };

    socket.onmessage = (event) => {
      if (typeof event.data !== "string") {
        return;
      }

      const result = extractFrames(event.data, pendingChunk);
      pendingChunk = result.pending;

      for (const frame of result.frames) {
        handleFrame(frame);
      }
    };

    socket.onerror = () => {
      onStateChange?.("error");
    };

    socket.onclose = () => {
      socket = null;

      if (disposed) {
        onStateChange?.("disconnected");
        return;
      }

      scheduleReconnect();
    };
  }

  connect();

  function unsubscribe() {
    disposed = true;
    cleanupReconnectTimer();

    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(
        buildFrame("UNSUBSCRIBE", {
          id: subscriptionId,
        }),
      );
      socket.close(1000, "client-disconnect");
      return;
    }

    socket?.close();
  }

  return {
    unsubscribe,
  } satisfies RpsDraftSessionSubscription;
}
