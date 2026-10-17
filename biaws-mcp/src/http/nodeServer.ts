import { createServer } from "node:http";
import { toNodeHandler, hostHeaderValidation } from "@modelcontextprotocol/node";
import type { HttpConfig } from "./config.js";
import type { Logger } from "../runtime/logger.js";
import { createBiawsHttpHandler } from "./handler.js";

export function createBiawsHttpServer(config: HttpConfig, logger?: Logger) {
  const handler = createBiawsHttpHandler({ config, logger });
  const adapt = toNodeHandler(handler, { onerror: (error) => logger?.error("mcp_http_adapter_error", { error }) });
  const validateHost = hostHeaderValidation([config.publicUrl.hostname]);
  let active = 0;
  const buckets = new Map<string, { start: number; count: number }>();
  const server = createServer(async (req, res) => {
    if (req.url === "/health/live") {
      res.writeHead(200, { "content-type": "application/json" }).end('{"status":"ok"}');
      return;
    }
    if (req.url === "/health/ready") {
      try {
        const response = await fetch(new URL("/api/health", config.apiUrl), {
          signal: AbortSignal.timeout(2000),
          redirect: "error",
        });
        res
          .writeHead(response.ok ? 200 : 503, { "content-type": "application/json" })
          .end(JSON.stringify({ status: response.ok ? "ready" : "unavailable" }));
      } catch {
        res.writeHead(503).end();
      }
      return;
    }
    if (!validateHost(req, res)) return;
    const now = Date.now(),
      key = req.socket.remoteAddress || "unknown";
    let bucket = buckets.get(key);
    if (!bucket || now - bucket.start >= 60000) {
      bucket = { start: now, count: 0 };
      buckets.set(key, bucket);
    }
    if (buckets.size > 1024) buckets.delete(buckets.keys().next().value!);
    if (++bucket.count > config.requestsPerMinute) {
      res.writeHead(429, { "retry-after": "60" }).end();
      return;
    }
    if (active >= config.maxInFlight) {
      res.writeHead(503, { "retry-after": "1" }).end();
      return;
    }
    active++;
    try {
      let size = 0;
      const chunks: Buffer[] = [];
      for await (const chunk of req.iterator({ destroyOnReturn: false })) {
        const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        size += buffer.length;
        if (size > config.maxBodyBytes) {
          res.writeHead(413, { connection: "close" }).end();
          return;
        }
        chunks.push(buffer);
      }
      let body: unknown;
      if (size) {
        try {
          body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
        } catch {
          res.writeHead(400).end();
          return;
        }
      }
      await adapt(req, res, body);
    } catch (error) {
      logger?.error("mcp_http_transport_failed", { error });
      if (!res.headersSent) res.writeHead(500);
      res.end();
    } finally {
      active--;
    }
  });
  server.headersTimeout = 10000;
  server.requestTimeout = 30000;
  server.maxRequestsPerSocket = 1000;
  return {
    server,
    async close() {
      const closing = new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
      let timeout: ReturnType<typeof setTimeout> | undefined;
      try {
        await Promise.race([
          handler.close(),
          new Promise<void>((resolve) => {
            timeout = setTimeout(resolve, 5000);
          }),
        ]);
      } finally {
        clearTimeout(timeout);
        server.closeAllConnections();
      }
      await closing;
    },
  };
}
