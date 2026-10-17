import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createHash } from "node:crypto";
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

test("submission readiness is bound to the installed artifact, manifest, version and public endpoint", async () => {
  const manifest = JSON.parse(await readFile(new URL("../biaws/plugin.json", import.meta.url), "utf8"));
  Object.assign(manifest.extensions["com.openai"].interface, {
    privacyPolicyURL: "https://review.example.com/privacy",
    termsOfServiceURL: "https://review.example.com/terms",
  });
  const evidence = {
    publisherIdentityVerified: true,
    domainVerified: true,
    templateEligibilityConfirmed: true,
    realChatgptValidationPassed: true,
    skillsScanPassed: true,
    toolsScanPassed: true,
    legalUrlsReviewed: true,
    reviewCasesExecuted: true,
    pluginVersion: manifest.version,
    artifactSha256: "a".repeat(64),
    reviewEndpoint: "https://review.example.com/mcp",
    demoRecordingUrl: "https://review.example.com/demo",
  };
  const artifact = {
    version: manifest.version,
    sha256: evidence.artifactSha256,
    endpoint: evidence.reviewEndpoint,
    manifestSha256: createHash("sha256").update(JSON.stringify(manifest)).digest("hex"),
  };
  assert.equal(catalogReadiness(manifest, evidence).submissionReady, false);
  assert.equal(catalogReadiness(manifest, evidence, artifact).submissionReady, true);
  for (const changed of [
    { ...artifact, sha256: "b".repeat(64) },
    { ...artifact, version: "0.0.1" },
    { ...artifact, endpoint: "https://other.example.com/mcp" },
  ])
    assert.equal(catalogReadiness(manifest, evidence, changed).submissionReady, false);
  assert.equal(catalogReadiness(manifest, { ...evidence, pluginVersion: "0.0.1" }, artifact).submissionReady, false);
  const changedManifest = structuredClone(manifest);
  changedManifest.description += " changed";
  assert.equal(catalogReadiness(changedManifest, evidence, artifact).submissionReady, false);
  for (const endpoint of [
    "https://127.0.0.1/mcp",
    "https://local.test/mcp",
    "https://user:password@review.example.com/mcp",
  ]) {
    assert.equal(
      catalogReadiness(manifest, { ...evidence, reviewEndpoint: endpoint }, { ...artifact, endpoint }).submissionReady,
      false,
    );
  }
});
