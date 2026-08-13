import assert from "node:assert/strict";
import test from "node:test";

import { retryWithBackoff } from "../src/retry.js";

test("retry backoff stops at the configured attempt count", async () => {
  const delays = [];
  await assert.rejects(
    retryWithBackoff(
      async () => {
        throw new Error("still unavailable");
      },
      {
        attempts: 3,
        baseMs: 100,
        maxMs: 150,
        random: () => 1,
        sleep: async (delay) => delays.push(delay),
      },
    ),
    /still unavailable/u,
  );
  assert.deepEqual(delays, [100, 150]);
});
