import { errorCode, errorStatusCode } from "../../src/helpers/error.js";
import {
  isolatedDatabaseName,
  restoreEnvironmentAfter,
  availablePort,
} from "../support/integration.js";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { Readable } from "node:stream";
import test from "node:test";

import { COLLECTION_NAMES } from "../../src/database/collectionNames.js";
import { demandResponseSchema } from "../../src/contracts/domainSchemas.js";

const integrationEnabled = Boolean(process.env.BIAWS_INTEGRATION_MONGO_URI);

test(
  "application context is validated, inherited and filtered",
  { skip: !integrationEnabled },
  async (t) => {
    restoreEnvironmentAfter(t);
    const issueDirectory = await mkdtemp(
      path.join(tmpdir(), "biaws-application-context-"),
    );
    process.env.MONGO_URI = process.env.BIAWS_INTEGRATION_MONGO_URI;
    process.env.MONGO_DB = isolatedDatabaseName();
    process.env.BIAWS_ISSUE_DIR = issueDirectory;
    process.env.ATTACHMENT_STORAGE_LOCAL_DIR = issueDirectory;

    const { closeMongoClient, getMongoDatabase } =
      await import("../../src/helpers/mongoClient.js");
    const { createApplication, ensureDefaultWorkspace } =
      await import("../../src/repositories/catalog/index.js");
    const { createComponent } =
      await import("../../src/repositories/components/index.js");
    const { createIssue, listIssues } =
      await import("../../src/repositories/issues/index.js");
    const { createRequest, createRequestTask } =
      await import("../../src/repositories/requests/index.js");
    const { createDocument } =
      await import("../../src/repositories/documents/index.js");
    const { deleteAttachment, uploadAttachments } =
      await import("../../src/services/attachmentService.js");
    const { getApplicationContext } =
      await import("../../src/repositories/catalog/applications/context.js");

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
          errorStatusCode(error) === 422 &&
          errorCode(error) === "APPLICATION_REQUIRED",
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
            fieldname: "files",
            originalname: "phase-3.txt",
            encoding: "7bit",
            mimetype: "text/plain",
            size: attachmentContent.length,
            buffer: attachmentContent,
            stream: Readable.from(attachmentContent),
            destination: "",
            filename: "phase-3.txt",
            path: "",
          },
        ],
      );
      assert.deepEqual(attachmentResult.uploaded[0].context, {
        workspaceId: workspace.id,
        applicationId: application.id,
        affectedComponentIds: [component.id],
      });
      assert.ok(attachmentResult.uploaded[0].id);
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
      assert.ok(demand.request);
      assert.equal(
        demandResponseSchema.safeParse(JSON.parse(JSON.stringify(demand)))
          .success,
        true,
      );
      const withTask = await createRequestTask(demand.request.id, {
        title: "Inherited context",
      });
      assert.ok(withTask.request);
      assert.equal(withTask.request.tasks[0].applicationId, application.id);
      assert.equal(
        await db.collection(COLLECTION_NAMES.REQUEST_TASKS).countDocuments({
          applicationId: { $exists: true },
        }),
        0,
      );

      const procedure = await createDocument({
        documentType: "procedure",
        title: "Workspace procedure",
        summary: "General knowledge",
        markdown: "Run the documented steps.",
        status: "published",
      });
      assert.ok(procedure.document);
      assert.equal(procedure.document.workspaceId, workspace.id);
      assert.equal(procedure.document.applicationId, null);
      const relatedProcedure = await createDocument({
        documentType: "procedure",
        title: "Application procedure",
        summary: "Application knowledge",
        markdown: "Run the application steps.",
        status: "published",
        applicationId: application.id,
        affectedComponentIds: [component.id],
      });
      assert.ok(relatedProcedure.document);
      const applicationContext = await getApplicationContext(application.id);
      assert.equal(applicationContext.issues[0].id, issue.issueId);
      assert.equal(applicationContext.demands[0].id, demand.request.id);
      const contextProcedure = applicationContext.documents.find(
        ({ documentType }) => documentType === "procedure",
      );
      assert.ok(contextProcedure);
      assert.equal(contextProcedure.id, relatedProcedure.document.id);
      assert.equal(
        Object.hasOwn(applicationContext.issues[0], "attachments"),
        false,
      );
      assert.equal(
        Object.hasOwn(applicationContext.demands[0], "description"),
        false,
      );
      assert.equal(
        Object.hasOwn(applicationContext.documents[0], "markdown"),
        false,
      );
    } finally {
      await db.dropDatabase();
      await closeMongoClient();
      await rm(issueDirectory, { recursive: true, force: true });
    }
  },
);
