import { isolatedDatabaseName, restoreEnvironmentAfter } from "../support/integration.js";
import assert from "node:assert/strict";
import test from "node:test";
import { issueResponseSchema } from "../../src/contracts/domainSchemas.js";

const integrationEnabled = Boolean(process.env.BIAWS_INTEGRATION_MONGO_URI);

test(
  "issue comments can be created, edited and deleted without losing their metadata",
  { skip: !integrationEnabled },
  async (t) => {
    restoreEnvironmentAfter(t);
    process.env.MONGO_URI = process.env.BIAWS_INTEGRATION_MONGO_URI;
    process.env.MONGO_DB = isolatedDatabaseName();

    const { closeMongoClient, getMongoDatabase } = await import("../../src/helpers/mongoClient.js");
    const { createApplication, ensureDefaultWorkspace } = await import("../../src/repositories/catalog/index.js");
    const { createIssue, createIssueComment, deleteIssueComment, updateIssueComment } =
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
      assert.ok(edited.comments[0].date);
      assert.equal(edited.comments[0].date.toISOString().slice(0, 10), "2026-07-31");

      const unchangedDate = await updateIssueComment(
        created.issueId,
        withComment.comments[0]._id,
        { text: "**Edited** comment" },
        query,
      );
      assert.equal(unchangedDate.comments[0].date?.toISOString(), "2026-07-31T00:00:00.000Z");
      const unknown = await createIssueComment(created.issueId, { text: "Unknown date", date: null }, query);
      const unknownId = unknown.createdCommentId;
      assert.equal(unknown.comments.find((comment) => comment._id === unknownId)?.date, null);
      const preservedUnknown = await updateIssueComment(
        created.issueId,
        unknownId,
        { text: "Edited without a date" },
        query,
      );
      assert.equal(preservedUnknown.comments.find((comment) => comment._id === unknownId)?.date, null);
      const dated = await updateIssueComment(
        created.issueId,
        unknownId,
        { text: "Dated", date: "2026-07-30T13:42:15.123Z" },
        query,
      );
      assert.equal(
        dated.comments.find((comment) => comment._id === unknownId)?.date?.toISOString(),
        "2026-07-30T13:42:15.123Z",
      );
      const preservedTime = await updateIssueComment(
        created.issueId,
        unknownId,
        { text: "Edited dated comment" },
        query,
      );
      assert.equal(
        preservedTime.comments.find((comment) => comment._id === unknownId)?.date?.toISOString(),
        "2026-07-30T13:42:15.123Z",
      );
      const cleared = await updateIssueComment(created.issueId, unknownId, { text: "Cleared", date: null }, query);
      assert.equal(cleared.comments.find((comment) => comment._id === unknownId)?.date, null);
      for (const date of ["", "not-a-date"]) {
        await assert.rejects(
          updateIssueComment(created.issueId, unknownId, { text: "Invalid date", date }, query),
          /date must be a valid date/u,
        );
      }
      await deleteIssueComment(created.issueId, unknownId, {}, query);

      const beforeCreation = Date.now();
      const defaultDate = await createIssueComment(created.issueId, { text: "New manual comment" }, query);
      const manual = defaultDate.comments.find((comment) => comment._id === defaultDate.createdCommentId);
      assert.ok(manual?.date);
      assert.ok(manual.date.getTime() >= beforeCreation && manual.date.getTime() <= Date.now());
      await deleteIssueComment(created.issueId, defaultDate.createdCommentId, {}, query);

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

      const deleted = await deleteIssueComment(
        created.issueId,
        withComment.comments[0]._id,
        { deletedBy: "deleter@example.test" },
        query,
      );
      assert.equal(deleted.deletedCommentId, String(withComment.comments[0]._id));
      assert.deepEqual(
        deleted.comments.map(({ text }) => text),
        ["Newer comment"],
      );
      await assert.rejects(
        deleteIssueComment(created.issueId, withComment.comments[0]._id, {}, query),
        /Issue comment not found/u,
      );
    } finally {
      await db.dropDatabase();
      await closeMongoClient();
    }
  },
);
