import axios, { AxiosHeaders, CanceledError } from "axios";
import { readStoredToken } from "@/lib/auth/auth-storage";
import { buildAuthSession, isExpiredExp } from "@/lib/auth/jwt";

declare module "axios" {
  export interface AxiosRequestConfig {
    skipAuth?: boolean;
    skipUnauthorizedHandler?: boolean;
  }

  export interface InternalAxiosRequestConfig {
    skipAuth?: boolean;
    skipUnauthorizedHandler?: boolean;
  }
}

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080";

let unauthorizedHandler: (() => void) | null = null;
let configured = false;

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

export function setUnauthorizedHandler(handler: (() => void) | null) {
  unauthorizedHandler = handler;
}

function configureInterceptors() {
  if (configured) {
    return;
  }

  configured = true;

  apiClient.interceptors.request.use((config) => {
    if (config.skipAuth) {
      return config;
    }

    const authorization = readStoredToken();

    if (!authorization) {
      return config;
    }

    const session = buildAuthSession(authorization);

    if (!session || isExpiredExp(session.user.exp)) {
      unauthorizedHandler?.();
      throw new CanceledError("Authentication token is expired.");
    }

    const headers = AxiosHeaders.from(config.headers);

    headers.set("Authorization", authorization);
    config.headers = headers;

    return config;
  });

  apiClient.interceptors.response.use(
    (response) => response,
    (error) => {
      if (
        axios.isAxiosError(error) &&
        error.response?.status === 401 &&
        !error.config?.skipUnauthorizedHandler
      ) {
        unauthorizedHandler?.();
      }

      return Promise.reject(error);
    },
  );
}

configureInterceptors();
