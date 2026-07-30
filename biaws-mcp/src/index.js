import path from "path";
import { fileURLToPath } from "url";

import { loadEnv } from "../../shared/index.js";
import { dispatchTool, listTools } from "./tools.js";

const TOOL_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

loadEnv(TOOL_DIR);

function writeMessage(message) {
  process.stdout.write(`${JSON.stringify(message)}\n`);
}

function ok(id, result) {
  writeMessage({
    jsonrpc: "2.0",
    id,
    result,
  });
}

function fail(id, error) {
  writeMessage({
    jsonrpc: "2.0",
    id,
    error: {
      code: error?.code || -32000,
      message: error?.message || "Unexpected error",
      data: error?.stack,
    },
  });
}

function toolContent(result) {
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(result, null, 2),
      },
    ],
  };
}

async function handleRequest(request) {
  if (!request || request.jsonrpc !== "2.0") return;

  const { id, method, params = {} } = request;

  try {
    if (method === "initialize") {
      ok(id, {
        protocolVersion: params.protocolVersion || "2024-11-05",
        capabilities: {
          tools: {},
        },
        serverInfo: {
          name: "biaws-mcp",
          version: "0.1.0",
        },
      });
      return;
    }

    if (method === "notifications/initialized") return;

    if (method === "tools/list") {
      ok(id, { tools: listTools() });
      return;
    }

    if (method === "tools/call") {
      ok(
        id,
        toolContent(await dispatchTool(params.name, params.arguments || {})),
      );
      return;
    }

    fail(id, { code: -32601, message: `Method not found: ${method}` });
  } catch (error) {
    fail(id, error);
  }
}

let buffer = "";
let pending = Promise.resolve();

process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => {
  buffer += chunk;
  const lines = buffer.split(/\r?\n/u);
  buffer = lines.pop() || "";

  for (const line of lines) {
    if (!line.trim()) continue;
    try {
      const request = JSON.parse(line);
      pending = pending.then(() => handleRequest(request));
    } catch (error) {
      fail(null, error);
    }
  }
});

process.stdin.on("end", () => {
  void pending.finally(shutdown);
});

async function shutdown() {
  process.exit(0);
}

process.on("SIGINT", () => {
  void shutdown();
});
process.on("SIGTERM", () => {
  void shutdown();
});
