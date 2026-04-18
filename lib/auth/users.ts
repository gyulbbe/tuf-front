import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { hashPassword, verifyPassword } from "@/lib/auth/password";

type StoredUser = {
  id: string;
  username: string;
  nickname: string;
  passwordHash: string;
  createdAt: string;
};

type UserStore = {
  users: StoredUser[];
};

export type PublicUser = Omit<StoredUser, "passwordHash">;

const USERS_FILE = path.join(process.cwd(), "data", "users.json");

function normalizeUsername(username: string) {
  return username.trim().toLowerCase();
}

function normalizeNickname(nickname: string) {
  return nickname.trim();
}

function toPublicUser(user: StoredUser): PublicUser {
  return {
    id: user.id,
    username: user.username,
    nickname: user.nickname,
    createdAt: user.createdAt,
  };
}

async function writeUserStore(store: UserStore) {
  await mkdir(path.dirname(USERS_FILE), { recursive: true });
  await writeFile(USERS_FILE, `${JSON.stringify(store, null, 2)}\n`, "utf8");
}

async function readUserStore(): Promise<UserStore> {
  try {
    const raw = await readFile(USERS_FILE, "utf8");
    const parsed = JSON.parse(raw) as Partial<UserStore>;

    return {
      users: Array.isArray(parsed.users) ? parsed.users : [],
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      const emptyStore = { users: [] };
      await writeUserStore(emptyStore);
      return emptyStore;
    }

    throw error;
  }
}

function validateSignupInput(input: {
  username: string;
  nickname: string;
  password: string;
}) {
  if (!/^[a-zA-Z0-9_]{3,20}$/.test(input.username)) {
    return "아이디는 영문, 숫자, 밑줄 조합의 3~20자로 입력해 주세요.";
  }

  if (input.nickname.length < 2 || input.nickname.length > 24) {
    return "닉네임은 2~24자로 입력해 주세요.";
  }

  if (input.password.length < 6 || input.password.length > 64) {
    return "비밀번호는 6~64자로 입력해 주세요.";
  }

  return null;
}

export async function createUser(input: {
  username: string;
  nickname: string;
  password: string;
}) {
  const normalizedInput = {
    username: normalizeUsername(input.username),
    nickname: normalizeNickname(input.nickname),
    password: input.password.trim(),
  };

  const validationError = validateSignupInput(normalizedInput);

  if (validationError) {
    return {
      ok: false as const,
      message: validationError,
    };
  }

  const store = await readUserStore();
  const duplicateUser = store.users.find(
    (user) => user.username === normalizedInput.username,
  );

  if (duplicateUser) {
    return {
      ok: false as const,
      message: "이미 사용 중인 아이디입니다.",
    };
  }

  const passwordHash = await hashPassword(normalizedInput.password);
  const user: StoredUser = {
    id: randomUUID(),
    username: normalizedInput.username,
    nickname: normalizedInput.nickname,
    passwordHash,
    createdAt: new Date().toISOString(),
  };

  await writeUserStore({
    users: [...store.users, user],
  });

  return {
    ok: true as const,
    user: toPublicUser(user),
  };
}

export async function verifyUserCredentials(input: {
  username: string;
  password: string;
}) {
  const username = normalizeUsername(input.username);
  const password = input.password.trim();

  if (!username || !password) {
    return {
      ok: false as const,
      message: "아이디와 비밀번호를 모두 입력해 주세요.",
    };
  }

  const store = await readUserStore();
  const user = store.users.find((entry) => entry.username === username);

  if (!user) {
    return {
      ok: false as const,
      message: "존재하지 않는 계정입니다.",
    };
  }

  const isValid = await verifyPassword(password, user.passwordHash);

  if (!isValid) {
    return {
      ok: false as const,
      message: "비밀번호가 올바르지 않습니다.",
    };
  }

  return {
    ok: true as const,
    user: toPublicUser(user),
  };
}

export async function getUserById(userId: string) {
  const store = await readUserStore();
  const user = store.users.find((entry) => entry.id === userId);

  return user ? toPublicUser(user) : null;
}
