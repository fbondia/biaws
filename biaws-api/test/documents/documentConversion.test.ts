import assert from "node:assert/strict";
import test from "node:test";
import { documentConversionBodySchema } from "../../src/contracts/domainSchemas.js";
import {
  documentConversionPayload,
  incorporatedDocumentItem,
  conversionMarkdown,
} from "../../src/repositories/documents/conversionContent.js";
import { normalizeDocumentPayload } from "../../src/repositories/documents/normalization.js";
import { normalizeCatalogItems } from "../../src/repositories/documents/catalogItems.js";
import { documentTypeConfig } from "../../src/repositories/documents/types.js";

const rule = {
  id: "rule-one",
  workspaceId: "workspace-one",
  applicationId: "app-one",
  affectedComponentIds: [],
  documentType: "business-rule",
  title: "Condição comercial",
  summary: "Condições da oferta",
  markdown: "## Regra\n\nAplicar desconto.",
  status: "active",
  details: { ruleCode: "RN-01", effectiveFrom: "2026-10-18" },
};

test("explicit conversion retains Markdown and moves typed fields to the footer only when requested", () => {
  const append = documentConversionPayload(rule, { targetType: "free-text", additionalData: "append" });
  assert.ok(append.markdown.startsWith(rule.markdown));
  assert.match(append.markdown, /## Dados adicionais — Regra de negócio/u);
  assert.match(append.markdown, /\*\*Código da regra:\*\* RN-01/u);
  assert.equal(append.status, "published");
  assert.deepEqual(append.details, {});
  const discard = documentConversionPayload(rule, { targetType: "free-text", additionalData: "discard" });
  assert.equal(discard.markdown, rule.markdown);
  assert.throws(() => conversionMarkdown(rule, "unexpected"));
  assert.throws(() => documentConversionPayload(rule, { targetType: "business-rule", additionalData: "append" }));
  assert.throws(() =>
    documentConversionPayload({ ...rule, status: "archived" }, { targetType: "free-text", additionalData: "append" }),
  );
});

test("all target types receive valid default metadata and lifecycle states through explicit conversion", () => {
  for (const targetType of [
    "free-text",
    "catalog",
    "procedure",
    "feature",
    "guideline",
    "technical-reference",
    "architecture-decision",
  ]) {
    const converted = normalizeDocumentPayload(
      documentConversionPayload(rule, { targetType, additionalData: "discard" }),
      rule,
      { allowTypeChange: true },
    );
    assert.equal(converted.documentType, targetType);
    assert.ok(documentTypeConfig(targetType).statuses.includes(converted.status));
    assert.equal(converted.title, rule.title);
    assert.equal(converted.markdown, rule.markdown);
    if (targetType === "catalog") assert.deepEqual(converted.details, { items: [] });
  }
  assert.throws(
    () =>
      normalizeDocumentPayload(
        documentConversionPayload(rule, { targetType: "catalog", additionalData: "append" }),
        rule,
      ),
    /não pode ser alterado/u,
  );
  const guideline = documentConversionPayload(
    { ...rule, applicationId: null },
    { targetType: "guideline", additionalData: "discard" },
  );
  assert.equal(guideline.details.scope, "workspace");
});

test("catalog conversion appends or discards the entire item tree", () => {
  const catalog = {
    ...rule,
    documentType: "catalog",
    markdown: "Introdução",
    details: {
      items: [
        { id: "parent", title: "Serviço", description: "**Contrato**" },
        { id: "child", parentId: "parent", title: "Endpoint", description: "GET /status" },
      ],
    },
  };
  const kept = documentConversionPayload(catalog, { targetType: "free-text", additionalData: "append" });
  assert.match(kept.markdown, /### Serviço\n\n\*\*Contrato\*\*/u);
  assert.match(kept.markdown, /#### Endpoint\n\nGET \/status/u);
  assert.equal(
    documentConversionPayload(catalog, { targetType: "free-text", additionalData: "discard" }).markdown,
    "Introdução",
  );
});

test("incorporation produces a standalone catalog entry with an original-document link and stable identity", () => {
  const item = incorporatedDocumentItem({ ...rule, markdown: "Texto.\n\n![Imagem](attachment:file-one)" }, "append");
  assert.equal(item.title, rule.title);
  assert.equal(item.id, "document-rule-one");
  assert.match(item.description, /Dados adicionais/u);
  assert.match(item.description, /\[Imagem\]\(\/documents\/rule-one\?workspaceId=workspace-one\)/u);
  assert.match(item.description, /\[Documento original\]/u);
  assert.doesNotThrow(() => normalizeCatalogItems([item]));
  assert.equal(rule.documentType, "business-rule");
});

test("conversion HTTP contract requires an explicit data policy and rejects unsupported options", () => {
  assert.equal(
    documentConversionBodySchema.safeParse({
      targetType: "catalog",
      additionalData: "append",
      mode: "catalog-item",
      targetCatalogId: "target",
    }).success,
    true,
  );
  for (const payload of [
    { targetType: "catalog" },
    { targetType: "unknown", additionalData: "discard" },
    { targetType: "free-text", additionalData: "discard", allowTypeChange: true },
  ]) {
    assert.equal(documentConversionBodySchema.safeParse(payload).success, false);
  }
});
