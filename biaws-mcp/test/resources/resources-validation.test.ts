import assert from "node:assert/strict";
import test from "node:test";
import { readResource } from "../../src/resources.js";
import { errorInfo } from "../helpers/types.js";
import { json, W, withApi } from "./resources.fixtures.js";
test("resource traversal, unsupported parameters and workspace changes fail before HTTP", async () => {
  await withApi(
    () => assert.fail("invalid URI must not reach HTTP"),
    async () => {
      for (const uri of [
        "biaws://workspaces/workspace-b/issues/id",
        W + "/issues/id?database=other",
        W + "/issues/id?limit=101",
        W + "/issues/id?page=9007199254740992",
        W + "/issues/%2Fetc",
        W + "/issues/%00",
        W + "/issues/id?limit=1&limit=2",
      ] as const) {
        await assert.rejects(readResource({ uri }));
      }
    },
  );
});

test("a resource outside a parent application fails instead of being mounted under a forged URI", async () => {
  await withApi(
    async (url) =>
      url.pathname.includes("/applications/")
        ? json({ application: { id: "app-a" } })
        : json({ deployment: { id: "deployment-a", applicationId: "app-b" } }),
    async () => {
      await assert.rejects(
        readResource({
          uri: W + "/applications/app-a/deployments/deployment-a",
        }),
        (error) => errorInfo(error).statusCode === 404,
      );
    },
  );
});
