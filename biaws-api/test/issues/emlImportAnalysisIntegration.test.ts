import assert from "node:assert/strict";
import test from "node:test";
import { COLLECTION_NAMES } from "../../src/database/collectionNames.js";
import { isolatedDatabaseName, restoreEnvironmentAfter } from "../support/integration.js";

const integrationEnabled = Boolean(process.env.BIAWS_INTEGRATION_MONGO_URI);

test(
  "EML analysis returns sanitized content without requiring application context or writing an issue",
  { skip: !integrationEnabled },
  async (t) => {
    restoreEnvironmentAfter(t);
    process.env.MONGO_URI = process.env.BIAWS_INTEGRATION_MONGO_URI;
    process.env.MONGO_DB = isolatedDatabaseName();

    const { closeMongoClient, getMongoDatabase } = await import("../../src/helpers/mongoClient.js");
    const { analyzeEmlBuffer } = await import("../../src/services/emlImportService.js");
    const db = await getMongoDatabase();
    try {
      await db.dropDatabase();
      const result = await analyzeEmlBuffer(
        Buffer.from(
          [
            "From: customer@example.test",
            "To: support@example.test",
            "Subject: INC12345 Example failure",
            "Date: Tue, 29 Sep 2026 10:00:00 -0300",
            "",
            "The service is unavailable.",
          ].join("\r\n"),
        ),
        { filename: "issue.eml" },
      );

      assert.equal(result.mode, "analysis");
      assert.equal(result.issue.id, "INC12345");
      assert.equal(result.issue.title, "INC12345 Example failure");
      assert.match(result.issue.text, /service is unavailable/u);
      assert.equal(result.messages.length, 1);
      assert.equal(await db.collection(COLLECTION_NAMES.ISSUES).countDocuments(), 0);
      assert.equal(await db.collection(COLLECTION_NAMES.ISSUE_COMMENTS).countDocuments(), 0);
    } finally {
      await db.dropDatabase();
      await closeMongoClient();
    }
  },
);
