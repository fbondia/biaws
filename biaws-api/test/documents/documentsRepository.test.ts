import { errorCode } from "../../src/helpers/error.js";
import assert from "node:assert/strict";
import test from "node:test";

import {
  DOCUMENT_TYPES,
  documentReplicationPayload,
  documentTypeConfig,
  normalizeDocumentPayload,
  restoredDocumentStatus,
} from "../../src/repositories/documents/index.js";

test("documents keep type-specific lifecycle states in one model", () => {
  assert.deepEqual(documentTypeConfig("business-rule").statuses, ["draft", "active", "retired", "archived"]);
  assert.deepEqual(documentTypeConfig("architecture-decision").statuses, [
    "proposed",
    "accepted",
    "rejected",
    "superseded",
    "archived",
  ]);
  assert.deepEqual(documentTypeConfig("procedure").statuses, ["draft", "published", "deprecated", "archived"]);
  assert.equal(Object.keys(DOCUMENT_TYPES).length, 8);
});

test("document restoration preserves its previous status with a safe fallback", () => {
  assert.equal(
    restoredDocumentStatus({
      documentType: "procedure",
      archivedFromStatus: "published",
    }),
    "published",
  );
  assert.equal(restoredDocumentStatus({ documentType: "procedure" }), "draft");
});

test("document payload normalizes its common envelope and typed details", () => {
  const document = normalizeDocumentPayload({
    identifier: "quality-tests",
    documentType: "guideline",
    title: "Testes semânticos",
    summary: "Orienta a escrita de testes legíveis em termos do domínio.",
    markdown: "# Testes\n\nUse ações do domínio.",
    details: { scope: "workspace", enforcement: "required" },
    source: {
      mode: "repository",
      repositoryId: "manura-docs",
      path: "guidelines/testing.md",
    },
    references: [{ targetDocumentId: "doc-1", relationship: "supported-by" }],
    definedAt: "2026-08-08",
  });

  assert.equal(document.schemaVersion, 1);
  assert.equal(document.identifier, "quality-tests");
  assert.equal(document.details.scope, "workspace");
  assert.equal(document.source.mode, "repository");
  assert.deepEqual(document.references, [{ targetDocumentId: "doc-1", relationship: "supported-by" }]);
  assert.deepEqual(document.classification, {
    primaryTaxonomyId: "",
    secondaryTaxonomyIds: [],
    tags: {},
  });
});

test("procedures use the document envelope with common classification", () => {
  const document = normalizeDocumentPayload({
    documentType: "procedure",
    title: "Publicar API",
    summary: "Executa a publicação com validação e rollback.",
    markdown: "# Publicação",
    status: "published",
    classification: {
      primaryTaxonomyId: "deploy",
      secondaryTaxonomyIds: ["operation", "deploy"],
      tags: { criticality: ["high"] },
    },
  });
  assert.deepEqual(document.details, {});
  assert.deepEqual(document.classification, {
    primaryTaxonomyId: "deploy",
    secondaryTaxonomyIds: ["operation"],
    tags: { criticality: ["high"] },
  });
});

test("document type is immutable and validates type-specific status", () => {
  const current = normalizeDocumentPayload({
    documentType: "feature",
    title: "Workflow",
    summary: "Motor de estados do produto.",
    markdown: "# Workflow",
    status: "published",
  });
  assert.throws(
    () => normalizeDocumentPayload({ documentType: "guideline" }, { ...current, documentType: "feature" }),
    /não pode ser alterado/u,
  );
  assert.throws(
    () =>
      normalizeDocumentPayload({
        documentType: "feature",
        title: "Workflow",
        summary: "Motor de estados do produto.",
        markdown: "# Workflow",
        status: "accepted",
      }),
    /status inválido/u,
  );
});

test("document references require unified document ids", () => {
  const document = normalizeDocumentPayload({
    documentType: "business-rule",
    title: "Uma regra",
    summary: "Resumo da regra.",
    markdown: "# Regra",
    references: [
      {
        targetDocumentId: "decision-1",
        relationship: "supported-by",
      },
    ],
  });
  assert.deepEqual(document.references, [{ targetDocumentId: "decision-1", relationship: "supported-by" }]);
});

test("document replication copies its identifier and replaceable content", () => {
  const source = {
    identifier: "publish-api",
    documentType: "guideline",
    title: "Publicar API",
    summary: "Executa a publicação.",
    markdown: "# Publicação",
    applicationId: "app-1",
    affectedComponentIds: ["component-1"],
    collectionId: "deploy",
    classification: { primaryTaxonomyId: "operations" },
    references: [{ targetDocumentId: "doc-2", relationship: "related" }],
  };
  const copy = documentReplicationPayload(source);

  assert.deepEqual(copy, {
    identifier: "publish-api",
    title: "Publicar API",
    summary: "Executa a publicação.",
    markdown: "# Publicação",
  });
  assert.equal(
    normalizeDocumentPayload({
      ...copy,
      documentType: source.documentType,
    }).details.scope,
    "workspace",
  );
});

test("document identifier is optional, editable and validated", () => {
  const current = normalizeDocumentPayload({
    identifier: "first-identifier",
    documentType: "guideline",
    title: "Primeira versão",
    summary: "Resumo inicial.",
    markdown: "# Inicial",
  });
  const updated = normalizeDocumentPayload({ identifier: "second-identifier" }, current);
  assert.equal(updated.identifier, "second-identifier");
  assert.equal(
    normalizeDocumentPayload({
      documentType: "guideline",
      title: "Sem identificador",
      summary: "Continua sendo um documento válido.",
      markdown: "# Sem identificador",
    }).identifier,
    null,
  );
  assert.throws(
    () => normalizeDocumentPayload({ ...current, identifier: "Inválido id" }),
    (error) => errorCode(error) === "INVALID_RESOURCE_IDENTIFIER",
  );
});

test("free text has no typed metadata and derives its summary from Markdown", () => {
  const document = normalizeDocumentPayload({
    documentType: "free-text",
    title: "Notas da equipe",
    markdown: "## Ideias\n\nUma anotação **livre**.",
    summary: "",
  });
  assert.deepEqual(document.details, {});
  assert.equal(document.summary, "Ideias Uma anotação livre .");
  assert.equal(document.status, "draft");
  assert.equal(documentTypeConfig("free-text").applicationRequired, false);
});

test("catalogs save structured entries without requiring an introduction or summary", () => {
  const document = normalizeDocumentPayload({
    documentType: "catalog",
    title: "Serviços",
    details: { items: [{ title: " API ", description: " **Contrato**\n\nGET /status " }] },
  });
  const items = document.details.items;
  assert.ok(Array.isArray(items));
  assert.match(items[0].id, /^[a-f\d-]{36}$/u);
  assert.equal(items[0].title, "API");
  assert.equal(items[0].description, "**Contrato**\n\nGET /status");
  assert.equal(document.markdown, "");
  assert.ok(document.summary.includes("Contrato"));
  assert.equal(documentTypeConfig("catalog").applicationRequired, false);
  const renamed = normalizeDocumentPayload({ title: "Serviços internos" }, document);
  assert.deepEqual(renamed.details.items, items);
  const cleared = normalizeDocumentPayload({ details: { items: [] } }, renamed);
  assert.deepEqual(cleared.details.items, []);
  assert.equal(normalizeDocumentPayload({ documentType: "catalog", title: "Vazio" }).summary, "Vazio");
});

test("catalog entries require valid title, Markdown description and unique stable IDs", () => {
  const validItem = { id: "api", title: "API", description: "# Contrato" };
  for (const items of [
    null,
    {},
    [null],
    [{ title: "", description: "Texto" }],
    [{ title: "x".repeat(241), description: "Texto" }],
    [{ title: "API", description: "  " }],
    [{ title: "API", description: {} }],
    [{ ...validItem, id: "" }],
    [validItem, validItem],
    Array(501).fill(validItem),
  ]) {
    assert.throws(
      () => normalizeDocumentPayload({ documentType: "catalog", title: "Serviços", details: { items } }),
      (error) => errorCode(error) === "INVALID_DOCUMENT_DETAILS",
    );
  }
});

test("replication preserves catalog entries and flattens them when the destination has another type", () => {
  const document = normalizeDocumentPayload({
    documentType: "catalog",
    title: "Catálogo",
    details: { items: [{ id: "api", title: "API", description: "**Contrato**" }] },
  });
  const copy = documentReplicationPayload(document);
  assert.deepEqual(copy.details, document.details);
  assert.deepEqual(documentReplicationPayload(document, document).details, document.details);
  const converted = documentReplicationPayload(document, { documentType: "free-text" });
  assert.equal(converted.markdown, "## API\n\n**Contrato**");
  assert.equal(converted.details, undefined);
});
