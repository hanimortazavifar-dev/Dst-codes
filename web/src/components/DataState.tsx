import { Link } from "react-router-dom";
import type { DashboardState } from "../data/useDashboard";
import { useAuth } from "../lib/auth";
import { ROUTES } from "../routes";

/** A CSS module providing `state`, `spinner` and `btn` classes in the page's own theme. */
type Classes = { readonly [key: string]: string };

/** Loading / no-data / error placeholder shared by the data pages. Renders nothing once ready. */
export default function DataState({ state, reload, classes }: { state: DashboardState; reload: () => void; classes: Classes }) {
  const { state: auth } = useAuth();
  const isAdmin = auth.status === "signedIn" && auth.profile.role === "admin";

  if (state.status === "ready") return null;
  if (state.status === "loading") {
    return (
      <div className={classes.state} role="status">
        <div className={classes.spinner} />
        <p>در حال دریافت اطلاعات…</p>
      </div>
    );
  }
  return (
    <div className={classes.state} role="alert">
      <p>{state.message}</p>
      {state.status === "empty" ? (
        isAdmin ? (
          <Link className={classes.btn} to={ROUTES.admin}>
            بارگذاری فایل اکسل
          </Link>
        ) : (
          <p>پس از بارگذاری فایل داده توسط مدیر سامانه، اطلاعات اینجا نمایش داده می‌شود.</p>
        )
      ) : (
        <button type="button" className={classes.btn} onClick={reload}>
          تلاش دوباره
        </button>
      )}
    </div>
  );
}
