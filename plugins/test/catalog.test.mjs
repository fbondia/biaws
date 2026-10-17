import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { catalogReadiness, toolJustifications } from "../scripts/catalog-readiness.mjs";
test("catalog metadata obeys limits and exact case counts without fabricating external readiness", async () => {
  const manifest = JSON.parse(await readFile(new URL("../biaws/plugin.json", import.meta.url), "utf8"));
  const result = catalogReadiness(manifest);
  assert.equal(result.metadataValid, true);
  assert.equal(result.submissionReady, false);
  assert.equal(result.positiveCases, 5);
  assert.equal(result.negativeCases, 3);
  assert.ok(result.pending.includes("privacyPolicyURL"));
  assert.ok(result.pending.includes("realChatgptValidationPassed"));
  const invalid = structuredClone(manifest);
  invalid.extensions["com.openai"].interface.shortDescription = "x".repeat(31);
  assert.equal(catalogReadiness(invalid).metadataValid, false);
  for (const values of Object.values(toolJustifications()))
    for (const hint of Object.values(values)) {
      assert.equal(typeof hint.value, "boolean");
      assert.ok(hint.justification.length > 20);
    }
});
