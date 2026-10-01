import assert from "node:assert/strict";
import test from "node:test";

import { reconcileClassificationDraft } from "../src/components/issues/IssueDetailsDialog/model.js";

const previous = { primaryTaxonomyId: "support", secondaryTaxonomyIds: [], summary: "Resumo anterior", tags: {} };

test("saving the summary preserves pending classification changes", () => {
  const draft = { ...previous, primaryTaxonomyId: "incident", tags: { severity: ["high"] }, summary: "Novo resumo" };
  const saved = { ...previous, summary: "Novo resumo" };
  assert.deepEqual(reconcileClassificationDraft(draft, { ...previous, summary: draft.summary }, saved), draft);
  assert.deepEqual(reconcileClassificationDraft(draft, previous, saved), draft);
});

test("saving classification preserves a summary edited during the request", () => {
  const submitted = { ...previous, primaryTaxonomyId: "incident" };
  const draft = { ...submitted, summary: "Resumo ainda em edição" };
  assert.deepEqual(reconcileClassificationDraft(draft, submitted, submitted), draft);
});

test("a clean draft accepts updated persisted values", () => {
  const saved = { ...previous, summary: "Resumo atualizado", tags: { severity: ["low"] } };
  assert.deepEqual(reconcileClassificationDraft(previous, previous, saved), saved);
});
