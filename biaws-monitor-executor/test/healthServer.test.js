import assert from "node:assert/strict";
import test from "node:test";

import { createHealthRequestHandler } from "../src/healthServer.js";
import { createTelemetry } from "../src/telemetry.js";

function request(handler, url) {
  return new Promise((resolve) => {
    const headers = {};
    const response = {
      writeHead(statusCode, responseHeaders) {
        this.statusCode = statusCode;
        Object.assign(headers, responseHeaders);
      },
      end(body = "") {
        resolve({ statusCode: this.statusCode, headers, body });
      },
    };
    handler({ method: "GET", url }, response);
  });
}

test("health handler distinguishes liveness, readiness and metrics", async () => {
  let ready = false;
  const telemetry = createTelemetry();
  telemetry.increment("polls");
  const handler = createHealthRequestHandler({
    status: () => ({ live: true, ready }),
    telemetry,
  });

  assert.equal((await request(handler, "/health/live")).statusCode, 200);
  assert.equal((await request(handler, "/health/ready")).statusCode, 503);
  ready = true;
  assert.equal((await request(handler, "/health/ready")).statusCode, 200);
  assert.match(
    (await request(handler, "/metrics")).body,
    /biaws_monitor_executor_polls_total 1/u,
  );
});
