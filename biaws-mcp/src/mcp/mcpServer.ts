import {
  ProtocolError,
  specTypeSchemas,
  type CallToolResult,
  type ResourceLink,
  type ServerContext,
} from "@modelcontextprotocol/server";
import { VersionedMcpServer } from "./versionedServer.js";
import { randomUUID } from "node:crypto";
import { errorInfo, isRecord } from "../runtime/errors.js";
import type { Logger } from "../runtime/logger.js";
import { runWithRequestContext } from "../runtime/requestContext.js";
import { resourceLinksForTool } from "./resources/resourceLinks.js";
import {
  listResources as defaultListResources,
  listResourceTemplates as defaultListResourceTemplates,
  readResource as defaultReadResource,
} from "./resources/resources.js";
import { dispatchTool as defaultDispatchTool, listTools as defaultListTools } from "./tools/tools.js";
import { SERVER_NAME, SERVER_VERSION } from "../version.js";
export interface McpOptions {
  dispatchTool?: (name: string, args: unknown) => Promise<unknown>;
  listTools?: typeof defaultListTools;
  listResources?: typeof defaultListResources;
  listResourceTemplates?: typeof defaultListResourceTemplates;
  readResource?: typeof defaultReadResource;
  logger?: Logger;
  createRequestId?: () => string;
  now?: () => number;
  shutdownSignal?: AbortSignal;
  era?: "legacy" | "modern";
}

function publicToolError(value: unknown) {
  const error = errorInfo(value);
  const result: Record<string, unknown> = {
    code: String(error?.code || "TOOL_EXECUTION_ERROR"),
    message: String(error?.message || "Tool execution failed"),
  };
  if (Number.isInteger(error?.statusCode)) result.status = error.statusCode;
  for (const field of ["requiredPermissions", "fields", "details", "requestId", "retryable"] as const) {
    if (error?.[field] !== undefined) result[field] = error[field];
  }
  return result;
}

export function toolResult(value: unknown, links: ResourceLink[] = []): CallToolResult {
  if (!isRecord(value)) throw new Error("Tool result must be an object");
  const result = value;
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

export function toolErrorResult(error: unknown): CallToolResult {
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
}: McpOptions = {}) {
  const server = new VersionedMcpServer(
    { name: SERVER_NAME, version: SERVER_VERSION },
    {
      capabilities: { tools: {}, resources: {} },
    },
  );
  const inFlight = new Set<Promise<unknown>>();

  async function execute<T>(tool: string, ctx: ServerContext, operation: () => Promise<T>): Promise<T> {
    const requestId = createRequestId();
    const startedAt = now();
    const signal = shutdownSignal ? AbortSignal.any([ctx.mcpReq.signal, shutdownSignal]) : ctx.mcpReq.signal;
    const logContext = { requestId, rpcRequestId: ctx.mcpReq.id, tool };
    const event = tool === "resources/read" ? "mcp_resource_read" : "mcp_tool_call";
    logger?.info(`${event}_started`, {
      ...logContext,
      inFlight: inFlight.size + 1,
    });
    const pending = runWithRequestContext({ signal, logger, requestId, tool }, operation);
    inFlight.add(pending);
    try {
      const result = await pending;
      logger?.info(`${event}_completed`, {
        ...logContext,
        durationMs: Math.max(0, now() - startedAt),
      });
      return result;
    } catch (error_) {
      const error = errorInfo(error_);
      const cancelled = signal.aborted || error?.code === "REQUEST_CANCELLED";
      const expected =
        cancelled || (Number.isInteger(error?.statusCode) && error.statusCode !== undefined && error.statusCode < 500);
      logger?.[expected ? "warn" : "error"](`${event}_${cancelled ? "cancelled" : "failed"}`, {
        ...logContext,
        durationMs: Math.max(0, now() - startedAt),
        error,
      });
      throw error;
    } finally {
      inFlight.delete(pending);
    }
  }

  server.server.onerror = (error) => logger?.error("mcp_protocol_error", { error });
  server.server.setRequestHandler("tools/list", async () => ({
    tools: listTools().map((tool) => {
      const parsed = specTypeSchemas.Tool["~standard"].validate(tool);
      if (parsed.issues) throw new Error("Invalid tool catalog");
      return parsed.value;
    }),
  }));
  server.server.setRequestHandler("tools/call", async (request, ctx) => {
    const { name, arguments: args = {} } = request.params;
    try {
      const result = await execute(name, ctx, () => dispatchTool(name, args));
      const version = server.protocolVersion;
      const links =
        era === "modern" || ["2025-11-25", "2025-06-18"].includes(version || "")
          ? resourceLinksForTool(name, result)
          : [];
      // The SDK encodes structured content according to the connection era.
      return toolResult(result, links);
    } catch (error_) {
      const error = errorInfo(error_);
      return toolErrorResult(error);
    }
  });
  server.server.setRequestHandler("resources/list", async (request) => {
    try {
      return listResources(request.params);
    } catch (error_) {
      const error = errorInfo(error_);
      throw new ProtocolError(-32602, error.message, publicToolError(error));
    }
  });
  server.server.setRequestHandler("resources/templates/list", async () => listResourceTemplates());
  server.server.setRequestHandler("resources/read", async (request, ctx) => {
    try {
      return await execute("resources/read", ctx, () => readResource(request.params));
    } catch (error_) {
      const error = errorInfo(error_);
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
      await Promise.allSettled(inFlight);
    },
  };
}
