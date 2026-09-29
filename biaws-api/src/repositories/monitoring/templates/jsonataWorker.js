// @ts-check
import { parentPort, workerData } from "node:worker_threads";
import jsonata from "jsonata";

async function run() {
  const port = parentPort;
  if (!port) throw new Error("JSONata worker requires a parent port");
  /** @type {{ expression: string, input: unknown }} */
  const payload = workerData;
  try {
    const expression = jsonata(payload.expression);
    const result = await expression.evaluate(payload.input);
    port.postMessage({ ok: true, result });
  } catch (error) {
    const details = error !== null && typeof error === "object" ? error : {};
    const code = "code" in details ? details.code : undefined;
    const rawPosition = "position" in details ? details.position : undefined;
    port.postMessage({
      ok: false,
      diagnostic: {
        code: String(code || "JSONATA_EVALUATION_ERROR").slice(0, 80),
        phase: rawPosition === undefined ? "runtime" : "compile",
        position: Number.isInteger(rawPosition) ? rawPosition : null,
      },
    });
  }
}

run();
