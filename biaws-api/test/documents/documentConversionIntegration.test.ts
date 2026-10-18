import assert from "node:assert/strict";
import test from "node:test";
import { isolatedDatabaseName, restoreEnvironmentAfter } from "../support/integration.js";
import { errorCode } from "../../src/helpers/error.js";

const integrationEnabled = Boolean(process.env.BIAWS_INTEGRATION_MONGO_URI);
test(
  "conversion and incorporation persist revisions, preserve source identity and respect write scopes",
  { skip: !integrationEnabled },
  async (t) => {
    restoreEnvironmentAfter(t);
    process.env.MONGO_URI = process.env.BIAWS_INTEGRATION_MONGO_URI;
    process.env.MONGO_DB = isolatedDatabaseName();
    const { getMongoDatabase, closeMongoClient } = await import("../../src/helpers/mongoClient.js");
    const { ensureDefaultWorkspace, createApplication } = await import("../../src/repositories/catalog/index.js");
    const { createDocument, getDocument, listDocumentRevisions } =
      await import("../../src/repositories/documents/index.js");
    const { convertDocument } = await import("../../src/repositories/documents/conversion.js");
    const db = await getMongoDatabase();
    try {
      const workspace = await ensureDefaultWorkspace({ userId: "conversion-test" });
      const application = await createApplication(
        workspace.id,
        { key: "conversion", name: "Conversion" },
        { userId: "conversion-test" },
      );
      const query = { authorizationScope: { workspaceId: workspace.id, workspace: true } };
      const created = (
        await createDocument(
          {
            documentType: "business-rule",
            title: "Regra",
            summary: "Resumo",
            markdown: "Conteúdo da regra",
            applicationId: application.id,
            details: { ruleCode: "RN-1" },
          },
          query,
        )
      ).document!;
      const converted = await convertDocument(
        created.id,
        { targetType: "free-text", additionalData: "append", expectedUpdatedAt: created.updatedAt!.toISOString() },
        query,
      );
      assert.equal(converted.document.id, created.id);
      assert.equal(converted.document.documentType, "free-text");
      assert.match(converted.document.markdown || "", /RN-1/u);
      assert.equal(converted.document.applicationId, application.id);
      const revisions = (await listDocumentRevisions(created.id, query)).items;
      assert.equal(revisions.length, 2);
      const previousRevision = revisions[1];
      assert.ok(previousRevision);
      assert.equal(previousRevision.snapshot.documentType, "business-rule");
      await assert.rejects(
        convertDocument(
          created.id,
          { targetType: "catalog", additionalData: "discard", expectedUpdatedAt: created.updatedAt!.toISOString() },
          query,
        ),
        (error) => errorCode(error) === "DOCUMENT_CHANGED",
      );
      const target = (
        await createDocument({ documentType: "catalog", title: "Serviços", details: { items: [] } }, query)
      ).document!;
      const incorporated = await convertDocument(
        created.id,
        { mode: "catalog-item", targetType: "catalog", targetCatalogId: target.id, additionalData: "append" },
        query,
      );
      assert.equal(incorporated.document.id, target.id);
      const items = incorporated.document.details.items;
      assert.ok(Array.isArray(items));
      assert.equal(items[0].title, "Regra");
      assert.match(items[0].description, /Conteúdo da regra/u);
      assert.equal((await getDocument(created.id, query)).document!.documentType, "free-text");
      await assert.rejects(
        convertDocument(
          created.id,
          { mode: "catalog-item", targetType: "catalog", targetCatalogId: target.id, additionalData: "append" },
          query,
        ),
        (error) => errorCode(error) === "DOCUMENT_ALREADY_IN_CATALOG",
      );
      await assert.rejects(
        convertDocument(
          created.id,
          { targetType: "catalog", additionalData: "append" },
          { authorizationScope: { workspaceId: workspace.id, workspace: false, applicationIds: ["unrelated-app"] } },
        ),
        (error) => errorCode(error) === "DOCUMENT_NOT_FOUND",
      );
    } finally {
      await db.dropDatabase();
      await closeMongoClient();
    }
  },
);
