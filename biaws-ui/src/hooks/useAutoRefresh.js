import { useEffect, useRef } from "react";

const DEFAULT_REFRESH_SECONDS = 30;
const MINIMUM_REFRESH_SECONDS = 5;

export function monitoringRefreshIntervalMs(env = import.meta.env) {
  const configured = Number(env?.VITE_MONITORING_REFRESH_SECONDS);
  const seconds = Number.isFinite(configured)
    ? Math.max(MINIMUM_REFRESH_SECONDS, configured)
    : DEFAULT_REFRESH_SECONDS;
  return seconds * 1_000;
}

export const MONITORING_REFRESH_INTERVAL_MS = monitoringRefreshIntervalMs();

export function useAutoRefresh(
  refresh,
  { enabled = true, intervalMs = MONITORING_REFRESH_INTERVAL_MS } = {},
) {
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;

  useEffect(() => {
    if (!enabled || intervalMs <= 0) return undefined;
    let disposed = false;
    let timer;
    let running = false;

    const schedule = () => {
      if (!disposed) timer = window.setTimeout(run, intervalMs);
    };
    const run = async () => {
      if (disposed || running) return;
      if (document.visibilityState === "hidden") {
        schedule();
        return;
      }
      running = true;
      try {
        await refreshRef.current();
      } catch {
        // The owning view exposes refresh failures without stopping the cycle.
      } finally {
        running = false;
        schedule();
      }
    };
    const handleVisibility = () => {
      if (document.visibilityState !== "visible" || running) return;
      window.clearTimeout(timer);
      void run();
    };

    schedule();
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      disposed = true;
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [enabled, intervalMs]);
}
