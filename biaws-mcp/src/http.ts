import { randomUUID } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnv } from "./config/loadEnv.js";
import { createLogger } from "./runtime/logger.js";
import { SERVER_NAME, SERVER_VERSION } from "./version.js";
import { httpConfig } from "./http/config.js";
import { createBiawsHttpServer } from "./http/nodeServer.js";

loadEnv(path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../.."));
const logger = createLogger({ service: SERVER_NAME, version: SERVER_VERSION, executionId: randomUUID() });
const config = httpConfig(),
  runtime = createBiawsHttpServer(config, logger);
runtime.server.listen(config.port, config.host, () =>
  logger.info("mcp_server_started", { transport: "http", host: config.host, port: config.port }),
);
runtime.server.on("error", (error) => {
  logger.error("mcp_http_listen_failed", { error });
  process.exitCode = 1;
});
let stopping = false;
for (const signal of ["SIGINT", "SIGTERM"] as const)
  process.on(signal, () => {
    if (stopping) return;
    stopping = true;
    void runtime.close().then(
      () => logger.info("mcp_server_stopped", { transport: "http" }),
      (error) => {
        logger.error("mcp_http_shutdown_failed", { error });
        process.exitCode = 1;
      },
    );
  });
