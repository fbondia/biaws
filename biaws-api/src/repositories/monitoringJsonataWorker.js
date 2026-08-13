import { parentPort, workerData } from "node:worker_threads";

import jsonata from "jsonata";

async function run() {
  try {
    const expression = jsonata(workerData.expression);
    const result = await expression.evaluate(workerData.input);
    parentPort.postMessage({ ok: true, result });
  } catch (error) {
    parentPort.postMessage({
      ok: false,
      diagnostic: {
        code: String(error?.code || "JSONATA_EVALUATION_ERROR").slice(0, 80),
        phase: error?.position === undefined ? "runtime" : "compile",
        position: Number.isInteger(error?.position) ? error.position : null,
      },
    });
  }
}

run();
