import assert from "node:assert/strict";
import test from "node:test";
import { ObjectId } from "mongodb";
import { isolatedDatabaseName, restoreEnvironmentAfter } from "../support/integration.js";
import { COLLECTION_NAMES as C } from "../../src/database/collectionNames.js";

test(
  "Mongo references select exact skill/template versions within the authorized workspace",
  { skip: !process.env.BIAWS_INTEGRATION_MONGO_URI },
  async (t) => {
    restoreEnvironmentAfter(t);
    Object.assign(process.env, {
      MONGO_URI: process.env.BIAWS_INTEGRATION_MONGO_URI,
      MONGO_DB: isolatedDatabaseName(),
    });
    const { getMongoDatabase, closeMongoClient } = await import("../../src/helpers/mongoClient.js");
    const { getSkill } = await import("../../src/repositories/skills/queries.js");
    const { requireTemplate } = await import("../../src/repositories/monitoring/templates/storage.js");
    const db = await getMongoDatabase();
    try {
      const skillId = new ObjectId();
      await db.collection(C.SKILLS).insertMany([
        {
          _id: skillId,
          workspaceId: "workspace-a",
          skillId: "synthetic-skill",
          version: "1.0.0",
          status: "published",
          files: [{ path: "SKILL.md", contentBase64: "ZXhhbXBsZQ==" }],
        },
        { workspaceId: "workspace-a", skillId: "synthetic-skill", version: "2.0.0", status: "published", files: [] },
      ]);
      const query = { authorizationScope: { workspaceId: "workspace-a", workspace: true, applicationIds: [] } };
      assert.equal((await getSkill(String(skillId), undefined, query)).skill?.version, "1.0.0");
      assert.equal((await getSkill("synthetic-skill", undefined, query)).skill?.version, "2.0.0");
      assert.equal((await getSkill(String(skillId), undefined, { workspaceId: "workspace-b" })).skill, null);
      assert.equal(
        Object.hasOwn((await getSkill(String(skillId), undefined, query)).skill?.files?.[0] || {}, "contentBase64"),
        false,
      );
      const templateId = new ObjectId();
      await db.collection(C.RUNTIME_MONITORING_TEMPLATES).insertMany([
        {
          _id: templateId,
          workspaceId: "workspace-a",
          id: "template-id",
          name: "Synthetic template",
          version: "1",
          versionNumber: 1,
          status: "active",
        },
        {
          workspaceId: "workspace-a",
          id: "template-id",
          name: "Synthetic template",
          version: "2",
          versionNumber: 2,
          status: "active",
        },
      ]);
      assert.equal((await requireTemplate(String(templateId), undefined, "workspace-a")).version, "1");
      assert.equal((await requireTemplate("template-id", undefined, "workspace-a")).version, "2");
      await assert.rejects(requireTemplate(String(templateId), undefined, "workspace-b"), { statusCode: 404 });
    } finally {
      await db.dropDatabase();
      await closeMongoClient();
    }
  },
);
