import { createExecutorApiClient } from "./apiClient.js";
import { loadExecutorConfig } from "./config.js";
import { ExecutorEngine } from "./engine.js";
import { createHealthServer } from "./healthServer.js";
import { createLogger } from "./logger.js";
import { ProviderRegistry } from "./providers.js";
import { createTelemetry } from "./telemetry.js";

const config = loadExecutorConfig();
const logger = createLogger();
const telemetry = createTelemetry();
const providers = new ProviderRegistry();
const api = createExecutorApiClient(config);
const engine = new ExecutorEngine({
  api,
  providers,
  config,
  telemetry,
  logger,
});
const healthServer = createHealthServer({
  host: config.healthHost,
  port: config.healthPort,
  status: () => engine.status(),
  telemetry,
});

await healthServer.start();

let stopping;
async function stop(signal) {
  if (stopping) return stopping;
  logger.info("executor_shutdown_requested", { signal });
  stopping = Promise.allSettled([engine.stop(), healthServer.stop()]).then(
    () => undefined,
  );
  return stopping;
}

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.once(signal, () => {
    stop(signal).catch((error) => {
      logger.error("executor_shutdown_failed", { error });
      process.exitCode = 1;
    });
  });
}

try {
  await engine.start();
} catch (error) {
  logger.error("executor_stopped_unexpectedly", { error });
  process.exitCode = 1;
} finally {
  await stop("engine_exit");
}
