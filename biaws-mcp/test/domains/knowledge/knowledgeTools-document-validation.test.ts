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
