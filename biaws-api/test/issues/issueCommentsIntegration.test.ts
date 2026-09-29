import { isolatedDatabaseName, restoreEnvironmentAfter, availablePort } from "../support/integration.js";
import assert from "node:assert/strict";
import test from "node:test";
import { issueResponseSchema } from "../../src/contracts/domainSchemas.js";

const integrationEnabled = Boolean(process.env.BIAWS_INTEGRATION_MONGO_URI);

test(
  "issue comments can be created and edited without losing their metadata",
  { skip: !integrationEnabled },
  async (t) => {
    restoreEnvironmentAfter(t);
    process.env.MONGO_URI = process.env.BIAWS_INTEGRATION_MONGO_URI;
    process.env.MONGO_DB = isolatedDatabaseName();

    const { closeMongoClient, getMongoDatabase } = await import("../../src/helpers/mongoClient.js");
    const { createApplication, ensureDefaultWorkspace } = await import("../../src/repositories/catalog/index.js");
    const { createIssue, createIssueComment, updateIssueComment } =
      await import("../../src/repositories/issues/index.js");
    const db = await getMongoDatabase();

    try {
      await db.dropDatabase();
      const actor = { userId: "issue-comments-integration" };
      const workspace = await ensureDefaultWorkspace(actor);
      const application = await createApplication(workspace.id, { key: "comments-app", name: "Comments App" }, actor);
      const query = { workspaceId: workspace.id };
      const created = await createIssue(
        {
          id: "COMMENTS-001",
          title: "Issue with comments",
          text: "Issue description",
          applicationId: application.id,
        },
        query,
      );
      assert.equal(issueResponseSchema.safeParse(JSON.parse(JSON.stringify({ issue: created.issue }))).success, true);
      const withComment = await createIssueComment(
        created.issueId,
        {
          text: "**First** comment",
          date: "2026-07-30",
          createdBy: "author@example.test",
        },
        query,
      );

      assert.equal(withComment.comments.length, 1);
      assert.equal(withComment.comments[0].from, "author@example.test");
      assert.equal(withComment.comments[0].text, "**First** comment");

      const edited = await updateIssueComment(
        created.issueId,
        withComment.comments[0]._id,
        {
          text: "**Edited** comment",
          date: "2026-07-31",
          updatedBy: "editor@example.test",
        },
        query,
      );

      assert.equal(edited.comments[0].text, "**Edited** comment");
      assert.equal(edited.comments[0].from, "author@example.test");
      assert.equal(edited.comments[0].updatedBy, "editor@example.test");
      assert.equal(edited.comments[0].date.toISOString().slice(0, 10), "2026-07-31");

      const withNewerComment = await createIssueComment(
        created.issueId,
        {
          text: "Newer comment",
          date: "2026-08-01",
          createdBy: "author@example.test",
        },
        query,
      );
      assert.deepEqual(
        withNewerComment.comments.map(({ text }) => text),
        ["Newer comment", "**Edited** comment"],
      );
    } finally {
      await db.dropDatabase();
      await closeMongoClient();
    }
  },
);
