import assert from "node:assert/strict";
import test from "node:test";
import { createServer } from "node:http";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import { httpConfig } from "../../../src/http/config.js";
import { createBiawsHttpServer } from "../../../src/http/nodeServer.js";

test(
  "Node transport limits peers and concurrent requests before delegation",
  { skip: process.env.BIAWS_MCP_HTTP_INTEGRATION !== "1" },
  async () => {
    let release!: () => void, entered!: () => void;
    const waiting = new Promise<void>((resolve) => {
      entered = resolve;
    });
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const api = createServer((_req, res) => {
      entered();
      void gate.then(() => res.writeHead(401, { "content-type": "application/json" }).end('{"error":"invalid_token"}'));
    });
    api.listen(0, "127.0.0.1");
    await once(api, "listening");
    const config = httpConfig({
      BIAWS_MCP_PUBLIC_URL: "http://127.0.0.1/mcp",
      BIAWS_MCP_SERVICE_SECRET: "synthetic-service-secret".repeat(3),
    });
    config.apiUrl = new URL("http://127.0.0.1:" + (api.address() as AddressInfo).port);
    config.maxInFlight = 1;
    config.requestsPerMinute = 3;
    const runtime = createBiawsHttpServer(config);
    runtime.server.listen(0, "127.0.0.1");
    await once(runtime.server, "listening");
    config.publicUrl.port = String((runtime.server.address() as AddressInfo).port);
    try {
      const first = fetch(config.publicUrl, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: "Bearer synthetic" },
        body: "{}",
      });
      await waiting;
      assert.equal((await fetch(config.publicUrl, { method: "POST", body: "{}" })).status, 503);
      release();
      assert.equal((await first).status, 401);
      assert.equal((await fetch(config.publicUrl, { method: "POST", body: "{}" })).status, 401);
      const limited = await fetch(config.publicUrl, { method: "POST", body: "{}" });
      assert.equal(limited.status, 429);
      assert.equal(limited.headers.get("retry-after"), "60");
    } finally {
      release();
      await runtime.close();
      api.closeAllConnections();
      await new Promise<void>((resolve) => api.close(() => resolve()));
    }
  },
);
