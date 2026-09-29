import assert from "node:assert/strict";
import test from "node:test";
import { connectTestServer } from "../helpers/sdk.js";
import { W } from "./resources.fixtures.js";
test("resources/read returns a numeric SDK protocol error when a read fails", async (t) => {
  const session = await connectTestServer({
    readResource: async () => {
      throw Object.assign(new Error("Not found"), { statusCode: 404 });
    },
  });
  t.after(() => session.close());
  await assert.rejects(
    session.client.readResource({ uri: W }),
    (error) =>
      error instanceof Error && "code" in error && error.code === -32602,
  );
});
