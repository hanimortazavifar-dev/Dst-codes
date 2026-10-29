import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { invalidateDashboard } from "../data/useDashboard";
import { DEFAULT_PUBLIC_PAGES, type PageKey } from "../routes";
import { ApiError, getJson, postJson } from "./api";
import { toAsciiDigits } from "./jalali";

/** Derived by the server: "admin" when the user has the admin page. */
export type Role = "admin" | "viewer";

export interface Profile {
  id: string;
  phone: string;
  name: string;
  role: Role;
  pages: PageKey[];
}

type AuthState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "signedOut"; setupNeeded: boolean }
  | { status: "signedIn"; profile: Profile };

interface AuthContextValue {
  state: AuthState;
  /** Pages anyone may open without signing in (set by the admin). */
  publicPages: PageKey[];
  /** Updates `publicPages` after the admin changes them. */
  setPublicPages: (pages: PageKey[]) => void;
  /** Each resolves to an error message, or null on success. */
  signIn: (phone: string, password: string) => Promise<string | null>;
  setup: (phone: string, name: string, password: string) => Promise<string | null>;
  signOut: () => Promise<void>;
  retry: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export const ROLE_LABEL: Record<Role, string> = { admin: "مدیر سیستم", viewer: "کاربر" };

export const normalizePhone = (phone: string) => toAsciiDigits(phone).replace(/[\s-]/g, "");
export const isValidPhone = (phone: string) => /^09\d{9}$/.test(normalizePhone(phone));

const message = (e: unknown) => (e instanceof ApiError ? e.message : "خطای ناشناخته؛ دوباره تلاش کنید.");

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: "loading" });
  // Until the server answers (or if it can't be reached), the default public pages stay open.
  const [publicPages, setPublicPages] = useState<PageKey[]>(DEFAULT_PUBLIC_PAGES);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    getJson<{ user: Profile | null; setupNeeded: boolean; publicPages: PageKey[] }>("auth.php")
      .then(({ user, setupNeeded, publicPages }) => {
        if (cancelled) return;
        setPublicPages(publicPages);
        setState(user ? { status: "signedIn", profile: user } : { status: "signedOut", setupNeeded });
      })
      .catch((e) => {
        if (!cancelled) setState({ status: "error", message: message(e) });
      });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const signIn = useCallback(async (phone: string, password: string) => {
    if (!isValidPhone(phone)) return "شماره موبایل باید ۱۱ رقم باشد و با ۰۹ شروع شود.";
    if (!password) return "رمز عبور را وارد کنید.";
    try {
      const { user } = await postJson<{ user: Profile }>("auth.php", { action: "login", phone: normalizePhone(phone), password });
      // The data file is filtered per user, so never reuse one fetched for someone else.
      invalidateDashboard();
      setState({ status: "signedIn", profile: user });
      return null;
    } catch (e) {
      return message(e);
    }
  }, []);

  const setup = useCallback(async (phone: string, name: string, password: string) => {
    if (!isValidPhone(phone)) return "شماره موبایل باید ۱۱ رقم باشد و با ۰۹ شروع شود.";
    if (password.length < 8) return "رمز عبور باید دست‌کم ۸ کاراکتر باشد.";
    try {
      const { user } = await postJson<{ user: Profile }>("auth.php", { action: "setup", phone: normalizePhone(phone), name, password });
      setState({ status: "signedIn", profile: user });
      return null;
    } catch (e) {
      // Someone created the first admin meanwhile (e.g. in another tab): show the login form instead.
      if (e instanceof ApiError && e.status === 409) {
        setState({ status: "signedOut", setupNeeded: false });
        return null;
      }
      return message(e);
    }
  }, []);

  const signOut = useCallback(async () => {
    try {
      await postJson("auth.php", { action: "logout" });
    } finally {
      invalidateDashboard();
      setState({ status: "signedOut", setupNeeded: false });
    }
  }, []);

  const retry = useCallback(() => {
    setState({ status: "loading" });
    setAttempt((n) => n + 1);
  }, []);

  const value = useMemo(
    () => ({ state, publicPages, setPublicPages, signIn, setup, signOut, retry }),
    [state, publicPages, signIn, setup, signOut, retry],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}

/** Whether the user was given `page` (admins have every page). */
export const hasAccess = (profile: Profile, page: PageKey) => profile.pages.includes(page) || profile.pages.includes("admin");
