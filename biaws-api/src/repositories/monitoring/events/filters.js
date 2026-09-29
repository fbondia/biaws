import { SIGNAL_STATUSES } from "./constants.js";
import { createCatalogError } from "../../shared/topology/errors.js";
import {
  normalizeDate,
  normalizeEnum,
} from "../../shared/topology/normalization.js";

export function buildRuntimeMonitoringSignalFilter(runtime, query = {}) {
  const filter = {
    workspaceId: runtime.workspaceId,
    runtimeId: runtime.id,
  };
  if (query.status) {
    filter.status = normalizeEnum(query.status, "status", SIGNAL_STATUSES);
  }
  const observedFrom = normalizeDate(query.observedFrom, "observedFrom", null);
  const observedTo = normalizeDate(query.observedTo, "observedTo", null);
  if (observedFrom || observedTo) {
    filter.observedAt = {};
    if (observedFrom) filter.observedAt.$gte = observedFrom;
    if (observedTo) {
      if (/^\d{4}-\d{2}-\d{2}$/u.test(String(query.observedTo))) {
        const nextDay = new Date(observedTo);
        nextDay.setUTCDate(nextDay.getUTCDate() + 1);
        filter.observedAt.$lt = nextDay;
      } else {
        filter.observedAt.$lte = observedTo;
      }
    }
    const exclusiveUpperBound = filter.observedAt.$lt;
    const inclusiveUpperBound = filter.observedAt.$lte;
    if (
      observedFrom &&
      ((exclusiveUpperBound && observedFrom >= exclusiveUpperBound) ||
        (inclusiveUpperBound && observedFrom > inclusiveUpperBound))
    ) {
      throw createCatalogError(
        422,
        "INVALID_MONITORING_FILTER",
        "observedTo must be on or after observedFrom",
      );
    }
  }
  return filter;
}
