import { useCallback, useEffect, useState } from "react";
import { ApiError, getFile } from "../lib/api";
import { XlsxError } from "../lib/xlsx";
import { parseWorkbook, type DashboardData } from "./workbook";

export interface LoadedData extends DashboardData {
  updatedAt: Date | null;
  /** The online source could not be reached; this is the last copy the server fetched. */
  stale: boolean;
}

export type DashboardState =
  | { status: "loading" }
  | { status: "empty"; message: string }
  | { status: "error"; message: string }
  | { status: "ready"; data: LoadedData };

// One shared request per page load; dropped after an upload or sign-out.
let cache: Promise<LoadedData> | null = null;

export function invalidateDashboard() {
  cache = null;
}

async function load(): Promise<LoadedData> {
  const { data, headers } = await getFile("data.php");
  const parsed = await parseWorkbook(data);
  const updated = headers.get("X-Data-Updated");
  return { ...parsed, updatedAt: updated ? new Date(updated) : null, stale: headers.get("X-Data-Stale") === "1" };
}

/** Loads and parses the dashboard Excel file for the signed-in user. */
export function useDashboard(): DashboardState & { reload: () => void } {
  const [state, setState] = useState<DashboardState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    cache ??= load();
    const current = cache;
    current
      .then((data) => {
        if (!cancelled) setState({ status: "ready", data });
      })
      .catch((e) => {
        if (cache === current) cache = null; // let a retry fetch again
        if (cancelled) return;
        if (e instanceof ApiError && e.status === 404) setState({ status: "empty", message: e.message });
        else if (e instanceof ApiError || e instanceof XlsxError) setState({ status: "error", message: e.message });
        else setState({ status: "error", message: "خواندن فایل داده ناموفق بود." });
      });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const reload = useCallback(() => {
    invalidateDashboard();
    setState({ status: "loading" });
    setAttempt((n) => n + 1);
  }, []);

  return { ...state, reload };
}
