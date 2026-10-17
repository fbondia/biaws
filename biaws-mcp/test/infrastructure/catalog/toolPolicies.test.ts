import assert from "node:assert/strict";
import test from "node:test";
import { listTools, dispatchTool } from "../../../src/mcp/tools/tools.js";
import { toolDefinitions } from "../../../src/mcp/tools/toolCatalog.js";
import { toolPolicies } from "../../../src/mcp/tools/toolPolicies.js";
import { runWithRequestContext } from "../../../src/runtime/requestContext.js";
import { connectTestServer } from "../../helpers/sdk.js";

test("catalog policies cover every tool explicitly with meaningful effect hints", () => {
  assert.deepEqual(Object.keys(toolPolicies).sort(), toolDefinitions.map((t) => t.name).sort());
  for (const tool of listTools()) {
    assert.ok(tool.description.length > 20);
    const legacyFilterTools = ["issues_search", "issues_summary", "issues_aggregate"];
    assert.equal(tool.inputSchema.additionalProperties, legacyFilterTools.includes(tool.name), tool.name);
    assert.equal(typeof tool.annotations?.readOnlyHint, "boolean", tool.name);
    assert.equal(typeof tool.annotations?.destructiveHint, "boolean", tool.name);
    assert.equal(typeof tool.annotations?.openWorldHint, "boolean", tool.name);
    assert.ok(toolPolicies[tool.name as keyof typeof toolPolicies].reason.length > 30);
  }
  assert.equal(toolPolicies.monitoring_templates_validate.annotations.readOnlyHint, true);
  assert.equal(toolPolicies.issues_import_eml.annotations.readOnlyHint, false);
  assert.equal(toolPolicies.runtime_active_monitors_create.annotations.openWorldHint, true);
  assert.equal(toolPolicies.deployments_record_publication.annotations.openWorldHint, false);
});
test("HTTP hides and rejects local path tools while stdio preserves their contracts", async () => {
  assert.ok(listTools().some((t) => t.name === "issues_analyze_eml_file"));
  await runWithRequestContext({ transport: "http" }, async () => {
    const catalog = listTools();
    assert.equal(
      catalog.some((t) => t.name === "issues_analyze_eml_file"),
      false,
    );
    assert.ok(catalog.some((t) => t.name === "issues_import_eml"));
    assert.ok(catalog.some((t) => t.name === "attachments_download"));
    await assert.rejects(dispatchTool("issues_analyze_eml_file", { filePath: "/run/secrets/arbitrary.eml" }), {
      code: "LOCAL_CLIENT_REQUIRED",
    });
    await assert.rejects(dispatchTool("issues_import_eml_file", {}), { code: "LOCAL_CLIENT_REQUIRED" });
  });
});
test("official SDK exposes annotations and server instructions", async (t) => {
  const session = await connectTestServer();
  t.after(() => session.close());
  const catalog = await session.client.listTools();
  assert.match(session.client.getInstructions() || "", /consented workspace/);
  assert.equal(catalog.tools.find((t) => t.name === "issues_search")?.annotations?.readOnlyHint, true);
  assert.equal(catalog.tools.find((t) => t.name === "issues_delete_comment")?.annotations?.destructiveHint, true);
});
