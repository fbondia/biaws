import { randomUUID } from "node:crypto";
import { McpServer, ProtocolError } from "@modelcontextprotocol/server";
import { runWithRequestContext } from "./requestContext.js";
import { SERVER_NAME, SERVER_VERSION } from "./version.js";
import {
  listResources as defaultListResources,
  listResourceTemplates as defaultListResourceTemplates,
  readResource as defaultReadResource,
} from "./resources.js";
import {
  dispatchTool as defaultDispatchTool,
  listTools as defaultListTools,
} from "./tools.js";
import { resourceLinksForTool } from "./resourceLinks.js";

function publicToolError(error) {
  const result = {
    code: String(error?.code || "TOOL_EXECUTION_ERROR"),
    message: String(error?.message || "Tool execution failed"),
  };
  if (Number.isInteger(error?.statusCode)) result.status = error.statusCode;
  for (const field of [
    "requiredPermissions",
    "fields",
    "details",
    "requestId",
    "retryable",
  ]) {
    if (error?.[field] !== undefined) result[field] = error[field];
  }
  return result;
}

export function toolResult(result, links = []) {
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(result, null, 2),
      },
      ...links,
    ],
    structuredContent: result,
  };
}

export function toolErrorResult(error) {
  const structuredContent = { error: publicToolError(error) };
  return {
    ...toolResult(structuredContent),
    isError: true,
  };
}

// Domain handlers use the SDK's public low-level API to preserve the catalog's
// JSON Schemas and BIAWS validation errors without schema conversion.
export function createBiawsMcpServer({
  dispatchTool = defaultDispatchTool,
  listTools = defaultListTools,
  listResources = defaultListResources,
  listResourceTemplates = defaultListResourceTemplates,
  readResource = defaultReadResource,
  logger,
  createRequestId = randomUUID,
  now = () => Date.now(),
  shutdownSignal,
  era = "legacy",
} = {}) {
  const server = new McpServer(
    { name: SERVER_NAME, version: SERVER_VERSION },
    {
      capabilities: { tools: {}, resources: {} },
    },
  );
  const inFlight = new Set();

  async function execute(tool, ctx, operation) {
    const requestId = createRequestId();
    const startedAt = now();
    const signal = shutdownSignal
      ? AbortSignal.any([ctx.mcpReq.signal, shutdownSignal])
      : ctx.mcpReq.signal;
    const logContext = { requestId, rpcRequestId: ctx.mcpReq.id, tool };
    const event =
      tool === "resources/read" ? "mcp_resource_read" : "mcp_tool_call";
    logger?.info(`${event}_started`, {
      ...logContext,
      inFlight: inFlight.size + 1,
    });
    const pending = runWithRequestContext(
      { signal, logger, requestId, tool },
      operation,
    );
    inFlight.add(pending);
    try {
      const result = await pending;
      logger?.info(`${event}_completed`, {
        ...logContext,
        durationMs: Math.max(0, now() - startedAt),
      });
      return result;
    } catch (error) {
      const cancelled = signal.aborted || error?.code === "REQUEST_CANCELLED";
      const expected =
        cancelled ||
        (Number.isInteger(error?.statusCode) && error.statusCode < 500);
      logger?.[expected ? "warn" : "error"](
        `${event}_${cancelled ? "cancelled" : "failed"}`,
        {
          ...logContext,
          durationMs: Math.max(0, now() - startedAt),
          error,
        },
      );
      throw error;
    } finally {
      inFlight.delete(pending);
    }
  }

  server.server.onerror = (error) =>
    logger?.error("mcp_protocol_error", { error });
  server.server.setRequestHandler("tools/list", async () => ({
    tools: listTools(),
  }));
  server.server.setRequestHandler("tools/call", async (request, ctx) => {
    const { name, arguments: args = {} } = request.params;
    try {
      const result = await execute(name, ctx, () => dispatchTool(name, args));
      const version = server.server.getNegotiatedProtocolVersion();
      const links =
        era === "modern" || ["2025-11-25", "2025-06-18"].includes(version)
          ? resourceLinksForTool(name, result)
          : [];
      // The SDK encodes structured content according to the connection era.
      return toolResult(result, links);
    } catch (error) {
      return toolErrorResult(error);
    }
  });
  server.server.setRequestHandler("resources/list", async (request) => {
    try {
      return listResources(request.params);
    } catch (error) {
      throw new ProtocolError(-32602, error.message, publicToolError(error));
    }
  });
  server.server.setRequestHandler("resources/templates/list", async () =>
    listResourceTemplates(),
  );
  server.server.setRequestHandler("resources/read", async (request, ctx) => {
    try {
      return await execute("resources/read", ctx, () =>
        readResource(request.params),
      );
    } catch (error) {
      throw new ProtocolError(
        error.statusCode === 404 || error.statusCode === 422 ? -32602 : -32603,
        error.message || "Resource read failed",
        publicToolError(error),
      );
    }
  });
  return {
    server,
    async waitForIdle() {
      await Promise.allSettled([...inFlight]);
    },
  };
}
