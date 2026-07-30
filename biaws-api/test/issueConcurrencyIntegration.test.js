import assert from "node:assert/strict";
import test from "node:test";

const integrationEnabled = Boolean(process.env.BIAWS_INTEGRATION_MONGO_URI);

test(
  "concurrent issue creation preserves the unique public id",
  { skip: !integrationEnabled },
  async () => {
    process.env.MONGO_URI = process.env.BIAWS_INTEGRATION_MONGO_URI;
    process.env.MONGO_DB =
      process.env.BIAWS_ISSUE_CONCURRENCY_INTEGRATION_DB ||
      "biaws_issue_concurrency_integration";

    const { closeMongoClient, getMongoDatabase } =
      await import("../src/helpers/mongoClient.js");
    const { createApplication, ensureDefaultWorkspace } =
      await import("../src/repositories/catalogRepository.js");
    const { createIssue } =
      await import("../src/repositories/issuesRepository.js");
    const db = await getMongoDatabase();

    try {
      await db.dropDatabase();
      const actor = { userId: "concurrency-integration" };
      const workspace = await ensureDefaultWorkspace(actor);
      const application = await createApplication(
        workspace.id,
        { key: "concurrent-app", name: "Concurrent App" },
        actor,
      );
      const payload = {
        id: "CONCURRENT-001",
        title: "Concurrent issue",
        text: "Only one insert may succeed.",
        applicationId: application.id,
      };
      const query = { workspaceId: workspace.id };
      const results = await Promise.allSettled([
        createIssue(payload, query),
        createIssue(payload, query),
      ]);

      assert.equal(
        results.filter(({ status }) => status === "fulfilled").length,
        1,
      );
      const rejection = results.find(({ status }) => status === "rejected");
      assert.equal(rejection.reason.statusCode, 409);
      assert.equal(
        await db.collection("issues").countDocuments({ id: payload.id }),
        1,
      );
    } finally {
      await db.dropDatabase();
      await closeMongoClient();
    }
  },
);
