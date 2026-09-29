import type { RepositoryQuery } from "../../../types/http.js";
import { SIGNAL_STATUSES } from "./constants.js";
import { createCatalogError } from "../../shared/topology/errors.js";
import {
  normalizeDate,
  normalizeEnum,
} from "../../shared/topology/normalization.js";
export function buildRuntimeMonitoringSignalFilter(
  runtime: { workspaceId: string; id: string },
  query: RepositoryQuery = {},
) {
  const filter: {
    workspaceId: string;
    runtimeId: string;
    status?: string;
    $or?: Array<{ origin: string | { $exists: false } }>;
    observedAt?: { $gte?: Date; $lt?: Date; $lte?: Date };
  } = {
    workspaceId: runtime.workspaceId,
    runtimeId: runtime.id,
  };
  if (query.status) {
    filter.status = normalizeEnum(query.status, "status", SIGNAL_STATUSES);
  }
  const observedFrom = normalizeDate(query.observedFrom, "observedFrom", null);
  const observedTo = normalizeDate(query.observedTo, "observedTo", null);
  if (observedFrom || observedTo) {
    const observedAt: NonNullable<typeof filter.observedAt> = {};
    filter.observedAt = observedAt;
    if (observedFrom) observedAt.$gte = observedFrom;
    if (observedTo) {
      if (/^\d{4}-\d{2}-\d{2}$/u.test(String(query.observedTo))) {
        const nextDay = new Date(observedTo);
        nextDay.setUTCDate(nextDay.getUTCDate() + 1);
        observedAt.$lt = nextDay;
      } else {
        observedAt.$lte = observedTo;
      }
    }
    const exclusiveUpperBound = observedAt.$lt;
    const inclusiveUpperBound = observedAt.$lte;
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
