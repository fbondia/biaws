import assert from "node:assert/strict";
import test from "node:test";

import {
  createEmptyDocumentDraft,
  documentStatusLabel,
  fetchAllDocumentPages,
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
  assert.equal(draft.identifier, "");
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

test("fetchAllDocumentPages consolida todas as páginas da listagem", async () => {
  const calls = [];
  const payload = await fetchAllDocumentPages(
    async (params) => {
      calls.push(params);
      return {
        meta: { page: params.page, total: 205, totalPages: 3 },
        items:
          params.page === 1
            ? [{ id: "document-1" }]
            : params.page === 2
              ? [{ id: "document-2" }]
              : [{ id: "document-3" }],
      };
    },
    { documentType: "business-rule" },
  );

  assert.deepEqual(calls, [
    { documentType: "business-rule", limit: 100, page: 1 },
    { documentType: "business-rule", limit: 100, page: 2 },
    { documentType: "business-rule", limit: 100, page: 3 },
  ]);
  assert.deepEqual(
    payload.items.map(({ id }) => id),
    ["document-1", "document-2", "document-3"],
  );
  assert.equal(payload.meta.total, 205);
  assert.equal(payload.meta.totalPages, 3);
});
