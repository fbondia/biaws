import { createMcpHandler } from "@modelcontextprotocol/server";
import { randomUUID } from "node:crypto";
import { createBiawsMcpServer, type McpOptions } from "../mcp/mcpServer.js";
import { runWithRequestContext } from "../runtime/requestContext.js";
import { errorInfo } from "../runtime/errors.js";
import type { Logger } from "../runtime/logger.js";
import type { HttpConfig } from "./config.js";
import { authenticationChallenge, delegateIdentity, type DelegatedIdentity } from "./authentication.js";

export function createBiawsHttpHandler({
  config,
  logger,
  authenticate,
  serverOptions = {},
}: {
  config: HttpConfig;
  logger?: Logger;
  authenticate?: (request: Request) => Promise<DelegatedIdentity>;
  serverOptions?: McpOptions;
}) {
  const shutdown = new AbortController();
  const handler = createMcpHandler(
    ({ era }) => createBiawsMcpServer({ ...serverOptions, era, logger, shutdownSignal: shutdown.signal }).server,
    {
      legacy: "stateless",
      maxRequestBodySize: config.maxBodyBytes,
      onerror: (error) => logger?.warn("mcp_http_protocol_error", { error }),
    },
  );
  return {
    async fetch(request: Request) {
      const url = new URL(request.url);
      if (url.host !== config.publicUrl.host) return new Response(null, { status: 403 });
      const origin = request.headers.get("origin");
      if (origin && origin !== config.publicUrl.origin) return new Response(null, { status: 403 });
      if (url.pathname !== config.publicUrl.pathname || url.search) return new Response(null, { status: 404 });
      if (request.method !== "POST") return new Response(null, { status: 405, headers: { allow: "POST" } });
      const requestId = randomUUID();
      try {
        const identity = await (authenticate ? authenticate(request) : delegateIdentity(request, config));
        return await runWithRequestContext(
          { transport: "http", authentication: identity, requestId, logger, signal: request.signal },
          () => handler.fetch(request),
        );
      } catch (error) {
        const status = errorInfo(error).statusCode;
        if (status === 401 || status === 403) return authenticationChallenge(config, status);
        logger?.warn("mcp_http_request_failed", { requestId, error });
        return new Response(JSON.stringify({ error: "service_unavailable" }), {
          status: 503,
          headers: { "content-type": "application/json", "cache-control": "no-store" },
        });
      }
    },
    async close() {
      shutdown.abort();
      await handler.close();
    },
  };
}
