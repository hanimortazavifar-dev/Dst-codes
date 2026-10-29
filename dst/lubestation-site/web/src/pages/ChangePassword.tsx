import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import dstLogo from "../assets/dst-logo.webp";
import g from "../components/governance/Governance.module.css";
import { HomeIcon } from "../components/icons";
import { ApiError, postJson } from "../lib/api";
import { useAuth } from "../lib/auth";
import { prefersReducedMotion } from "../lib/format";
import { ROUTES } from "../routes";
import { startOrbitBackground } from "../three/orbitBackground";
import styles from "./ChangePassword.module.css";

/** Any signed-in user changes their own password here (linked from the user badge). */
export default function ChangePassword() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { state } = useAuth();
  const profile = state.status === "signedIn" ? state.profile : null;
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [repeat, setRepeat] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok?: string; error?: string }>({});

  useEffect(() => {
    if (!canvasRef.current || prefersReducedMotion()) return;
    return startOrbitBackground(canvasRef.current);
  }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (next.length < 8) return setResult({ error: "رمز جدید باید دست‌کم ۸ کاراکتر باشد." });
    if (next !== repeat) return setResult({ error: "تکرار رمز جدید با خود آن یکی نیست." });
    setBusy(true);
    setResult({});
    try {
      await postJson("auth.php", { action: "password", current, next });
      setResult({ ok: "رمز عبور شما تغییر کرد. از این پس با رمز جدید وارد شوید." });
      setCurrent("");
      setNext("");
      setRepeat("");
    } catch (err) {
      setResult({ error: err instanceof ApiError ? err.message : "تغییر رمز انجام نشد؛ دوباره تلاش کنید." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={g.page} dir="rtl" lang="fa">
      <canvas ref={canvasRef} className={g.background} aria-hidden="true" />
      <div className={g.wrap}>
        <header className={g.top}>
          <img className={g.logo} src={dstLogo} alt="DST — Diesel Super Technology" />
          <div className={g.ttl}>
            <h1>LUBESTATION</h1>
            <p>تغییر رمز عبور</p>
          </div>
          <div className={g.toprow}>
            <Link className={g.homelink} to={ROUTES.home}>
              <HomeIcon />
              HOME
            </Link>
          </div>
        </header>

        <section className={styles.wrap}>
          <h2 className={g.h}>تغییر رمز عبور</h2>
          <form className={`${g.panel} ${styles.form}`} onSubmit={submit} noValidate>
            {profile && (
              <p className={styles.who}>
                حساب: <b>{profile.name || profile.phone}</b>
                {profile.name && <span dir="ltr"> ({profile.phone})</span>}
              </p>
            )}
            <label htmlFor="cpCurrent">رمز فعلی</label>
            <input id="cpCurrent" type="password" autoComplete="current-password" value={current} autoFocus onChange={(e) => setCurrent(e.target.value)} />
            <label htmlFor="cpNext">رمز جدید (دست‌کم ۸ کاراکتر)</label>
            <input id="cpNext" type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} />
            <label htmlFor="cpRepeat">تکرار رمز جدید</label>
            <input id="cpRepeat" type="password" autoComplete="new-password" value={repeat} onChange={(e) => setRepeat(e.target.value)} />
            {(result.error || result.ok) && (
              <div className={result.error ? styles.bad : styles.good} role={result.error ? "alert" : "status"}>
                {result.error || result.ok}
              </div>
            )}
            <button type="submit" className={g.btn} disabled={busy}>
              {busy ? "در حال ذخیره..." : "ذخیرهٔ رمز جدید"}
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}
