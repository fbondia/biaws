import assert from "node:assert/strict";
import * as fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  configureMcpInstance,
  diagnoseMcp,
  mcpPublicConfiguration,
  chatgptConnectionInstructions,
} from "../src/instance/mcp.js";
import { parseEnv } from "../src/core/context.js";
import { composeArguments } from "../src/instance/service.js";

test("MCP configuration is private, idempotent and retains keys/replica set on disable", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "biaws-mcp-config-"));
  try {
    const envFile = path.join(root, ".env");
    await fs.writeFile(envFile, "BIAWS_PUBLIC_URL=https://synthetic.example.test\nPRESERVED=yes\n");
    await configureMcpInstance(envFile, true, fs, { uid: 42, gid: 43 });
    const env = parseEnv(await fs.readFile(envFile, "utf8"));
    const secret = await fs.readFile(env.BIAWS_MCP_SERVICE_SECRET_PATH, "utf8");
    assert.ok(secret.length >= 32);
    assert.equal((await fs.stat(env.BIAWS_MCP_SERVICE_SECRET_PATH)).mode & 0o777, 0o600);
    assert.equal((await fs.stat(envFile)).mode & 0o777, 0o600);
    await configureMcpInstance(envFile, true, fs);
    assert.equal(await fs.readFile(env.BIAWS_MCP_SERVICE_SECRET_PATH, "utf8"), secret);
    assert.equal(parseEnv(await fs.readFile(envFile, "utf8")).BIAWS_MCP_UID, "42");
    await configureMcpInstance(envFile, false, fs);
    const disabled = parseEnv(await fs.readFile(envFile, "utf8"));
    assert.equal(disabled.PRESERVED, "yes");
    assert.equal(disabled.BIAWS_MCP_CONFIGURED, "true");
    assert.equal(disabled.BIAWS_MCP_HTTP_ENABLED, "false");
    const args = composeArguments({ name: "synthetic", envFile, env: disabled }, { repositoryRoot: root }, "start");
    assert.ok(args.includes(path.join(root, "compose.mcp.yaml")));
    assert.equal(args.includes("--profile"), false);
    assert.equal(await fs.readFile(env.BIAWS_MCP_SERVICE_SECRET_PATH, "utf8"), secret);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
test("remote setup rejects insecure hosts and instructions never contain credentials", () => {
  for (const url of [
    "http://remote.example.test",
    "https://user:secret@example.test",
    "https://example.test/path",
    "https://example.test/?x=1",
  ])
    assert.throws(() => mcpPublicConfiguration(url));
  assert.equal(mcpPublicConfiguration("http://localhost:4400").resource, "http://localhost:4400/mcp");
  const result = chatgptConnectionInstructions("https://synthetic.example.test");
  assert.equal(result.authentication, "OAuth");
  assert.equal(result.resource, "https://synthetic.example.test/mcp");
});
test("diagnosis checks bindings and distinguishes local observation from external reachability", async () => {
  const origin = "https://synthetic.example.test";
  const result = await diagnoseMcp(origin, {
    fetchImpl: async (url, options = {}) => {
      if (options.method === "POST")
        return new Response(null, {
          status: 401,
          headers: {
            "www-authenticate": 'Bearer resource_metadata="' + origin + '/.well-known/oauth-protected-resource/mcp"',
          },
        });
      if (url.includes("oauth-protected-resource"))
        return Response.json({ resource: origin + "/mcp", authorization_servers: [origin + "/api/auth"] });
      if (url.includes("oauth-authorization-server"))
        return Response.json({ issuer: origin + "/api/auth", code_challenge_methods_supported: ["S256"] });
      return Response.json({ status: "ok" });
    },
  });
  assert.equal(result.ok, true);
  assert.match(result.observation, /desta máquina/);
  const failure = await diagnoseMcp(origin, {
    fetchImpl: async () => {
      throw new Error("synthetic");
    },
  });
  assert.equal(failure.ok, false);
  assert.ok(failure.checks.every((c) => !c.ok));
});
