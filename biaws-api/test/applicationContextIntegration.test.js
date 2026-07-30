import assert from "node:assert/strict";
import test from "node:test";

import { COLLECTION_NAMES } from "../src/database/collectionNames.js";

const integrationEnabled = Boolean(process.env.BIAWS_INTEGRATION_MONGO_URI);

test(
  "application context is validated, inherited and filtered",
  { skip: !integrationEnabled },
  async () => {
    process.env.MONGO_URI = process.env.BIAWS_INTEGRATION_MONGO_URI;
    process.env.MONGO_DB =
      process.env.BIAWS_APPLICATION_CONTEXT_INTEGRATION_DB ||
      "biaws_application_context_integration";

    const { closeMongoClient, getMongoDatabase } =
      await import("../src/helpers/mongoClient.js");
    const { createApplication, ensureDefaultWorkspace } =
      await import("../src/repositories/catalogRepository.js");
    const { createComponent } =
      await import("../src/repositories/componentsRepository.js");
    const { createIssue, listIssues } =
      await import("../src/repositories/issuesRepository.js");
    const { createRequest, createRequestTask } =
      await import("../src/repositories/requestsRepository.js");
    const { createProcedure } =
      await import("../src/repositories/proceduresRepository.js");
    const { deleteAttachment, uploadAttachments } =
      await import("../src/services/attachmentService.js");
    const { getApplicationContext } =
      await import("../src/repositories/catalogContextRepository.js");

    const db = await getMongoDatabase();
    try {
      await db.dropDatabase();
      const actor = { userId: "phase3-integration" };
      const workspace = await ensureDefaultWorkspace(actor);
      const application = await createApplication(
        workspace.id,
        { key: "phase3", name: "Phase 3" },
        actor,
      );
      const component = await createComponent(
        application.id,
        { key: "api", name: "API", type: "api" },
        actor,
      );

      await assert.rejects(
        createIssue({ title: "No app", text: "Invalid" }),
        (error) =>
          error.statusCode === 422 && error.code === "APPLICATION_REQUIRED",
      );
      const issue = await createIssue({
        id: "PHASE3-001",
        title: "Context-aware issue",
        text: "Issue related to an application component.",
        applicationId: application.id,
        affectedComponentIds: [component.id],
      });
      assert.equal(issue.issue.workspaceId, workspace.id);
      assert.deepEqual(issue.issue.affectedComponentIds, [component.id]);
      assert.equal(
        (await listIssues({ applicationId: application.id })).items.length,
        1,
      );
      assert.equal(
        (await listIssues({ componentId: component.id })).items.length,
        1,
      );
      const attachmentContent = Buffer.from("phase 3 attachment");
      const attachmentResult = await uploadAttachments(
        "issues",
        issue.issueId,
        [
          {
            originalname: "phase-3.txt",
            mimetype: "text/plain",
            size: attachmentContent.length,
            buffer: attachmentContent,
          },
        ],
      );
      assert.deepEqual(attachmentResult.uploaded[0].context, {
        workspaceId: workspace.id,
        applicationId: application.id,
        affectedComponentIds: [component.id],
      });
      await deleteAttachment(
        "issues",
        issue.issueId,
        attachmentResult.uploaded[0].id,
      );

      const demand = await createRequest({
        title: "Context-aware demand",
        applicationId: application.id,
        affectedComponentIds: [component.id],
      });
      const withTask = await createRequestTask(demand.request.id, {
        title: "Inherited context",
      });
      assert.equal(withTask.request.tasks[0].applicationId, application.id);
      assert.equal(
        await db.collection(COLLECTION_NAMES.REQUEST_TASKS).countDocuments({
          applicationId: { $exists: true },
        }),
        0,
      );

      const procedure = await createProcedure({
        title: "Workspace procedure",
        summary: "General knowledge",
        procedure: "Run the documented steps.",
      });
      assert.equal(procedure.procedure.workspaceId, workspace.id);
      assert.equal(procedure.procedure.applicationId, null);
      const relatedProcedure = await createProcedure({
        title: "Application procedure",
        summary: "Application knowledge",
        procedure: "Run the application steps.",
        applicationId: application.id,
        affectedComponentIds: [component.id],
      });
      const applicationContext = await getApplicationContext(application.id);
      assert.equal(applicationContext.issues[0].id, issue.issueId);
      assert.equal(applicationContext.demands[0].id, demand.request.id);
      assert.equal(
        applicationContext.procedures[0].id,
        relatedProcedure.procedure.id,
      );
      assert.equal(
        Object.hasOwn(applicationContext.issues[0], "attachments"),
        false,
      );
      assert.equal(
        Object.hasOwn(applicationContext.demands[0], "description"),
        false,
      );
      assert.equal(
        Object.hasOwn(applicationContext.procedures[0], "procedure"),
        false,
      );
    } finally {
      await db.dropDatabase();
      await closeMongoClient();
    }
  },
);
