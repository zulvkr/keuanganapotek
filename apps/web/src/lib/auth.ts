import { create } from "zustand";
import type { AuthUser, LoginResponse } from "@keuangan-apotek/shared";
import { requestJson } from "./api";

const TOKEN_KEY = "ka_auth_token";
const USER_KEY = "ka_auth_user";

export function getStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function getStoredUser(): AuthUser | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

const DEFAULT_ADMIN: AuthUser = {
  id: "user-admin",
  username: "admin",
  name: "Apoteker Admin (Owner)",
  role: "admin",
  allowedCoaCodes: [],
};

interface AuthState {
  token: string | null;
  user: AuthUser;
  isLoading: boolean;
  login: (username: string, pass: string) => Promise<AuthUser>;
  quickSwitchUser: (targetRole: "admin" | "asisten") => Promise<AuthUser>;
  logout: () => void;
  setUser: (user: AuthUser) => void;
}

export const useAuth = create<AuthState>((set, get) => ({
  token: getStoredToken(),
  user: getStoredUser() ?? DEFAULT_ADMIN,
  isLoading: false,

  login: async (username: string, pass: string) => {
    set({ isLoading: true });
    try {
      const res = await requestJson<LoginResponse>("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password: pass }),
      });
      localStorage.setItem(TOKEN_KEY, res.token);
      localStorage.setItem(USER_KEY, JSON.stringify(res.user));
      set({ token: res.token, user: res.user, isLoading: false });
      return res.user;
    } catch (err) {
      set({ isLoading: false });
      throw err;
    }
  },

  quickSwitchUser: async (targetRole: "admin" | "asisten") => {
    const creds =
      targetRole === "admin"
        ? { username: "admin", password: "admin123" }
        : { username: "asisten", password: "asisten123" };
    return get().login(creds.username, creds.password);
  },

  logout: () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    set({ token: null, user: DEFAULT_ADMIN });
  },

  setUser: (user: AuthUser) => {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    set({ user });
  },
}));
