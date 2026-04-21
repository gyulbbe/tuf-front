export type AuthStatus = "loading" | "authenticated" | "unauthenticated";

export type AuthRedirectReason =
  | "login-required"
  | "session-expired"
  | "unauthorized";

export type JwtClaims = {
  username: string;
  userPk: number;
  role: string;
  photo?: string | null;
  exp: number;
};

export type AuthUser = {
  username: string;
  userPk: number;
  role: string;
  photo: string | null;
  exp: number;
};

export type AuthSession = {
  authorization: string;
  user: AuthUser;
};

export type LoginCredentials = {
  username: string;
  password: string;
};
