import assert from "node:assert/strict";
import test from "node:test";
import { dispatchTool } from "../../../src/mcp/tools/tools.js";
import { errorInfo, fieldErrors } from "../../helpers/types.js";
test("document creation validates its discriminated contract before HTTP", async () => {
  await assert.rejects(
    dispatchTool("documents_create", {
      documentType: "business-rule",
      title: "Rule",
      summary: "Summary",
      markdown: "# Rule",
    }),
    (error) =>
      errorInfo(error).code === "VALIDATION_ERROR" && fieldErrors(error).some(({ path }) => path === "applicationId"),
  );
  await assert.rejects(
    dispatchTool("documents_create", {
      documentType: "guideline",
      title: "Guideline",
      summary: "Summary",
      markdown: "# Guideline",
      applicationId: "app-1",
      details: { scope: "workspace", enforcement: "recommended" },
    }),
    (error) => errorInfo(error).code === "VALIDATION_ERROR",
  );
  await assert.rejects(
    dispatchTool("documents_create", {
      documentType: "technical-reference",
      title: "Reference",
      summary: "Summary",
      markdown: "# Reference",
      source: { mode: "repository" },
    }),
    (error) =>
      errorInfo(error).code === "VALIDATION_ERROR" &&
      fieldErrors(error).some(({ path }) => path === "source.repositoryId"),
  );
});

test("new document types validate catalog entries and preserve existing Markdown requirements", async () => {
  const { knowledgeTools } = await import("../../../src/domains/knowledge/tools.js");
  const { validateArguments } = await import("../../../src/mcp/tools/validation.js");
  const { required } = await import("../../helpers/types.js");
  const create = required(knowledgeTools.find(({ name }) => name === "documents_create"));
  assert.doesNotThrow(() =>
    validateArguments(create, {
      documentType: "free-text",
      title: "Notas",
      markdown: "Texto livre",
    }),
  );
  for (const application of [{}, { applicationId: "app-1", affectedComponentIds: ["component-1"] }]) {
    assert.doesNotThrow(() =>
      validateArguments(create, {
        documentType: "catalog",
        title: "Serviços",
        ...application,
        details: { items: [{ title: "API", description: "**Contrato**" }] },
      }),
    );
  }
  assert.doesNotThrow(() =>
    validateArguments(create, {
      documentType: "catalog",
      title: "Serviços",
      details: {
        items: [
          { title: "API", hideDescription: true },
          { title: "Worker", description: "" },
        ],
      },
    }),
  );
  for (const payload of [
    { documentType: "catalog", title: "Inválido", details: { items: [{ title: "API", description: {} }] } },
    { documentType: "catalog", title: "Inválido", details: { items: "texto" } },
    { documentType: "catalog", title: "Inválido", affectedComponentIds: ["sem-aplicação"] },
    { documentType: "free-text", title: "Sem conteúdo", markdown: "" },
    { documentType: "procedure", title: "Sem conteúdo", summary: "Resumo" },
  ]) {
    assert.throws(
      () => validateArguments(create, payload),
      (error) => errorInfo(error).code === "VALIDATION_ERROR",
    );
  }
});
