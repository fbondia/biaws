import assert from "node:assert/strict";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { loadEnv } from "../src/loadEnv.js";

test("published MCP loads explicit credentials and preserves project scope", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "biaws-mcp-env-"));
  const tool = path.join(root, "biaws-mcp");
  const explicit = path.join(root, "client.env");
  await mkdir(tool);
  await writeFile(path.join(root, "compose.yaml"), "services: {}\n");
  await writeFile(path.join(root, ".env"), "ISSUE_API_URL=https://root.test\n");
  await writeFile(path.join(tool, ".env"), "ISSUE_API_URL=https://tool.test\n");
  await writeFile(
    explicit,
    "ISSUE_API_URL=https://remote.test/api\nBIAWS_WORKSPACE_ID=wrong-scope\n",
  );

  const previous = {
    BIAWS_ENV_FILE: process.env.BIAWS_ENV_FILE,
    ISSUE_API_URL: process.env.ISSUE_API_URL,
    BIAWS_WORKSPACE_ID: process.env.BIAWS_WORKSPACE_ID,
  };
  delete process.env.ISSUE_API_URL;
  process.env.BIAWS_ENV_FILE = explicit;
  process.env.BIAWS_WORKSPACE_ID = "project-scope";

  try {
    const result = loadEnv(tool, { preserve: ["BIAWS_WORKSPACE_ID"] });
    assert.deepEqual(result.loaded, [
      path.join(root, ".env"),
      path.join(tool, ".env"),
      explicit,
    ]);
    assert.equal(process.env.ISSUE_API_URL, "https://remote.test/api");
    assert.equal(process.env.BIAWS_WORKSPACE_ID, "project-scope");
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});
