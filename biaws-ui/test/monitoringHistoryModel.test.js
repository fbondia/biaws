import assert from "node:assert/strict";
import test from "node:test";

import {
  monitoringHealthStatusLabel,
  monitoringHealthTimeline,
} from "../src/components/monitoring/components/MonitoringHealthTimeline/model.js";

test("monitoring health timeline groups events by monitor and orders them", () => {
  const timeline = monitoringHealthTimeline(
    [
      {
        monitorId: "database",
        observedAt: "2026-08-20T12:00:00.000Z",
        status: "degraded",
      },
      {
        monitorId: "http",
        observedAt: "2026-08-20T10:00:00.000Z",
        status: "healthy",
      },
      {
        monitorId: "http",
        observedAt: "2026-08-20T11:00:00.000Z",
        status: "unavailable",
      },
    ],
    [
      { id: "http", name: "HTTP" },
      { id: "database", name: "Banco" },
    ],
  );

  assert.deepEqual(
    timeline.series.map(({ id, label }) => ({ id, label })),
    [
      { id: "monitor:http", label: "HTTP" },
      { id: "monitor:database", label: "Banco" },
    ],
  );
  assert.deepEqual(
    timeline.points.map(({ timestamp, ...statuses }) => ({
      statuses,
      timestamp: new Date(timestamp).toISOString(),
    })),
    [
      {
        statuses: { series0: 4 },
        timestamp: "2026-08-20T10:00:00.000Z",
      },
      {
        statuses: { series0: 1 },
        timestamp: "2026-08-20T11:00:00.000Z",
      },
      {
        statuses: { series1: 2 },
        timestamp: "2026-08-20T12:00:00.000Z",
      },
    ],
  );
});

test("monitoring health timeline keeps manual observations and ignores invalid events", () => {
  const timeline = monitoringHealthTimeline([
    {
      observedAt: "2026-08-20T10:00:00.000Z",
      origin: "manual",
      status: "stopped",
    },
    { observedAt: "invalid", status: "healthy" },
    { observedAt: "2026-08-20T11:00:00.000Z", status: "unsupported" },
  ]);

  assert.equal(timeline.series[0].label, "Observações manuais");
  assert.equal(timeline.points[0].series0, 0);
  assert.equal(monitoringHealthStatusLabel(0), "Parado");
  assert.equal(monitoringHealthStatusLabel(4), "Saudável");
});
