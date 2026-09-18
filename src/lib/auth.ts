import { create } from "zustand";
import { useStore } from "./store";

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  provider: "local" | "convex";
}

interface AuthState {
  user: SessionUser | null;
  signIn: (email: string, password: string) => Promise<SessionUser>;
  signUp: (name: string, email: string, password: string) => Promise<SessionUser>;
  /** Login social: credential é o ID token emitido pelo botão do Google. */
  googleSignIn: (credential: string) => Promise<SessionUser>;
  signOut: () => void;
}

/** Dispara a migração dos dados de visitante para a conta autenticada. */
function adoptLocalData(userId: string, email: string) {
  const store = useStore.getState();
  store.syncUser(userId, email);
  void store.linkLocalDataToUser(userId).then(() => store.hydrateFromConvex(userId));
}

const SESSION_KEY = "pdfforge:session";
const CONVEX_URL =
  (import.meta.env.VITE_CONVEX_URL as string | undefined) ??
  (import.meta.env.NEXT_PUBLIC_CONVEX_URL as string | undefined) ??
  "";

function loadSession(): SessionUser | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as SessionUser) : null;
  } catch {
    return null;
  }
}

function saveSession(user: SessionUser | null) {
  try {
    if (user) localStorage.setItem(SESSION_KEY, JSON.stringify(user));
    else localStorage.removeItem(SESSION_KEY);
  } catch {
    /* ignore */
  }
}

/** Calls a Convex mutation when the backend is connected; returns null otherwise. */
async function convexUserMutation(
  path: string,
  args: Record<string, unknown>
): Promise<{ userId: string } | null> {
  if (!CONVEX_URL) return null;
  try {
    const res = await fetch(`${CONVEX_URL}/api/mutation`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path, args }),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { status?: string; value?: unknown };
    if (body.status !== "success") return null;
    return { userId: String(body.value ?? "") };
  } catch {
    return null;
  }
}

/**
 * Deterministic demo hash (FNV-1a) — keeps local sign-in working offline.
 * Production: replace by Convex Auth / bcrypt on the server layer.
 */
function demoHash(input: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16);
}

const USERS_KEY = "pdfforge:users";

interface StoredUser {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
}

function loadUsers(): StoredUser[] {
  try {
    return JSON.parse(localStorage.getItem(USERS_KEY) ?? "[]") as StoredUser[];
  } catch {
    return [];
  }
}

function saveUsers(users: StoredUser[]) {
  try {
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
  } catch {
    /* ignore */
  }
}

export const useAuth = create<AuthState>((set, _get) => ({
  user: loadSession(),

  signIn: async (email, password) => {
    const normalized = email.trim().toLowerCase();
    if (!normalized || !password) throw new Error("Informe e-mail e senha.");

    // 1) Tenta Convex (produção)
    const convex = await convexUserMutation("users:signIn", { email: normalized, password });
    if (convex) {
      const user: SessionUser = { id: convex.userId, email: normalized, name: normalized.split("@")[0], provider: "convex" };
      saveSession(user);
      set({ user });
      adoptLocalData(user.id, user.email);
      return user;
    }

    // 2) Fallback local (modo draft)
    const users = loadUsers();
    const found = users.find((u) => u.email === normalized);
    if (!found || found.passwordHash !== demoHash(`${normalized}:${password}`)) {
      throw new Error("E-mail ou senha inválidos. Crie uma conta se for seu primeiro acesso.");
    }
    const user: SessionUser = { id: found.id, email: found.email, name: found.name, provider: "local" };
    saveSession(user);
    set({ user });
    adoptLocalData(user.id, user.email);
    return user;
  },

  signUp: async (name, email, password) => {
    const normalized = email.trim().toLowerCase();
    const trimmedName = name.trim();
    if (!trimmedName) throw new Error("Informe seu nome.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) throw new Error("E-mail inválido.");
    if (password.length < 6) throw new Error("A senha precisa de no mínimo 6 caracteres.");

    // 1) Tenta Convex (produção)
    const convex = await convexUserMutation("users:signUp", {
      email: normalized,
      name: trimmedName,
      password,
    });
    if (convex) {
      const user: SessionUser = { id: convex.userId, email: normalized, name: trimmedName, provider: "convex" };
      saveSession(user);
      set({ user });
      adoptLocalData(user.id, user.email);
      return user;
    }

    // 2) Fallback local (modo draft)
    const users = loadUsers();
    if (users.some((u) => u.email === normalized)) {
      throw new Error("Este e-mail já está cadastrado. Faça login.");
    }
    const created: StoredUser = {
      id: `usr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      email: normalized,
      name: trimmedName,
      passwordHash: demoHash(`${normalized}:${password}`),
    };
    saveUsers([...users, created]);
    const user: SessionUser = { id: created.id, email: created.email, name: created.name, provider: "local" };
    saveSession(user);
    set({ user });
    adoptLocalData(user.id, user.email);
    return user;
  },

  googleSignIn: async (credential) => {
    if (!CONVEX_URL) throw new Error("Backend não conectado — use o login por e-mail.");
    try {
      const res = await fetch(`${CONVEX_URL}/api/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: "auth:googleSignIn", args: { credential } }),
      });
      const body = (await res.json()) as {
        status?: string;
        value?: { userId: string; email: string; name: string };
        errorMessage?: string;
      };
      if (body.status !== "success" || !body.value) {
        throw new Error(body.errorMessage ?? "Falha no login com Google.");
      }
      const user: SessionUser = {
        id: body.value.userId,
        email: body.value.email,
        name: body.value.name || body.value.email.split("@")[0],
        provider: "convex",
      };
      saveSession(user);
      set({ user });
      adoptLocalData(user.id, user.email);
      return user;
    } catch (err) {
      throw err instanceof Error ? err : new Error("Falha no login com Google.");
    }
  },

  signOut: () => {
    saveSession(null);
    set({ user: null });
    useStore.getState().syncUser("user_local", "visitante@local");
  },
}));

export function getCurrentUser(): SessionUser | null {
  return useAuth.getState().user ?? loadSession();
}

// Rehidrata documentos/recibos do Convex quando a sessão é restaurada
// (ex.: reload da página) — mantém o dashboard com dados reais.
const restoredSession = loadSession();
if (restoredSession?.provider === "convex") {
  void useStore.getState().hydrateFromConvex(restoredSession.id);
}
