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

interface AuthState {
  token: string | null;
  user: AuthUser | null;
  isLoading: boolean;
  login: (username: string, pass: string) => Promise<AuthUser>;
  logout: () => void;
  setUser: (user: AuthUser) => void;
}

export const useAuth = create<AuthState>((set) => ({
  token: getStoredToken(),
  user: getStoredUser(),
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

  logout: () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    set({ token: null, user: null });
  },

  setUser: (user: AuthUser) => {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    set({ user });
  },
}));
