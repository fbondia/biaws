import assert from "node:assert/strict";
import test from "node:test";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { once } from "node:events";
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import { createBiawsHttpServer } from "../../../src/http/nodeServer.js";
import { httpConfig } from "../../../src/http/config.js";

test(
  "Node HTTP entrypoint bounds bodies and serves official client through delegated authentication",
  { skip: process.env.BIAWS_MCP_HTTP_INTEGRATION !== "1" },
  async () => {
    const api = createServer((req, res) => {
      res.setHeader("content-type", "application/json");
      if (req.url === "/api/health") {
        res.end('{"status":"ok"}');
        return;
      }
      if (req.url === "/api/auth/mcp/delegate") {
        assert.equal(req.headers["x-biaws-mcp-service-secret"], "synthetic-service-secret".repeat(3));
        res.end(
          JSON.stringify({
            accessToken: "biaws_dlg_synthetic",
            workspaceId: "workspace",
            grantId: "grant",
            scopes: ["mcp:read"],
            expiresAt: new Date(Date.now() + 30000).toISOString(),
          }),
        );
        return;
      }
      res.writeHead(404).end();
    });
    api.listen(0, "127.0.0.1");
    await once(api, "listening");
    const config = {
      ...httpConfig({
        BIAWS_MCP_PUBLIC_URL: "http://127.0.0.1/mcp",
        BIAWS_MCP_SERVICE_SECRET: "synthetic-service-secret".repeat(3),
      }),
      port: 0,
      maxBodyBytes: 1024,
    };
    config.apiUrl = new URL(`http://127.0.0.1:${(api.address() as AddressInfo).port}`);
    const runtime = createBiawsHttpServer(config);
    runtime.server.listen(0, "127.0.0.1");
    await once(runtime.server, "listening");
    config.publicUrl.port = String((runtime.server.address() as AddressInfo).port);
    const client = new Client({ name: "node-test", version: "0.0.0" }, { versionNegotiation: { mode: "legacy" } });
    try {
      assert.equal((await fetch(new URL("/health/ready", config.publicUrl))).status, 200);
      await client.connect(
        new StreamableHTTPClientTransport(config.publicUrl, {
          requestInit: { headers: { authorization: "Bearer synthetic-external" } },
        }),
      );
      assert.ok((await client.listTools()).tools.length > 0);
      const tooLarge = await fetch(config.publicUrl, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify("x".repeat(2048)),
      });
      assert.equal(tooLarge.status, 413);
      const rejected = await fetch(config.publicUrl, {
        method: "POST",
        headers: { "content-type": "application/json", origin: "https://evil.example.test" },
        body: "{}",
      });
      assert.equal(rejected.status, 403);
    } finally {
      await client.close();
      await runtime.close();
      await new Promise<void>((resolve) => api.close(() => resolve()));
    }
  },
);
