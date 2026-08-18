import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import { legacyAgentContext } from "../src/configure/command.js";

test("configuração global resolve o MCP no checkout indicado por BIAWS_ROOT", () => {
  const context = legacyAgentContext({
    apiKey: "test-key",
    apiUrl: "https://biaws.example.test/api",
    envFile: "/private/config.env",
    repositoryRoot: "/checkout/biaws",
    toolDirectory: "/global/lib/node_modules/biaws",
    workspaceId: "workspace-a",
  });

  assert.equal(
    context.toolDirectory,
    path.join("/checkout/biaws", "biaws-cli"),
  );
});

test("configuração preserva a rota legada quando não há raiz do checkout", () => {
  const context = legacyAgentContext({
    apiKey: "test-key",
    apiUrl: "https://biaws.example.test/api",
    envFile: "",
    toolDirectory: "/checkout/biaws/biaws-cli",
    workspaceId: "workspace-a",
  });

  assert.equal(context.toolDirectory, "/checkout/biaws/biaws-cli");
});
