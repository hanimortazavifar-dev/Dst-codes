import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { hasAccess, ROLE_LABEL, useAuth } from "../lib/auth";
import { ROUTES, type PageKey } from "../routes";
import styles from "./RequireRole.module.css";

interface Props {
  /** The protected page being shown; the user needs access to it (set per user on /admin). */
  page: PageKey;
  children: ReactNode;
}

/**
 * Renders its children only for a signed-in user who was given `page`; otherwise shows the login
 * card (or, on a fresh install, the form that creates the first admin). The data itself is
 * protected on the server: the API only hands each user the sheets their pages need.
 */
export default function RequireRole({ page, children }: Props) {
  const { state, retry } = useAuth();

  if (state.status === "loading") return <div className={styles.overlay} aria-busy="true" />;

  if (state.status === "error") {
    return (
      <Overlay>
        <div className={styles.card} role="alert">
          <h2>ارتباط با سامانه برقرار نشد</h2>
          <p className={styles.sub}>{state.message}</p>
          <button type="button" onClick={retry}>
            تلاش دوباره
          </button>
        </div>
      </Overlay>
    );
  }

  if (state.status === "signedIn" && hasAccess(state.profile, page)) {
    return (
      <>
        {children}
        <UserBadge />
      </>
    );
  }

  if (state.status === "signedOut" && state.setupNeeded) return <SetupForm />;
  return <LoginForm denied={state.status === "signedIn"} />;
}

/** Full-screen backdrop that also stops the page behind it from scrolling. */
function Overlay({ children }: { children: ReactNode }) {
  useEffect(() => {
    const html = document.documentElement;
    html.style.overflow = "hidden";
    return () => {
      html.style.overflow = "";
    };
  }, []);
  return <div className={styles.overlay}>{children}</div>;
}

function LoginForm({ denied }: { denied: boolean }) {
  const { signIn, signOut } = useAuth();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const message = error || (denied && !busy ? "شما مجوز دسترسی به این صفحه را ندارید. با حساب دیگری وارد شوید." : "");

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    // A signed-in user without access may sign in as someone else.
    if (denied) await signOut();
    const err = await signIn(phone.trim(), password);
    setBusy(false);
    if (err) setError(err);
  }

  return (
    <Overlay>
      <form className={styles.card} onSubmit={submit} noValidate>
        <h2>ورود به سامانه LUBESTATION</h2>
        <p className={styles.sub}>دسترسی به این صفحه نیاز به ورود دارد. حساب کاربری را مدیر سامانه می‌سازد.</p>
        <label htmlFor="lsPhone">شماره موبایل</label>
        <input id="lsPhone" type="tel" inputMode="numeric" placeholder="09xxxxxxxxx" autoComplete="username" maxLength={11} value={phone} onChange={(e) => setPhone(e.target.value)} />
        <label htmlFor="lsPass">رمز عبور</label>
        <input id="lsPass" type="password" placeholder="••••••••" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        <button type="submit" disabled={busy}>
          {busy ? "در حال ورود..." : "ورود"}
        </button>
        {message && (
          <div className={styles.err} role="alert">
            {message}
          </div>
        )}
        <Link className={styles.back} to={ROUTES.home}>
          بازگشت به صفحه اصلی
        </Link>
      </form>
    </Overlay>
  );
}

function SetupForm() {
  const { setup } = useAuth();
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      setError("تکرار رمز عبور با خود رمز یکی نیست.");
      return;
    }
    setBusy(true);
    setError("");
    const err = await setup(phone.trim(), name.trim(), password);
    setBusy(false);
    if (err) setError(err);
  }

  return (
    <Overlay>
      <form className={styles.card} onSubmit={submit} noValidate>
        <h2>راه‌اندازی سامانه</h2>
        <p className={styles.sub}>هنوز هیچ کاربری ساخته نشده است. حساب مدیر اصلی سامانه را بسازید؛ بقیهٔ کاربران را بعداً از صفحهٔ مدیریت اضافه می‌کنید.</p>
        <label htmlFor="suName">نام و نام خانوادگی</label>
        <input id="suName" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
        <label htmlFor="suPhone">شماره موبایل</label>
        <input id="suPhone" type="tel" inputMode="numeric" placeholder="09xxxxxxxxx" autoComplete="username" maxLength={11} value={phone} onChange={(e) => setPhone(e.target.value)} />
        <label htmlFor="suPass">رمز عبور (دست‌کم ۸ کاراکتر)</label>
        <input id="suPass" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        <label htmlFor="suPass2">تکرار رمز عبور</label>
        <input id="suPass2" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        <button type="submit" disabled={busy}>
          {busy ? "در حال ساخت..." : "ساخت حساب مدیر"}
        </button>
        {error && (
          <div className={styles.err} role="alert">
            {error}
          </div>
        )}
      </form>
    </Overlay>
  );
}

function UserBadge() {
  const { state, signOut } = useAuth();
  const { pathname } = useLocation();
  if (state.status !== "signedIn") return null;
  const { profile } = state;
  return (
    <div className={styles.badge}>
      <span>
        <b>{profile.name || profile.phone}</b> · {ROLE_LABEL[profile.role] ?? profile.role}
      </span>
      {profile.role === "admin" && pathname !== ROUTES.admin && <Link to={ROUTES.admin}>مدیریت</Link>}
      <button type="button" onClick={signOut}>
        خروج
      </button>
    </div>
  );
}
