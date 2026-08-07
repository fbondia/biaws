import assert from "node:assert/strict";
import test from "node:test";

import {
  knowledgeRecordConfig,
  normalizeKnowledgeRecordPayload,
} from "../src/repositories/knowledgeRecordsRepository.js";

test("knowledge record types preserve distinct lifecycle states", () => {
  assert.deepEqual(knowledgeRecordConfig("business-rules").statuses, [
    "draft",
    "active",
    "retired",
    "archived",
  ]);
  assert.deepEqual(knowledgeRecordConfig("architecture-decisions").statuses, [
    "proposed",
    "accepted",
    "rejected",
    "superseded",
    "archived",
  ]);
});

test("knowledge payload keeps markdown, dates and typed references structured", () => {
  const payload = normalizeKnowledgeRecordPayload("business-rules", {
    title: "Contrato ativo",
    markdown: "# Regra\n\nO contrato deve estar ativo.",
    status: "active",
    definedAt: "2026-08-07",
    lastReviewedAt: "2026-08-07",
    nextReviewAt: "2027-02-07",
    updatedBy: "operator@example.com",
    references: [
      {
        targetType: "architecture-decisions",
        targetId: "decision-1",
        relationship: "supported-by",
      },
    ],
  });

  assert.equal(payload.reviewedBy, "operator@example.com");
  assert.deepEqual(payload.references, [
    {
      targetType: "architecture-decisions",
      targetId: "decision-1",
      relationship: "supported-by",
    },
  ]);
});

test("knowledge payload rejects invalid lifecycle, dates and duplicate references", () => {
  const base = {
    title: "Regra",
    markdown: "Conteúdo",
    definedAt: "2026-08-07",
  };
  assert.throws(
    () =>
      normalizeKnowledgeRecordPayload("business-rules", {
        ...base,
        status: "accepted",
      }),
    /status inválido/u,
  );
  assert.throws(
    () =>
      normalizeKnowledgeRecordPayload("business-rules", {
        ...base,
        nextReviewAt: "2026-02-30",
      }),
    /data inválida/u,
  );
  const reference = {
    targetType: "business-rules",
    targetId: "rule-1",
    relationship: "related",
  };
  assert.throws(
    () =>
      normalizeKnowledgeRecordPayload("business-rules", {
        ...base,
        references: [reference, reference],
      }),
    /Referência duplicada/u,
  );
});
