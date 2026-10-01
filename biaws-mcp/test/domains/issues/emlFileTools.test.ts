import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { dispatchTool } from "../../../src/mcp/tools/tools.js";

function response(payload: unknown = {}) {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

test("issues_analyze_eml_file reads an approved host file and returns its digest", async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), "biaws-eml-analysis-"));
  const filename = path.join(root, "issue.eml");
  const content = Buffer.from("Subject: Example\n\nBody");
  await writeFile(filename, content);
  const previousRoots = process.env.BIAWS_MCP_EML_IMPORT_ROOTS;
  const originalFetch = globalThis.fetch;
  process.env.BIAWS_MCP_EML_IMPORT_ROOTS = root;
  t.after(async () => {
    globalThis.fetch = originalFetch;
    if (previousRoots === undefined) delete process.env.BIAWS_MCP_EML_IMPORT_ROOTS;
    else process.env.BIAWS_MCP_EML_IMPORT_ROOTS = previousRoots;
    await rm(root, { recursive: true, force: true });
  });

  let sentForm: FormData | undefined;
  let sentUrl = "";
  globalThis.fetch = async (url, options = {}) => {
    sentUrl = String(url);
    sentForm = options.body as FormData;
    return response({ mode: "analysis", issue: { title: "Example" } });
  };

  const result = await dispatchTool("issues_analyze_eml_file", { filePath: filename });

  assert.equal(new URL(sentUrl).searchParams.get("analysisOnly"), "true");
  assert.ok(sentForm instanceof FormData);
  assert.equal((sentForm.get("file") as File).name, "issue.eml");
  assert.deepEqual(result.localFile, {
    filename: "issue.eml",
    size: content.length,
    sha256: createHash("sha256").update(content).digest("hex"),
  });
});

test("issues_import_eml_file verifies the digest and sends context and classification", async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), "biaws-eml-import-"));
  const filename = path.join(root, "issue.eml");
  const content = Buffer.from("Subject: Example\n\nBody");
  const sha256 = createHash("sha256").update(content).digest("hex");
  await writeFile(filename, content);
  const previousRoots = process.env.BIAWS_MCP_EML_IMPORT_ROOTS;
  const originalFetch = globalThis.fetch;
  process.env.BIAWS_MCP_EML_IMPORT_ROOTS = root;
  t.after(async () => {
    globalThis.fetch = originalFetch;
    if (previousRoots === undefined) delete process.env.BIAWS_MCP_EML_IMPORT_ROOTS;
    else process.env.BIAWS_MCP_EML_IMPORT_ROOTS = previousRoots;
    await rm(root, { recursive: true, force: true });
  });

  let sentForm: FormData | undefined;
  let sentUrl = "";
  globalThis.fetch = async (url, options = {}) => {
    sentUrl = String(url);
    sentForm = options.body as FormData;
    return response({ mode: "import", issueId: "ISSUE-1" });
  };

  await dispatchTool("issues_import_eml_file", {
    filePath: filename,
    expectedSha256: sha256,
    applicationId: "application-1",
    affectedComponentIds: ["component-1"],
    title: "Sanitized title",
    classification: {
      primaryTaxonomyId: "taxonomy-1",
      secondaryTaxonomyIds: [],
      summary: "Summary",
      tags: { impact: ["high"] },
    },
    dryRun: false,
  });

  assert.equal(new URL(sentUrl).searchParams.get("dryRun"), "false");
  assert.ok(sentForm instanceof FormData);
  assert.equal(sentForm.get("applicationId"), "application-1");
  assert.equal(sentForm.get("title"), "Sanitized title");
  assert.equal(sentForm.get("affectedComponentIds"), JSON.stringify(["component-1"]));
  assert.equal(
    sentForm.get("classification"),
    JSON.stringify({
      primaryTaxonomyId: "taxonomy-1",
      secondaryTaxonomyIds: [],
      summary: "Summary",
      tags: { impact: ["high"] },
    }),
  );
});

test("host EML tools reject changed files and direct symbolic links before calling the API", async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), "biaws-eml-security-"));
  const filename = path.join(root, "issue.eml");
  const link = path.join(root, "linked.eml");
  await writeFile(filename, "Subject: Example\n\nBody");
  await symlink(filename, link);
  const previousRoots = process.env.BIAWS_MCP_EML_IMPORT_ROOTS;
  const originalFetch = globalThis.fetch;
  process.env.BIAWS_MCP_EML_IMPORT_ROOTS = root;
  let calls = 0;
  globalThis.fetch = async () => {
    calls += 1;
    return response();
  };
  t.after(async () => {
    globalThis.fetch = originalFetch;
    if (previousRoots === undefined) delete process.env.BIAWS_MCP_EML_IMPORT_ROOTS;
    else process.env.BIAWS_MCP_EML_IMPORT_ROOTS = previousRoots;
    await rm(root, { recursive: true, force: true });
  });

  await assert.rejects(
    dispatchTool("issues_import_eml_file", {
      filePath: filename,
      expectedSha256: "0".repeat(64),
      applicationId: "application-1",
      dryRun: false,
    }),
    /changed after analysis/u,
  );
  await assert.rejects(dispatchTool("issues_analyze_eml_file", { filePath: link }), /Symbolic links/u);
  assert.equal(calls, 0);
});
