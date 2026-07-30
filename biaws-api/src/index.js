#!/usr/bin/env node

import { apiLogger, serializeError } from "./logging/logger.js";

async function startServer() {
  try {
    const [{ createApp }, { getServerConfig }, { closeMongoClient }] =
      await Promise.all([
        import("./app.js"),
        import("./config.js"),
        import("./helpers/mongoClient.js"),
      ]);
    const config = getServerConfig();
    const app = createApp();
    const server = app.listen(config.port, config.host, () => {
      apiLogger.info("server_started", {
        host: config.host,
        port: config.port,
        nodeEnv: process.env.NODE_ENV || "development",
        secureCookies: config.auth.secureCookies,
        maxAttachmentBytes: config.maxAttachmentBytes,
        maxJsonBytes: config.maxJsonBytes,
      });
    });

    async function shutdown(signal) {
      apiLogger.info("server_shutdown_started", { signal });
      server.close(async () => {
        try {
          await closeMongoClient();
          apiLogger.info("server_shutdown_completed", { signal });
          process.exit(0);
        } catch (error) {
          apiLogger.error("server_shutdown_failed", {
            signal,
            error: serializeError(error),
          });
          process.exit(1);
        }
      });
    }

    server.on("error", (error) => {
      apiLogger.error("server_failed", { error: serializeError(error) });
    });

    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
  } catch (error) {
    apiLogger.error("server_start_failed", {
      error: serializeError(error),
    });
    process.exitCode = 1;
  }
}

void startServer();
