import assert from "node:assert/strict";
import test from "node:test";

import { knowledgeTools } from "../src/domains/knowledge/tools.js";
import { dispatchTool, listTools } from "../src/tools.js";

function jsonResponse(payload = { ok: true }, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

test("knowledge tools expose bounded typed schemas", () => {
  const names = knowledgeTools.map(({ name }) => name);
  assert.equal(names.includes("knowledge_context_load"), true);
  assert.equal(names.includes("business_rules_create"), true);
  assert.equal(names.includes("architecture_decisions_update"), true);
  assert.equal(new Set(names).size, names.length);

  const registered = new Set(listTools().map(({ name }) => name));
  for (const tool of knowledgeTools) {
    assert.equal(tool.inputSchema.additionalProperties, false, tool.name);
    assert.equal(registered.has(tool.name), true, tool.name);
  }

  const create = knowledgeTools.find(
    ({ name }) => name === "business_rules_create",
  );
  assert.deepEqual(create.inputSchema.required, [
    "title",
    "markdown",
    "applicationId",
  ]);
  assert.equal(create.inputSchema.properties.references.maxItems, 100);
});

test("knowledge context loader fetches active rules and accepted decisions", async () => {
  const originalFetch = globalThis.fetch;
  const originalBaseUrl = process.env.ISSUE_API_URL;
  process.env.ISSUE_API_URL = "http://api.test";
  const calls = [];
  globalThis.fetch = async (url) => {
    const path = new URL(String(url)).pathname;
    calls.push(String(url));
    if (path.endsWith("/business-rules")) {
      return jsonResponse({ items: [{ id: "rule-1" }] });
    }
    if (path.endsWith("/architecture-decisions")) {
      return jsonResponse({ items: [{ id: "decision-1" }] });
    }
    if (path.endsWith("/business-rules/rule-1")) {
      return jsonResponse({ businessRule: { id: "rule-1", markdown: "# R" } });
    }
    return jsonResponse({
      architectureDecision: { id: "decision-1", markdown: "# D" },
    });
  };

  try {
    const result = await dispatchTool("knowledge_context_load", {
      applicationId: "app-1",
      componentId: "component-1",
      limit: 10,
    });
    assert.equal(result.businessRules[0].markdown, "# R");
    assert.equal(result.architectureDecisions[0].markdown, "# D");
    assert.equal(
      calls.some((url) =>
        url.includes(
          "/api/knowledge/business-rules?applicationId=app-1&componentId=component-1&status=active&limit=10",
        ),
      ),
      true,
    );
    assert.equal(
      calls.some((url) => url.includes("status=accepted")),
      true,
    );
  } finally {
    globalThis.fetch = originalFetch;
    if (originalBaseUrl === undefined) delete process.env.ISSUE_API_URL;
    else process.env.ISSUE_API_URL = originalBaseUrl;
  }
});
