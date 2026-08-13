import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_PREVIEW_SAMPLE,
  monitoringTemplateDraft,
  monitoringTemplatePayload,
  monitoringTemplatePreviewPayload,
  templateStatusLabel,
} from "../src/components/settings/MonitoringTemplatesView/model.js";

test("monitoring template drafts preserve immutable version definitions", () => {
  const draft = monitoringTemplateDraft({
    id: "template-1",
    name: "REST health",
    description: "Avalia o status HTTP",
    definition: {
      rules: [{ label: "ok", conditions: [], result: { status: "healthy" } }],
      defaultResult: { status: "unknown" },
    },
  });
  assert.equal(draft.id, "template-1");
  assert.deepEqual(
    monitoringTemplatePayload(draft).definition.rules[0].label,
    "ok",
  );
});

test("monitoring template preview parses a sanitized JSON sample", () => {
  const draft = monitoringTemplateDraft();
  const payload = monitoringTemplatePreviewPayload(
    draft,
    JSON.stringify(DEFAULT_PREVIEW_SAMPLE),
  );
  assert.equal(payload.sample.context.provider, "rest");
  assert.throws(
    () => monitoringTemplatePreviewPayload(draft, "not-json"),
    /A amostra contém JSON inválido/u,
  );
  assert.equal(templateStatusLabel("active"), "Ativo");
});
