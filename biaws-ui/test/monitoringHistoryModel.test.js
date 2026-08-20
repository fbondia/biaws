import assert from "node:assert/strict";
import test from "node:test";

import {
  monitoringHealthSummaryCaption,
  monitoringHealthStatusLabel,
  monitoringHealthTimeline,
} from "../src/components/monitoring/components/MonitoringHealthTimeline/model.js";

test("monitoring health timeline combines compact API series and orders points", () => {
  const timeline = monitoringHealthTimeline(
    {
      meta: { eventCount: 18, pointCount: 3, resolution: "1h" },
      series: [
        {
          id: "monitor:database",
          label: "Database",
          monitorId: "database",
          points: [
            {
              eventCount: 3,
              observedAt: "2026-08-20T12:00:00.000Z",
              status: "degraded",
            },
          ],
        },
        {
          id: "monitor:http",
          label: "HTTP original",
          monitorId: "http",
          points: [
            {
              eventCount: 10,
              observedAt: "2026-08-20T10:00:00.000Z",
              status: "healthy",
            },
            {
              eventCount: 5,
              observedAt: "2026-08-20T11:00:00.000Z",
              status: "unavailable",
            },
          ],
        },
      ],
    },
    [
      { id: "http", name: "HTTP" },
      { id: "database", name: "Banco" },
    ],
  );

  assert.deepEqual(
    timeline.series.map(({ id, label }) => ({ id, label })),
    [
      { id: "monitor:database", label: "Banco" },
      { id: "monitor:http", label: "HTTP" },
    ],
  );
  assert.deepEqual(
    timeline.points.map(({ timestamp, ...statuses }) => ({
      statuses,
      timestamp: new Date(timestamp).toISOString(),
    })),
    [
      {
        statuses: { series1: 4, series1EventCount: 10 },
        timestamp: "2026-08-20T10:00:00.000Z",
      },
      {
        statuses: { series1: 1, series1EventCount: 5 },
        timestamp: "2026-08-20T11:00:00.000Z",
      },
      {
        statuses: { series0: 2, series0EventCount: 3 },
        timestamp: "2026-08-20T12:00:00.000Z",
      },
    ],
  );
});

test("monitoring health timeline ignores invalid compact points and describes aggregation", () => {
  const timeline = monitoringHealthTimeline({
    meta: { eventCount: 1, pointCount: 1, resolution: "6h" },
    series: [
      {
        id: "origin:manual",
        label: "Observações manuais",
        points: [
          {
            eventCount: 1,
            observedAt: "2026-08-20T10:00:00.000Z",
            status: "stopped",
          },
          { observedAt: "invalid", status: "healthy" },
          { observedAt: "2026-08-20T11:00:00.000Z", status: "unsupported" },
        ],
      },
    ],
  });

  assert.equal(timeline.series[0].label, "Observações manuais");
  assert.equal(timeline.points[0].series0, 0);
  assert.equal(monitoringHealthStatusLabel(0), "Parado");
  assert.equal(monitoringHealthStatusLabel(4), "Saudável");
  assert.equal(
    monitoringHealthSummaryCaption(timeline.meta),
    "1 evento resumido em 1 ponto, com resolução 6h.",
  );
});
