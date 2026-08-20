import {
  createCatalogError,
  normalizeDate,
  normalizeEnum,
} from "./topologyRepositorySupport.js";

const DAY_MS = 86_400_000;
const DEFAULT_RANGE_MS = 30 * DAY_MS;
const DEFAULT_MAX_POINTS = 400;
const MIN_MAX_POINTS = 50;
const MAX_MAX_POINTS = 1_000;

const STATUS_LEVELS = Object.freeze({
  stopped: 0,
  unavailable: 1,
  degraded: 2,
  unknown: 3,
  healthy: 4,
});
const LEVEL_STATUSES = Object.freeze([
  "stopped",
  "unavailable",
  "degraded",
  "unknown",
  "healthy",
]);
const RESOLUTIONS = Object.freeze([
  { id: "1m", milliseconds: 60_000, binSize: 1, unit: "minute" },
  { id: "5m", milliseconds: 300_000, binSize: 5, unit: "minute" },
  { id: "15m", milliseconds: 900_000, binSize: 15, unit: "minute" },
  { id: "1h", milliseconds: 3_600_000, binSize: 1, unit: "hour" },
  { id: "6h", milliseconds: 21_600_000, binSize: 6, unit: "hour" },
  { id: "1d", milliseconds: DAY_MS, binSize: 1, unit: "day" },
  { id: "7d", milliseconds: 7 * DAY_MS, binSize: 7, unit: "day" },
  { id: "30d", milliseconds: 30 * DAY_MS, binSize: 30, unit: "day" },
]);

export const MONITORING_SUMMARY_RESOLUTIONS = Object.freeze([
  "auto",
  ...RESOLUTIONS.map(({ id }) => id),
]);

function dateOnly(value) {
  return /^\d{4}-\d{2}-\d{2}$/u.test(String(value || ""));
}

function inclusiveObservedTo(value, now) {
  const normalized = normalizeDate(value, "observedTo", now);
  if (!dateOnly(value)) return normalized;
  const inclusiveEnd = new Date(normalized);
  inclusiveEnd.setUTCDate(inclusiveEnd.getUTCDate() + 1);
  inclusiveEnd.setUTCMilliseconds(inclusiveEnd.getUTCMilliseconds() - 1);
  return inclusiveEnd;
}

function normalizeMaxPoints(value) {
  const normalized = Number(value ?? DEFAULT_MAX_POINTS);
  if (
    !Number.isInteger(normalized) ||
    normalized < MIN_MAX_POINTS ||
    normalized > MAX_MAX_POINTS
  ) {
    throw createCatalogError(
      422,
      "INVALID_MONITORING_SUMMARY",
      `maxPoints must be an integer from ${MIN_MAX_POINTS} to ${MAX_MAX_POINTS}`,
    );
  }
  return normalized;
}

function effectiveResolution(requested, rangeMilliseconds, maxPoints) {
  const minimumMilliseconds = Math.ceil(rangeMilliseconds / maxPoints);
  const automaticIndex = RESOLUTIONS.findIndex(
    ({ milliseconds }) => milliseconds >= minimumMilliseconds,
  );
  const safeAutomaticIndex =
    automaticIndex < 0 ? RESOLUTIONS.length - 1 : automaticIndex;
  if (requested === "auto") return RESOLUTIONS[safeAutomaticIndex];
  const requestedIndex = RESOLUTIONS.findIndex(({ id }) => id === requested);
  return RESOLUTIONS[Math.max(requestedIndex, safeAutomaticIndex)];
}

export function normalizeRuntimeMonitoringSummaryQuery(
  query = {},
  now = new Date(),
) {
  const observedTo = inclusiveObservedTo(query.observedTo, new Date(now));
  const observedFrom = normalizeDate(
    query.observedFrom,
    "observedFrom",
    new Date(observedTo.getTime() - DEFAULT_RANGE_MS),
  );
  if (observedFrom > observedTo) {
    throw createCatalogError(
      422,
      "INVALID_MONITORING_SUMMARY",
      "observedTo must be on or after observedFrom",
    );
  }
  const maxPoints = normalizeMaxPoints(query.maxPoints);
  const requestedResolution = normalizeEnum(
    query.resolution,
    "resolution",
    MONITORING_SUMMARY_RESOLUTIONS,
    "auto",
  );
  const resolution = effectiveResolution(
    requestedResolution,
    observedTo.getTime() - observedFrom.getTime() + 1,
    maxPoints,
  );

  return {
    maxPoints,
    observedFrom,
    observedTo,
    requestedResolution,
    resolution,
  };
}

function statusCountProjection(status) {
  return { $cond: [{ $eq: ["$status", status] }, 1, 0] };
}

function statusSeverityProjection() {
  return {
    $switch: {
      branches: Object.entries(STATUS_LEVELS).map(([status, level]) => ({
        case: { $eq: ["$status", status] },
        then: level,
      })),
      default: STATUS_LEVELS.unknown,
    },
  };
}

function seriesIdProjection() {
  return {
    $cond: [
      { $ne: [{ $ifNull: ["$monitorId", ""] }, ""] },
      { $concat: ["monitor:", "$monitorId"] },
      {
        $cond: [
          { $eq: ["$origin", "manual"] },
          "origin:manual",
          {
            $cond: [
              { $eq: ["$origin", "active"] },
              "origin:active",
              "origin:passive",
            ],
          },
        ],
      },
    ],
  };
}

function seriesLabelProjection() {
  return {
    $cond: [
      { $ne: [{ $ifNull: ["$monitorName", ""] }, ""] },
      "$monitorName",
      {
        $cond: [
          { $ne: [{ $ifNull: ["$monitorId", ""] }, ""] },
          { $concat: ["Monitor ", "$monitorId"] },
          {
            $cond: [
              { $eq: ["$origin", "manual"] },
              "Observações manuais",
              {
                $cond: [
                  { $eq: ["$origin", "active"] },
                  "Monitor ativo",
                  "Sinais passivos",
                ],
              },
            ],
          },
        ],
      },
    ],
  };
}

export function buildRuntimeMonitoringSummaryPipeline(filter, settings) {
  const { binSize, unit } = settings.resolution;
  return [
    { $match: filter },
    { $sort: { observedAt: 1, receivedAt: 1, id: 1 } },
    {
      $project: {
        monitorId: 1,
        monitorName: 1,
        observedAt: 1,
        origin: {
          $cond: [
            { $in: ["$origin", ["active", "manual"]] },
            "$origin",
            "passive",
          ],
        },
        severity: statusSeverityProjection(),
        status: 1,
      },
    },
    {
      $set: {
        seriesId: seriesIdProjection(),
        seriesLabel: seriesLabelProjection(),
      },
    },
    {
      $group: {
        _id: {
          bucket: {
            $dateTrunc: {
              date: "$observedAt",
              binSize,
              timezone: "UTC",
              unit,
            },
          },
          seriesId: "$seriesId",
        },
        degradedCount: { $sum: statusCountProjection("degraded") },
        eventCount: { $sum: 1 },
        healthyCount: { $sum: statusCountProjection("healthy") },
        label: { $last: "$seriesLabel" },
        monitorId: { $last: "$monitorId" },
        stoppedCount: { $sum: statusCountProjection("stopped") },
        unavailableCount: { $sum: statusCountProjection("unavailable") },
        unknownCount: { $sum: statusCountProjection("unknown") },
        worstSeverity: { $min: "$severity" },
      },
    },
    { $sort: { "_id.seriesId": 1, "_id.bucket": 1 } },
  ];
}

function emptyStatusCounts() {
  return Object.fromEntries(LEVEL_STATUSES.map((status) => [status, 0]));
}

function rowStatusCounts(row) {
  return {
    stopped: row.stoppedCount || 0,
    unavailable: row.unavailableCount || 0,
    degraded: row.degradedCount || 0,
    unknown: row.unknownCount || 0,
    healthy: row.healthyCount || 0,
  };
}

export function runtimeMonitoringSummaryResponse(runtime, settings, rows) {
  const seriesById = new Map();
  const statusCounts = emptyStatusCounts();
  let eventCount = 0;
  for (const row of rows) {
    const id = row._id.seriesId;
    if (!seriesById.has(id)) {
      seriesById.set(id, {
        id,
        label: row.label,
        ...(row.monitorId ? { monitorId: row.monitorId } : {}),
        points: [],
      });
    }
    const counts = rowStatusCounts(row);
    for (const status of LEVEL_STATUSES) {
      statusCounts[status] += counts[status];
    }
    eventCount += row.eventCount;
    const bucketStart = new Date(row._id.bucket);
    const bucketEnd = new Date(
      Math.min(
        bucketStart.getTime() + settings.resolution.milliseconds - 1,
        settings.observedTo.getTime(),
      ),
    );
    seriesById.get(id).points.push({
      eventCount: row.eventCount,
      observedAt: bucketStart.toISOString(),
      observedTo: bucketEnd.toISOString(),
      status: LEVEL_STATUSES[row.worstSeverity] || "unknown",
      statusCounts: counts,
    });
  }
  const series = [...seriesById.values()];
  return {
    meta: {
      bucketSeconds: settings.resolution.milliseconds / 1_000,
      eventCount,
      maxPoints: settings.maxPoints,
      observedFrom: settings.observedFrom.toISOString(),
      observedTo: settings.observedTo.toISOString(),
      pointCount: series.reduce((total, item) => total + item.points.length, 0),
      requestedResolution: settings.requestedResolution,
      resolution: settings.resolution.id,
      runtimeId: runtime.id,
      statusCounts,
    },
    series,
  };
}
