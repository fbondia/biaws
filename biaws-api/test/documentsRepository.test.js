import assert from "node:assert/strict";
import test from "node:test";

import {
  DOCUMENT_TYPES,
  documentReplicationPayload,
  documentTypeConfig,
  normalizeDocumentPayload,
} from "../src/repositories/documentsRepository.js";

test("documents keep type-specific lifecycle states in one model", () => {
  assert.deepEqual(documentTypeConfig("business-rule").statuses, [
    "draft",
    "active",
    "retired",
    "archived",
  ]);
  assert.deepEqual(documentTypeConfig("architecture-decision").statuses, [
    "proposed",
    "accepted",
    "rejected",
    "superseded",
    "archived",
  ]);
  assert.deepEqual(documentTypeConfig("procedure").statuses, [
    "draft",
    "published",
    "deprecated",
    "archived",
  ]);
  assert.equal(Object.keys(DOCUMENT_TYPES).length, 6);
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
  assert.deepEqual(document.references, [
    { targetDocumentId: "doc-1", relationship: "supported-by" },
  ]);
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
    () =>
      normalizeDocumentPayload(
        { documentType: "guideline" },
        { ...current, documentType: "feature" },
      ),
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
  assert.deepEqual(document.references, [
    { targetDocumentId: "decision-1", relationship: "supported-by" },
  ]);
});

test("document replication copies its identifier and replaceable content", () => {
  const copy = documentReplicationPayload({
    identifier: "publish-api",
    documentType: "procedure",
    title: "Publicar API",
    summary: "Executa a publicação.",
    markdown: "# Publicação",
    applicationId: "app-1",
    affectedComponentIds: ["component-1"],
    collectionId: "deploy",
    classification: { primaryTaxonomyId: "operations" },
    references: [{ targetDocumentId: "doc-2", relationship: "related" }],
  });

  assert.deepEqual(copy, {
    identifier: "publish-api",
    title: "Publicar API",
    summary: "Executa a publicação.",
    markdown: "# Publicação",
  });
});

test("document identifier is optional, editable and validated", () => {
  const current = normalizeDocumentPayload({
    identifier: "first-identifier",
    documentType: "guideline",
    title: "Primeira versão",
    summary: "Resumo inicial.",
    markdown: "# Inicial",
  });
  const updated = normalizeDocumentPayload(
    { identifier: "second-identifier" },
    current,
  );
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
    (error) => error.code === "INVALID_RESOURCE_IDENTIFIER",
  );
});
