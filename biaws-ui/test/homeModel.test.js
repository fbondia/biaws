import assert from "node:assert/strict";
import test from "node:test";

import {
  moveWidget,
  updateWidgetInstance,
  widgetTitle,
} from "../src/components/home/homeModel.js";

const widgets = [
  { id: "a", widgetId: "issues-period", config: { period: "week" } },
  { id: "b", widgetId: "pending-tasks", config: {} },
  { id: "c", widgetId: "application-health", config: {} },
];

test("home widgets can be reordered by instance id", () => {
  assert.deepEqual(
    moveWidget(widgets, "c", "a").map(({ id }) => id),
    ["c", "a", "b"],
  );
  assert.equal(moveWidget(widgets, "missing", "a"), widgets);
});

test("home widget updates preserve the other instances", () => {
  const updated = updateWidgetInstance(widgets, "c", {
    size: "large",
    config: { applicationId: "application-1" },
  });
  assert.equal(updated[0], widgets[0]);
  assert.equal(updated[2].size, "large");
  assert.equal(updated[2].config.applicationId, "application-1");
});

test("period widget title reflects each instance configuration", () => {
  const definition = { label: "Chamados no período" };
  assert.equal(widgetTitle(definition, widgets[0]), "Chamados na semana");
  assert.equal(
    widgetTitle(definition, {
      ...widgets[0],
      config: { period: "month" },
    }),
    "Chamados no mês",
  );
});
