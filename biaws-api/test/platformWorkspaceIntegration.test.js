import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { ObjectId } from "mongodb";

import { COLLECTION_NAMES } from "../src/database/collectionNames.js";

const integrationEnabled = Boolean(process.env.BIAWS_INTEGRATION_MONGO_URI);

test(
  "platform provisioning creates isolated groups and protects the last administrator",
  { skip: !integrationEnabled },
  async () => {
    process.env.MONGO_URI = process.env.BIAWS_INTEGRATION_MONGO_URI;
    process.env.MONGO_DB = `biaws_platform_test_${randomUUID().replaceAll("-", "")}`;

    const { closeMongoClient, getMongoDatabase } =
      await import("../src/helpers/mongoClient.js");
    const { ensureDefaultWorkspace } =
      await import("../src/repositories/catalogRepository.js");
    const { INITIAL_PERMISSION_GROUPS } =
      await import("../src/repositories/accessRepository.js");
    const {
      getWorkspaceSummary,
      provisionWorkspace,
      removeWorkspaceMember,
      setWorkspaceMemberGroups,
      setWorkspaceStatus,
    } = await import("../src/repositories/platformWorkspaceRepository.js");

    const db = await getMongoDatabase();
    try {
      await db.collection(COLLECTION_NAMES.AUTH_USERS).insertMany([
        { _id: "platform-admin-1", name: "Admin 1", email: "a1@example.test" },
        { _id: "platform-admin-2", name: "Admin 2", email: "a2@example.test" },
        {
          _id: "platform-member-3",
          name: "Member 3",
          email: "m3@example.test",
        },
      ]);
      const actor = { userId: "platform-admin-1" };
      const defaultWorkspace = await ensureDefaultWorkspace(actor);
      actor.workspaceId = defaultWorkspace.id;
      const { workspace, administrationGroupId } = await provisionWorkspace(
        {
          key: "workspace-managed",
          name: "Workspace Managed",
          administratorUserId: "platform-admin-1",
        },
        actor,
      );

      const summary = await getWorkspaceSummary(workspace.id);
      assert.equal(summary.members, 1);
      assert.equal(summary.groups, INITIAL_PERMISSION_GROUPS.length);
      assert.notEqual(administrationGroupId, "administration");

      const legacyGroupId = new ObjectId();
      await db.collection(COLLECTION_NAMES.PERMISSION_GROUPS).insertOne({
        _id: legacyGroupId,
        workspaceId: workspace.id,
        name: "Grupo legado",
        normalizedName: "grupo legado",
        description: "Grupo com ObjectId anterior à normalização atual.",
        permissions: ["issues.read"],
        scope: { type: "workspace", applicationIds: [] },
        active: true,
        system: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      assert.deepEqual(
        (
          await setWorkspaceMemberGroups(
            workspace.id,
            "platform-member-3",
            [legacyGroupId.toHexString()],
            actor,
          )
        ).groupIds,
        [legacyGroupId.toHexString()],
      );

      await setWorkspaceMemberGroups(
        workspace.id,
        "platform-admin-2",
        [administrationGroupId],
        actor,
      );
      await removeWorkspaceMember(workspace.id, "platform-admin-1");
      await assert.rejects(
        removeWorkspaceMember(workspace.id, "platform-admin-2"),
        (error) => error.code === "LAST_WORKSPACE_ADMIN",
      );

      assert.equal(
        (await setWorkspaceStatus(workspace.id, "archived", actor)).status,
        "archived",
      );
      assert.equal(
        (await setWorkspaceStatus(workspace.id, "active", actor)).status,
        "active",
      );
      await assert.rejects(
        setWorkspaceStatus(defaultWorkspace.id, "archived", actor),
        (error) => error.code === "DEFAULT_WORKSPACE_REQUIRED",
      );
    } finally {
      await db.dropDatabase();
      await closeMongoClient();
    }
  },
);
