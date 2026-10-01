import { isolatedDatabaseName, restoreEnvironmentAfter } from "../support/integration.js";
import assert from "node:assert/strict";
import test from "node:test";
import { ObjectId } from "mongodb";

const integrationEnabled = Boolean(process.env.BIAWS_INTEGRATION_MONGO_URI);

test(
  "editing an imported EML comment preserves unknown dates and the original date text",
  { skip: !integrationEnabled },
  async (t) => {
    restoreEnvironmentAfter(t);
    process.env.MONGO_URI = process.env.BIAWS_INTEGRATION_MONGO_URI;
    process.env.MONGO_DB = isolatedDatabaseName();
    const { closeMongoClient, getMongoDatabase } = await import("../../src/helpers/mongoClient.js");
    const { createApplication, ensureDefaultWorkspace } = await import("../../src/repositories/catalog/index.js");
    const { getIssue, updateIssueComment } = await import("../../src/repositories/issues/index.js");
    const { importEmlBuffer } = await import("../../src/services/emlImportService.js");
    const { COLLECTION_NAMES } = await import("../../src/database/collectionNames.js");
    const db = await getMongoDatabase();
    try {
      const actor = { userId: "unknown-comment-date-test" };
      const workspace = await ensureDefaultWorkspace(actor);
      const application = await createApplication(
        workspace.id,
        { key: "unknown-date-app", name: "Unknown date app" },
        actor,
      );
      const query = { workspaceId: workspace.id };
      await importEmlBuffer(
        Buffer.from(
          [
            "From: customer@example.test",
            "To: support@example.test",
            "Subject: Historical comment",
            "",
            "From: customer@example.test",
            "Sent: data desconhecida",
            "To: support@example.test",
            "",
            "Historical comment text.",
          ].join("\r\n"),
        ),
        { ...query, applicationId: application.id, filename: "unknown-date.eml", explicitId: "UNKNOWN-DATE-001" },
      );
      const imported = await getIssue("UNKNOWN-DATE-001", query);
      assert.equal(imported.comments.length, 1);
      const comment = imported.comments[0];
      assert.equal(comment.date, null);
      const filter = { _id: new ObjectId(comment._id) };
      assert.equal(
        (await db.collection(COLLECTION_NAMES.ISSUE_COMMENTS).findOne(filter))?.rawDate,
        "data desconhecida",
      );
      for (const datePatch of [{}, { date: null }, { date: "2026-07-30" }]) {
        const edited = await updateIssueComment(
          "UNKNOWN-DATE-001",
          comment._id,
          { text: "Edited historical comment", ...datePatch },
          query,
        );
        assert.equal(
          edited.comments[0].date?.toISOString() ?? null,
          datePatch.date ? "2026-07-30T00:00:00.000Z" : null,
        );
        const stored = await db.collection(COLLECTION_NAMES.ISSUE_COMMENTS).findOne(filter);
        assert.equal(stored?.rawDate, "data desconhecida");
        assert.ok(stored?.createdAt instanceof Date);
        assert.ok(stored?.updatedAt instanceof Date);
      }
    } finally {
      await db.dropDatabase();
      await closeMongoClient();
    }
  },
);
