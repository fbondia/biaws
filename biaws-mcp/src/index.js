import path from "node:path";
import { fileURLToPath } from "node:url";

import { loadEnv } from "../../shared/index.js";
import { createMcpMessageHandler, protocolError } from "./mcpServer.js";
import { dispatchTool, listTools } from "./tools.js";

const TOOL_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

// O workspace pertence à configuração do projeto/cliente MCP. O arquivo da
// instância fornece URL e credencial, mas não pode mudar esse escopo.
loadEnv(TOOL_DIR, { preserve: ["ISSUE_WORKSPACE_ID"] });

function writeMessage(message) {
  process.stdout.write(`${JSON.stringify(message)}\n`);
}

const server = createMcpMessageHandler({
  dispatchTool,
  listTools,
  writeMessage,
});
let buffer = "";

process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => {
  buffer += chunk;
  const lines = buffer.split(/\r?\n/u);
  buffer = lines.pop() || "";

  for (const line of lines) {
    if (!line.trim()) continue;
    try {
      void server.accept(JSON.parse(line));
    } catch {
      writeMessage(protocolError(null, -32700, "Parse error"));
    }
  }
});

process.stdin.on("end", () => {
  void server.waitForIdle().finally(shutdown);
});

function shutdown() {
  process.exit(0);
}

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    server.cancelAll();
    void server.waitForIdle().finally(shutdown);
  });
}
