import assert from "node:assert/strict";
import test from "node:test";

import { isolatedDatabaseName, restoreEnvironmentAfter } from "../support/integration.js";

const integrationEnabled = Boolean(process.env.BIAWS_INTEGRATION_MONGO_URI);

test(
  "taxonomy transfer updates issue and document classifications idempotently",
  { skip: !integrationEnabled },
  async (t) => {
    restoreEnvironmentAfter(t);
    process.env.MONGO_URI = process.env.BIAWS_INTEGRATION_MONGO_URI;
    process.env.MONGO_DB = isolatedDatabaseName();

    const { closeMongoClient, getMongoDatabase } = await import("../../src/helpers/mongoClient.js");
    const { transferTaxonomyReferences } = await import("../../src/repositories/issues/taxonomyTransfer.js");
    const db = await getMongoDatabase();
    const workspaceId = "taxonomy-transfer-workspace";

    try {
      await db.dropDatabase();
      await db.collection("taxonomies").insertOne({
        workspaceId,
        key: "biaws",
        status: "active",
        taxonomy: [
          { id: "origem", label: "Origem", applicationIds: [] },
          { id: "destino", label: "Destino", applicationIds: [] },
          { id: "outro", label: "Outro", applicationIds: [] },
          { id: "destino-app-a", label: "Destino A", applicationIds: ["app-a"] },
        ],
      });
      await db.collection("issues").insertMany([
        {
          id: "ISSUE-1",
          workspaceId,
          applicationId: "app-a",
          classification: {
            primaryTaxonomyId: "origem",
            secondaryTaxonomyIds: ["destino", "outro"],
            tags: { ambiente: ["producao"] },
          },
        },
        {
          id: "ISSUE-2",
          workspaceId,
          applicationId: "app-b",
          classification: { primaryTaxonomyId: "outro", secondaryTaxonomyIds: ["origem"] },
        },
      ]);
      await db.collection("documents").insertOne({
        id: "DOC-1",
        workspaceId,
        applicationId: "",
        classification: { primaryTaxonomyId: "origem", secondaryTaxonomyIds: [] },
      });

      const result = await transferTaxonomyReferences(
        { sourceTaxonomyId: "origem", destinationTaxonomyId: "destino", updatedBy: "tester" },
        { workspaceId },
      );
      assert.deepEqual(result.transfer.results, {
        issues: { matched: 2, modified: 2 },
        documents: { matched: 1, modified: 1 },
      });
      assert.equal(result.transfer.modified, 3);

      const issues = await db.collection("issues").find({ workspaceId }).sort({ id: 1 }).toArray();
      assert.deepEqual(issues[0].classification.primaryTaxonomyId, "destino");
      assert.deepEqual(issues[0].classification.secondaryTaxonomyIds, ["outro"]);
      assert.deepEqual(issues[0].classification.tags, { ambiente: ["producao"] });
      assert.deepEqual(issues[1].classification.secondaryTaxonomyIds, ["destino"]);
      const document = await db.collection("documents").findOne({ id: "DOC-1" });
      assert.equal(document?.classification.primaryTaxonomyId, "destino");

      const repeated = await transferTaxonomyReferences(
        { sourceTaxonomyId: "origem", destinationTaxonomyId: "destino", updatedBy: "tester" },
        { workspaceId },
      );
      assert.equal(repeated.transfer.modified, 0);

      await db
        .collection("documents")
        .updateOne(
          { id: "DOC-1" },
          { $set: { classification: { primaryTaxonomyId: "origem", secondaryTaxonomyIds: [] } } },
        );
      await assert.rejects(
        transferTaxonomyReferences(
          { sourceTaxonomyId: "origem", destinationTaxonomyId: "destino-app-a", updatedBy: "tester" },
          { workspaceId },
        ),
        (error: Error & { code?: string }) => error.code === "TAXONOMY_TRANSFER_SCOPE_MISMATCH",
      );
      assert.equal(
        (await db.collection("documents").findOne({ id: "DOC-1" }))?.classification.primaryTaxonomyId,
        "origem",
      );
    } finally {
      await db.dropDatabase();
      await closeMongoClient();
    }
  },
);
