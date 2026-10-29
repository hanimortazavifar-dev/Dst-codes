import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { ApiError, getJson, postJson } from "./api";
import { toAsciiDigits } from "./jalali";

export type Role = "admin" | "viewer";

export interface Profile {
  id: string;
  phone: string;
  name: string;
  role: Role;
}

type AuthState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "signedOut"; setupNeeded: boolean }
  | { status: "signedIn"; profile: Profile };

interface AuthContextValue {
  state: AuthState;
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
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    getJson<{ user: Profile | null; setupNeeded: boolean }>("auth.php")
      .then(({ user, setupNeeded }) => {
        if (!cancelled) setState(user ? { status: "signedIn", profile: user } : { status: "signedOut", setupNeeded });
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
      setState({ status: "signedOut", setupNeeded: false });
    }
  }, []);

  const retry = useCallback(() => {
    setState({ status: "loading" });
    setAttempt((n) => n + 1);
  }, []);

  const value = useMemo(() => ({ state, signIn, setup, signOut, retry }), [state, signIn, setup, signOut, retry]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}

/** "viewer" accepts every signed-in user; "admin" only admins. */
export const hasAccess = (role: Role, required: Role) => required === "viewer" || role === "admin";
