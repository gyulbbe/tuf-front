"use client";

import {
  createContext,
  startTransition,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { loginRequest } from "@/lib/api/auth";
import { setUnauthorizedHandler } from "@/lib/api/client";
import { buildLoginHref, getCurrentRedirectTarget } from "@/lib/auth/auth-navigation";
import { clearAuthCookie, writeAuthCookie } from "@/lib/auth/auth-cookie";
import { clearStoredToken, readStoredToken, writeStoredToken } from "@/lib/auth/auth-storage";
import type {
  AuthRedirectReason,
  AuthSession,
  AuthStatus,
  AuthUser,
  LoginCredentials,
} from "@/lib/auth/auth-types";
import { buildAuthSession, isExpiredExp } from "@/lib/auth/jwt";

type AuthContextValue = {
  status: AuthStatus;
  user: AuthUser | null;
  isAuthenticated: boolean;
  login: (credentials: LoginCredentials) => Promise<AuthSession>;
  logout: () => void;
};

type AuthState = {
  status: AuthStatus;
  user: AuthUser | null;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const LOADING_AUTH_STATE: AuthState = {
  status: "loading",
  user: null,
};

const UNAUTHENTICATED_AUTH_STATE: AuthState = {
  status: "unauthenticated",
  user: null,
};

function persistSession(session: AuthSession) {
  writeStoredToken(session.authorization);
  writeAuthCookie(session);

  return {
    status: "authenticated" as const,
    user: session.user,
  };
}

function clearPersistedSession() {
  clearStoredToken();
  clearAuthCookie();
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [authState, setAuthState] = useState<AuthState>(LOADING_AUTH_STATE);
  const expiryTimeoutRef = useRef<number | null>(null);

  const clearExpiryTimeout = useCallback(() => {
    if (expiryTimeoutRef.current !== null) {
      window.clearTimeout(expiryTimeoutRef.current);
      expiryTimeoutRef.current = null;
    }
  }, []);

  const logout = useCallback(() => {
    clearExpiryTimeout();
    clearPersistedSession();
    setAuthState(UNAUTHENTICATED_AUTH_STATE);
  }, [clearExpiryTimeout]);

  const redirectToLogin = useCallback(
    (reason: AuthRedirectReason, redirectTo?: string | null) => {
      startTransition(() => {
        router.replace(
          buildLoginHref({
            reason,
            redirectTo:
              redirectTo === undefined ? getCurrentRedirectTarget() : redirectTo,
          }),
        );
      });
    },
    [router],
  );

  const handleAuthFailure = useCallback(
    (reason: AuthRedirectReason) => {
      logout();
      redirectToLogin(reason);
    },
    [logout, redirectToLogin],
  );

  const login = useCallback(
    async (credentials: LoginCredentials) => {
      const session = await loginRequest(credentials);

      if (isExpiredExp(session.user.exp)) {
        throw new Error("만료된 토큰이 내려와 로그인할 수 없습니다.");
      }

      clearExpiryTimeout();
      setAuthState(persistSession(session));

      return session;
    },
    [clearExpiryTimeout],
  );

  useEffect(() => {
    let cancelled = false;

    async function restoreSession() {
      await Promise.resolve();

      if (cancelled) {
        return;
      }

      const authorization = readStoredToken();

      if (!authorization) {
        setAuthState(UNAUTHENTICATED_AUTH_STATE);
        return;
      }

      const session = buildAuthSession(authorization);

      if (!session || isExpiredExp(session.user.exp)) {
        handleAuthFailure("session-expired");
        return;
      }

      setAuthState(persistSession(session));
    }

    void restoreSession();

    return () => {
      cancelled = true;
    };
  }, [handleAuthFailure]);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      handleAuthFailure("unauthorized");
    });

    return () => {
      setUnauthorizedHandler(null);
    };
  }, [handleAuthFailure]);

  useEffect(() => {
    clearExpiryTimeout();

    if (authState.status !== "authenticated" || !authState.user) {
      return;
    }

    const expiresIn = Math.max(authState.user.exp * 1000 - Date.now(), 0);

    expiryTimeoutRef.current = window.setTimeout(() => {
      handleAuthFailure("session-expired");
    }, expiresIn);

    return clearExpiryTimeout;
  }, [authState.status, authState.user, clearExpiryTimeout, handleAuthFailure]);

  return (
    <AuthContext.Provider
      value={{
        status: authState.status,
        user: authState.user,
        isAuthenticated: authState.status === "authenticated",
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within AuthProvider.");
  }

  return context;
}
