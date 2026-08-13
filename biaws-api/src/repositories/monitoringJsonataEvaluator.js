import { Worker } from "node:worker_threads";

import { createCatalogError } from "./topologyRepositorySupport.js";

const WORKER_URL = new URL("./monitoringJsonataWorker.js", import.meta.url);

function evaluationError(code, message, diagnostic = null) {
  const error = createCatalogError(422, code, message);
  if (diagnostic) error.publicDetails = { diagnostic };
  return error;
}

export function evaluateJsonataIsolated(
  expression,
  input,
  { signal, timeoutMs = 1_000 } = {},
) {
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 5_000) {
    throw new TypeError("JSONata timeout must be between 1 and 5000 ms");
  }
  return new Promise((resolve, reject) => {
    const worker = new Worker(WORKER_URL, {
      workerData: { expression, input },
      execArgv: [],
      resourceLimits: {
        maxOldGenerationSizeMb: 16,
        maxYoungGenerationSizeMb: 4,
        stackSizeMb: 1,
      },
    });
    let settled = false;
    const finish = (callback, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
      void worker.terminate();
      callback(value);
    };
    const abort = () =>
      finish(
        reject,
        evaluationError(
          "MONITORING_TEMPLATE_EVALUATION_CANCELLED",
          "Monitoring template evaluation was cancelled",
        ),
      );
    const timer = setTimeout(
      () =>
        finish(
          reject,
          evaluationError(
            "MONITORING_TEMPLATE_EVALUATION_TIMEOUT",
            "Monitoring template evaluation exceeded its time limit",
          ),
        ),
      timeoutMs,
    );
    timer.unref?.();
    if (signal?.aborted) return abort();
    signal?.addEventListener("abort", abort, { once: true });
    worker.once("message", (message) => {
      if (message?.ok) return finish(resolve, message.result);
      finish(
        reject,
        evaluationError(
          "MONITORING_TEMPLATE_EVALUATION_FAILED",
          "Monitoring template expression could not be evaluated",
          message?.diagnostic || null,
        ),
      );
    });
    worker.once("error", () =>
      finish(
        reject,
        evaluationError(
          "MONITORING_TEMPLATE_EVALUATION_FAILED",
          "Monitoring template worker failed safely",
        ),
      ),
    );
    worker.once("exit", (code) => {
      if (!settled) {
        finish(
          reject,
          evaluationError(
            "MONITORING_TEMPLATE_EVALUATION_FAILED",
            code === 0
              ? "Monitoring template worker returned no result"
              : "Monitoring template worker stopped safely",
          ),
        );
      }
    });
  });
}
