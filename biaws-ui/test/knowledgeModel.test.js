import assert from "node:assert/strict";
import test from "node:test";

import {
  createEmptyDocumentDraft,
  documentStatusLabel,
  normalizeDocumentDraft,
} from "../src/components/knowledge/knowledgeModel.js";

const TYPES = {
  "business-rule": {
    defaultStatus: "draft",
    details: { ruleCode: "" },
    statuses: [["draft", "Rascunho"]],
    template: "## Regra",
  },
};

test("createEmptyDocumentDraft cria estado inicial determinístico", () => {
  const draft = createEmptyDocumentDraft(
    TYPES,
    "business-rule",
    "collection-1",
    () => new Date("2026-08-10T12:00:00Z"),
  );

  assert.equal(draft.definedAt, "2026-08-10");
  assert.equal(draft.collectionId, "collection-1");
  assert.equal(draft.markdown, "## Regra");
});

test("normalizeDocumentDraft preenche estruturas opcionais sem perder valores", () => {
  const draft = normalizeDocumentDraft(TYPES, {
    title: "Limite operacional",
    details: { ruleCode: "BR-1" },
  });

  assert.equal(draft.documentType, "business-rule");
  assert.equal(draft.details.ruleCode, "BR-1");
  assert.deepEqual(draft.references, []);
  assert.equal(documentStatusLabel(TYPES, draft), "Rascunho");
});
