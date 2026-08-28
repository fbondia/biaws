import { randomUUID } from "node:crypto";

import { runWithRequestContext } from "./requestContext.js";
import { SERVER_NAME, SERVER_VERSION } from "./version.js";

function success(id, result) {
  return { jsonrpc: "2.0", id, result };
}

export function protocolError(id, code, message, data) {
  return {
    jsonrpc: "2.0",
    id,
    error: {
      code,
      message,
      ...(data === undefined ? {} : { data }),
    },
  };
}

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

export function toolResult(result) {
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(result, null, 2),
      },
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

export function createMcpMessageHandler({
  dispatchTool,
  listTools,
  writeMessage,
  logger,
  createRequestId = randomUUID,
  now = () => Date.now(),
}) {
  const activeRequests = new Map();
  const inFlight = new Set();

  async function handleToolCall(id, params) {
    const controller = new AbortController();
    activeRequests.set(id, controller);
    const requestId = createRequestId();
    const tool = String(params.name || "");
    const startedAt = now();
    const logContext = {
      requestId,
      rpcRequestId: ["string", "number"].includes(typeof id) ? id : undefined,
      tool,
    };
    logger?.info("mcp_tool_call_started", {
      ...logContext,
      inFlight: activeRequests.size,
    });
    try {
      const result = await runWithRequestContext(
        { signal: controller.signal, logger, requestId, tool },
        () => dispatchTool(params.name, params.arguments || {}),
      );
      writeMessage(success(id, toolResult(result)));
      logger?.info("mcp_tool_call_completed", {
        ...logContext,
        durationMs: Math.max(0, now() - startedAt),
      });
    } catch (error) {
      const cancelled = error?.code === "REQUEST_CANCELLED";
      const expectedFailure =
        cancelled ||
        (Number.isInteger(error?.statusCode) && error.statusCode < 500);
      logger?.[expectedFailure ? "warn" : "error"](
        cancelled ? "mcp_tool_call_cancelled" : "mcp_tool_call_failed",
        {
          ...logContext,
          durationMs: Math.max(0, now() - startedAt),
          error,
        },
      );
      writeMessage(success(id, toolErrorResult(error)));
    } finally {
      activeRequests.delete(id);
    }
  }

  async function handleMessage(request) {
    if (!request || request.jsonrpc !== "2.0" || !request.method) {
      writeMessage(
        protocolError(request?.id ?? null, -32600, "Invalid Request"),
      );
      return;
    }

    const { id, method, params = {} } = request;
    if (method === "notifications/initialized") return;
    if (method === "notifications/cancelled") {
      activeRequests
        .get(params.requestId)
        ?.abort(new Error(params.reason || "MCP request cancelled"));
      return;
    }
    if (id === undefined) return;

    if (method === "initialize") {
      writeMessage(
        success(id, {
          protocolVersion: params.protocolVersion || "2024-11-05",
          capabilities: { tools: {} },
          serverInfo: { name: SERVER_NAME, version: SERVER_VERSION },
        }),
      );
      return;
    }
    if (method === "tools/list") {
      writeMessage(success(id, { tools: listTools() }));
      return;
    }
    if (method === "tools/call") {
      await handleToolCall(id, params);
      return;
    }
    writeMessage(protocolError(id, -32601, `Method not found: ${method}`));
  }

  function accept(request) {
    const operation = handleMessage(request).catch((error) => {
      logger?.error("mcp_message_handling_failed", {
        rpcRequestId: ["string", "number"].includes(typeof request?.id)
          ? request.id
          : undefined,
        method: String(request?.method || ""),
        error,
      });
      if (request?.id !== undefined) {
        try {
          writeMessage(
            protocolError(request.id, -32603, "Internal JSON-RPC error"),
          );
        } catch (writeError) {
          logger?.error("mcp_error_response_write_failed", {
            error: writeError,
          });
        }
      }
    });
    inFlight.add(operation);
    void operation.then(
      () => inFlight.delete(operation),
      () => inFlight.delete(operation),
    );
    return operation;
  }

  return {
    accept,
    cancelAll() {
      for (const controller of activeRequests.values()) controller.abort();
    },
    async waitForIdle() {
      await Promise.allSettled([...inFlight]);
    },
  };
}
