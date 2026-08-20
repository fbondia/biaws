import assert from "node:assert/strict";
import test from "node:test";

import {
  formatMonitoringValue,
  monitoringPresentationFields,
  monitoringPresentationSeries,
  monitoringStatusTone,
} from "../src/components/monitoring/components/MonitoringEventDetails/model.js";

const event = {
  metadata: {
    service_up: true,
    disk_usage_percent: 73.42,
    error_history_dates: ["2026-08-01", "2026-08-02"],
    error_history_values: [1024, 2048],
    error_history_unit: "bytes",
  },
  metadataPresentation: {
    fields: [
      { key: "service_up", label: "Serviço", format: "status" },
      {
        key: "disk_usage_percent",
        label: "Disco",
        format: "percent",
      },
      { key: "missing", label: "Ausente", format: "text" },
    ],
    series: [
      {
        label: "Erros",
        xKey: "error_history_dates",
        xFormat: "date",
        yKey: "error_history_values",
        yFormatKey: "error_history_unit",
      },
    ],
  },
};

test("monitoring presentation resolves only fields present in metadata", () => {
  const fields = monitoringPresentationFields(event);
  assert.deepEqual(
    fields.map(({ key }) => key),
    ["service_up", "disk_usage_percent"],
  );
  assert.equal(
    formatMonitoringValue(fields[1].value, fields[1].format),
    "73,42%",
  );
  assert.equal(monitoringStatusTone(fields[0].value), "healthy");
});

test("monitoring presentation combines aligned arrays into a typed series", () => {
  const [series] = monitoringPresentationSeries(event);
  assert.equal(series.yFormat, "bytes");
  assert.deepEqual(series.data, [
    { x: "2026-08-01", y: 1024 },
    { x: "2026-08-02", y: 2048 },
  ]);
  assert.equal(
    formatMonitoringValue(series.data[1].y, series.yFormat),
    "2 KiB",
  );
});
