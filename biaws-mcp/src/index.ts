import { randomUUID } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { serveStdio } from "@modelcontextprotocol/server/stdio";
import { loadEnv } from "./config/loadEnv.js";
import { createLogger } from "./runtime/logger.js";
import { createBiawsMcpServer } from "./mcp/mcpServer.js";
import { SERVER_NAME, SERVER_VERSION } from "./version.js";

const TOOL_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
);

// O workspace pertence à configuração do projeto/cliente MCP. O arquivo da
// instância fornece URL e credencial, mas não pode mudar esse escopo.
const environment = loadEnv(TOOL_DIR, {
  preserve: ["BIAWS_WORKSPACE_ID"],
});
const executionId = randomUUID();
const startedAt = Date.now();
const logger = createLogger({
  service: SERVER_NAME,
  version: SERVER_VERSION,
  executionId,
});

// A broken stderr cannot be reported anywhere safely. Keep it from becoming a
// second fatal error while preserving stdout exclusively for MCP frames.
process.stderr.on("error", () => {});

const shutdownController = new AbortController();
const instances = new Set<ReturnType<typeof createBiawsMcpServer>>();
const connection = serveStdio(
  ({ era }) => {
    const instance = createBiawsMcpServer({
      logger,
      era,
      shutdownSignal: shutdownController.signal,
    });
    instances.add(instance);
    return instance.server;
  },
  { onerror: (error) => logger.error("mcp_transport_error", { error }) },
);
let shuttingDown = false;

logger.info("mcp_server_started", {
  nodeVersion: process.versions.node,
  pid: process.pid,
  transport: "stdio",
  environmentFilesLoaded: environment.loaded.length,
  workspaceConfigured: Boolean(
    String(process.env.BIAWS_WORKSPACE_ID || "").trim(),
  ),
});

process.stdin.on("end", () => {
  logger.info("mcp_input_closed", {});
  void shutdown({ reason: "stdin_end" });
});

process.stdin.on("error", (error) => {
  logger.error("mcp_input_error", { error });
  void shutdown({ reason: "stdin_error", exitCode: 1, cancel: true });
});

process.stdout.on("error", (error) => {
  logger.error("mcp_stdout_error", { error });
  void shutdown({ reason: "stdout_error", exitCode: 1, cancel: true });
});

async function shutdown({
  reason,
  signal,
  exitCode = 0,
  cancel = false,
}: {
  reason: string;
  signal?: NodeJS.Signals;
  exitCode?: number;
  cancel?: boolean;
}) {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info("mcp_shutdown_requested", {
    reason,
    signal,
    exitCode,
    cancelActiveRequests: cancel,
  });
  if (cancel) shutdownController.abort();

  const timeoutMs = 5_000;
  let timedOut = false;
  let timer: NodeJS.Timeout | undefined;
  await Promise.race([
    Promise.all([...instances].map((instance) => instance.waitForIdle())),
    new Promise<void>((resolve) => {
      timer = setTimeout(() => {
        timedOut = true;
        resolve();
      }, timeoutMs);
    }),
  ]);
  clearTimeout(timer);
  if (timedOut) {
    logger.warn("mcp_shutdown_timed_out", { reason, timeoutMs });
  }
  await connection.close();
  logger.info("mcp_server_stopped", {
    reason,
    exitCode,
    graceful: !timedOut,
    uptimeMs: Math.max(0, Date.now() - startedAt),
  });
  process.exit(exitCode);
}

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    void shutdown({
      reason: "signal",
      signal,
      exitCode: 0,
      cancel: true,
    });
  });
}

process.on("uncaughtException", (error, origin) => {
  logger.error("mcp_uncaught_exception", { origin, error });
  void shutdown({
    reason: "uncaught_exception",
    exitCode: 1,
    cancel: true,
  });
});

process.on("unhandledRejection", (reason) => {
  logger.error("mcp_unhandled_rejection", { error: reason });
  void shutdown({
    reason: "unhandled_rejection",
    exitCode: 1,
    cancel: true,
  });
});
