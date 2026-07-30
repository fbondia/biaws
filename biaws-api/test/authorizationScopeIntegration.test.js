import assert from "node:assert/strict";
import test from "node:test";

import { COLLECTION_NAMES } from "../src/database/collectionNames.js";

const integrationEnabled = Boolean(process.env.BIAWS_INTEGRATION_MONGO_URI);

test(
  "two workspaces and crossed application grants remain isolated",
  { skip: !integrationEnabled },
  async () => {
    process.env.MONGO_URI = process.env.BIAWS_INTEGRATION_MONGO_URI;
    process.env.MONGO_DB =
      process.env.BIAWS_AUTHORIZATION_SCOPE_INTEGRATION_DB ||
      "biaws_authorization_scope_integration";

    const { closeMongoClient, getMongoDatabase } =
      await import("../src/helpers/mongoClient.js");
    const {
      calculatePermissionScopes,
      createPermissionGroup,
      resolveUserAuthorization,
      setUserGroups,
    } = await import("../src/repositories/accessRepository.js");
    const { createApplication, createWorkspace, ensureDefaultWorkspace } =
      await import("../src/repositories/catalogRepository.js");
    const { createIssue, getIssue, listIssues } =
      await import("../src/repositories/issuesRepository.js");
    const { listAuditEvents, recordAuditEvent } =
      await import("../src/repositories/auditRepository.js");
    const { readAttachment } =
      await import("../src/services/attachmentService.js");

    const db = await getMongoDatabase();
    try {
      await db.dropDatabase();
      const systemActor = { userId: "scope-integration" };
      const workspaceA = await ensureDefaultWorkspace(systemActor);
      const workspaceB = await createWorkspace(
        { key: "workspace-b", name: "Workspace B" },
        systemActor,
      );
      const applicationA = await createApplication(
        workspaceA.id,
        { key: "application-a", name: "Application A" },
        systemActor,
      );
      const applicationB = await createApplication(
        workspaceB.id,
        { key: "application-b", name: "Application B" },
        systemActor,
      );
      const userId = "scope-user";
      await db.collection(COLLECTION_NAMES.AUTH_USERS).insertOne({
        _id: userId,
        id: userId,
        name: "Scope User",
        email: "scope@example.test",
      });

      const groupA = await createPermissionGroup(
        {
          workspaceId: workspaceA.id,
          name: "Application A reader",
          permissions: ["issues.read", "issues.create"],
          scope: {
            type: "applications",
            applicationIds: [applicationA.id],
          },
        },
        { ...systemActor, workspaceId: workspaceA.id },
      );
      const groupB = await createPermissionGroup(
        {
          workspaceId: workspaceB.id,
          name: "Application B reader",
          permissions: ["issues.read", "issues.create"],
          scope: {
            type: "applications",
            applicationIds: [applicationB.id],
          },
        },
        { ...systemActor, workspaceId: workspaceB.id },
      );
      await setUserGroups(userId, [groupA.id], {
        ...systemActor,
        workspaceId: workspaceA.id,
      });
      await setUserGroups(userId, [groupB.id], {
        ...systemActor,
        workspaceId: workspaceB.id,
      });

      const authA = await resolveUserAuthorization(userId, workspaceA.id);
      const authB = await resolveUserAuthorization(userId, workspaceB.id);
      assert.equal(authA.workspaces.length, 2);
      assert.deepEqual(authA.permissionScopes["issues.read"].applicationIds, [
        applicationA.id,
      ]);
      assert.deepEqual(authB.permissionScopes["issues.read"].applicationIds, [
        applicationB.id,
      ]);

      const scopeA = {
        workspaceId: workspaceA.id,
        ...authA.permissionScopes["issues.read"],
      };
      const scopeB = {
        workspaceId: workspaceB.id,
        ...authB.permissionScopes["issues.read"],
      };
      await createIssue(
        {
          id: "SCOPE-A",
          title: "Workspace A",
          text: "Only A can read this.",
          applicationId: applicationA.id,
        },
        { authorizationScope: scopeA },
      );
      await createIssue(
        {
          id: "SCOPE-B",
          title: "Workspace B",
          text: "Only B can read this.",
          applicationId: applicationB.id,
        },
        { authorizationScope: scopeB },
      );

      assert.deepEqual(
        (await listIssues({ authorizationScope: scopeA })).items.map(
          ({ id }) => id,
        ),
        ["SCOPE-A"],
      );
      assert.deepEqual(
        (await listIssues({ authorizationScope: scopeB })).items.map(
          ({ id }) => id,
        ),
        ["SCOPE-B"],
      );
      assert.equal(
        (await getIssue("SCOPE-B", { authorizationScope: scopeA })).issue,
        null,
      );
      assert.equal(
        (
          await listIssues({
            workspaceId: workspaceB.id,
            applicationId: applicationB.id,
            authorizationScope: scopeA,
          })
        ).items.length,
        0,
      );
      await db.collection("issues").updateOne(
        { id: "SCOPE-B" },
        {
          $set: {
            attachments: [
              {
                id: "scope-b-attachment",
                filename: "private.txt",
                storage: { provider: "local", key: "private.txt" },
              },
            ],
          },
        },
      );
      await assert.rejects(
        readAttachment("issues", "SCOPE-B", "scope-b-attachment", {
          authorizationScope: scopeA,
        }),
        (error) => error.statusCode === 404,
      );

      await recordAuditEvent({
        actor: systemActor,
        action: "created",
        target: { type: "issue", id: "SCOPE-A" },
        metadata: {
          workspaceId: workspaceA.id,
          applicationId: applicationA.id,
        },
      });
      assert.equal(
        (
          await listAuditEvents("issue", "SCOPE-A", {
            authorizationScope: scopeA,
          })
        ).length,
        1,
      );
      assert.equal(
        (
          await listAuditEvents("issue", "SCOPE-A", {
            authorizationScope: scopeB,
          })
        ).length,
        0,
      );

      assert.deepEqual(
        calculatePermissionScopes([groupA])["issues.read"].applicationIds,
        [applicationA.id],
      );
    } finally {
      await db.dropDatabase();
      await closeMongoClient();
    }
  },
);
