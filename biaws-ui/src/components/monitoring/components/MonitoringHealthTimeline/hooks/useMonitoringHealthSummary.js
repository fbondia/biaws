import { useEffect, useState } from "react";

import { fetchRuntimeMonitoringHealthSummary } from "../../../../../api.js";

export function useMonitoringHealthSummary({
  maxPoints = 400,
  observedFrom,
  observedTo,
  resolution = "auto",
  runtimeId,
  status,
}) {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(Boolean(runtimeId));
  const [error, setError] = useState("");

  useEffect(() => {
    if (!runtimeId) {
      setSummary(null);
      setLoading(false);
      setError("");
      return undefined;
    }
    let active = true;
    setLoading(true);
    setError("");
    void fetchRuntimeMonitoringHealthSummary(runtimeId, {
      maxPoints,
      observedFrom,
      observedTo,
      resolution,
      status,
    })
      .then((payload) => {
        if (active) setSummary(payload);
      })
      .catch((loadError) => {
        if (active) setError(loadError.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [maxPoints, observedFrom, observedTo, resolution, runtimeId, status]);

  return { error, loading, summary };
}
