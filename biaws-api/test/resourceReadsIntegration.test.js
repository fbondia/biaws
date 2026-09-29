import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { ObjectId } from "mongodb";
import express from "express";
import { COLLECTION_NAMES as C } from "../src/database/collectionNames.js";

test(
  "hierarchical API reads and alias mutations retain tenancy, parent relations and canonical audit IDs",
  { skip: !process.env.BIAWS_INTEGRATION_MONGO_URI },
  async () => {
    const directory = await mkdtemp(path.join(tmpdir(), "biaws-resources-"));
    Object.assign(process.env, {
      MONGO_URI: process.env.BIAWS_INTEGRATION_MONGO_URI,
      MONGO_DB: "biaws_resources_integration",
      BIAWS_ISSUE_DIR: directory,
      BIAWS_REQUEST_DIR: directory,
      BIAWS_DOCUMENT_DIR: directory,
    });
    const { getMongoDatabase, closeMongoClient } =
      await import("../src/helpers/mongoClient.js");
    const { ensureDefaultWorkspace, createApplication, createWorkspace } =
      await import("../src/repositories/catalog/index.js");
    const { createIssue, getIssue } =
      await import("../src/repositories/issues/index.js");
    const { getRequest, updateRequestTask } =
      await import("../src/repositories/requests/index.js");
    const { createDocument, getDocument } =
      await import("../src/repositories/documents/index.js");
    const { issuesRouter } = await import("../src/routes/issues/index.js");
    const { requestsRouter } = await import("../src/routes/requests/index.js");
    const { knowledgeRecordsRouter } =
      await import("../src/routes/knowledgeRecords/index.js");
    const db = await getMongoDatabase();
    let server;
    try {
      await db.dropDatabase();
      const workspace = await ensureDefaultWorkspace({
        userId: "resource-test",
      });
      const otherWorkspace = await createWorkspace(
        { key: "resource-other", name: "Other workspace" },
        { userId: "resource-test" },
      );
      const app = await createApplication(
        workspace.id,
        { key: "resource-app", name: "Resource App" },
        {},
      );
      const hiddenApp = await createApplication(
        workspace.id,
        { key: "hidden-app", name: "Hidden App" },
        {},
      );
      const context = {
        workspaceId: workspace.id,
        applicationId: app.id,
        affectedComponentIds: [],
      };
      const query = {
        authorizationScope: {
          workspaceId: workspace.id,
          workspace: false,
          applicationIds: [app.id],
        },
      };
      await createIssue(
        {
          id: "issue-id",
          identifier: "INC123",
          title: "Synthetic incident",
          text: "Synthetic details",
          applicationId: app.id,
          comment: "First comment",
        },
        query,
      );
      assert.equal((await getIssue("INC123", query)).issue.id, "issue-id");
      await db.collection(C.ISSUES).insertOne({
        id: "hidden-issue",
        identifier: "INC-HIDDEN",
        workspaceId: workspace.id,
        applicationId: hiddenApp.id,
      });
      await db.collection(C.ISSUES).insertOne({
        id: "other-issue",
        identifier: "INC123",
        workspaceId: otherWorkspace.id,
        applicationId: "other-app",
      });
      const demandId = new ObjectId();
      const taskId = new ObjectId();
      const noteId = new ObjectId();
      const otherDemandId = new ObjectId();
      await db.collection(C.REQUESTS).insertOne({
        _id: demandId,
        ...context,
        clientCode: "MEL123",
        title: "Synthetic demand",
        status: "Sugerido",
        attachments: [],
      });
      await db.collection(C.REQUESTS).insertOne({
        _id: otherDemandId,
        ...context,
        clientCode: "MEL456",
        title: "Other demand",
        status: "Sugerido",
      });
      await db.collection(C.REQUEST_TASKS).insertOne({
        _id: taskId,
        requestId: demandId,
        code: "TASK1",
        title: "Synthetic task",
        status: "Pendente",
      });
      await db.collection(C.REQUEST_TASK_NOTES).insertOne({
        _id: noteId,
        requestId: demandId,
        taskId,
        date: "2026-09-29",
        content: "Task evidence",
      });
      assert.equal(
        (await getRequest("MEL123", query)).request.id,
        String(demandId),
      );
      const updated = await updateRequestTask(
        "MEL123",
        "TASK1",
        { title: "Updated task", code: "TASK1", status: "Andamento" },
        query,
      );
      assert.equal(updated.request.tasks[0].status, "Andamento");
      const { uploadAttachments } =
        await import("../src/services/attachmentService.js");
      await uploadAttachments(
        "requests",
        "MEL123",
        [
          {
            originalname: "synthetic.txt",
            mimetype: "text/plain",
            size: 5,
            buffer: Buffer.from("hello"),
          },
        ],
        query,
        ["task1"],
      );
      const doc = (
        await createDocument(
          {
            identifier: "resource-guide",
            documentType: "procedure",
            title: "Guide",
            summary: "Synthetic summary",
            markdown: "# Synthetic guide",
            applicationId: app.id,
          },
          query,
        )
      ).document;
      assert.equal(
        (await getDocument("resource-guide", query)).document.id,
        doc.id,
      );
      const permissions = [
        "issues.read",
        "issues.comment.create",
        "issues.update",
        "issues.attachment.read",
        "demands.read",
        "tasks.update",
        "tasks.status.update",
        "tasks.attachment.read",
        "tasks.attachment.create",
        "tasks.attachment.update",
        "tasks.attachment.delete",
        "documents.read",
        "documents.update",
      ];
      const actor = {
        workspaceId: workspace.id,
        userId: "resource-test",
        permissions,
        permissionScopes: Object.fromEntries(
          permissions.map((permission) => [
            permission,
            { workspace: false, applicationIds: [app.id] },
          ]),
        ),
      };
      const http = express();
      http.use(express.json());
      http.use((req, res, next) => {
        req.actor = {
          ...actor,
          ...(req.headers["x-test-deny"] ? { permissions: [] } : {}),
        };
        next();
      });
      http.use("/api/issues", issuesRouter);
      http.use("/api/requests", requestsRouter);
      http.use("/api/knowledge", knowledgeRecordsRouter);
      http.use((error, req, res, next) => {
        res
          .status(error.statusCode || 500)
          .json({ error: { code: error.code, message: error.message } });
      });
      server = http.listen(0, "127.0.0.1");
      await new Promise((resolve, reject) => {
        server.once("listening", resolve);
        server.once("error", reject);
      });
      const base = `http://127.0.0.1:${server.address().port}`;
      async function request(route, options = {}) {
        return fetch(base + route, options);
      }
      let response = await request("/api/issues/INC123/comments?limit=1");
      assert.equal(response.status, 200);
      let result = await response.json();
      assert.equal(result.context.id, "issue-id");
      assert.equal(result.items[0].text, "First comment");
      assert.equal(result.meta.limit, 1);
      response = await request("/api/issues/INC123/comments", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text: "Second comment" }),
      });
      assert.equal(response.status, 201);
      const event = await db
        .collection(C.AUDIT_EVENTS)
        .findOne({ action: "comment_added" });
      assert.equal(event.rootId, "issue-id");
      assert.equal((await getIssue("INC123", query)).comments.length, 2);
      response = await request("/api/requests/MEL123/tasks/TASK1/notes");
      assert.equal(response.status, 200);
      result = await response.json();
      assert.equal(result.context.taskId, String(taskId));
      assert.equal(result.items[0].content, "Task evidence");
      response = await request("/api/requests/MEL123/tasks/TASK1/attachments");
      assert.equal(response.status, 200);
      const files = await response.json();
      assert.equal(files.items[0].filename, "synthetic.txt");
      assert.equal(files.items[0].storage, undefined);
      const fileId = files.items[0].id;
      response = await request(
        `/api/requests/MEL123/tasks/TASK1/attachments/${fileId}`,
      );
      assert.equal(response.status, 200);
      assert.equal(await response.text(), "hello");
      response = await request(
        `/api/requests/MEL123/tasks/TASK1/attachments/${fileId}/tags`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ tags: ["evidence"] }),
        },
      );
      assert.equal(response.status, 200);
      assert.deepEqual((await response.json()).attachment.tags, [
        "evidence",
        "task1",
      ]);
      assert.equal(
        (await request(`/api/requests/MEL456/tasks/${taskId}/notes`)).status,
        404,
      );
      assert.equal(
        (await request("/api/issues/INC-HIDDEN/comments")).status,
        404,
      );
      assert.equal(
        (await request("/api/issues/other-issue/comments")).status,
        404,
      );
      assert.equal(
        (
          await request("/api/issues/INC123/comments", {
            headers: { "x-test-deny": "1" },
          })
        ).status,
        403,
      );
      response = await request(
        "/api/knowledge/documents/resource-guide/content",
      );
      assert.equal(response.status, 200);
      assert.equal(await response.text(), "# Synthetic guide");
      assert.equal(
        (await request("/api/knowledge/documents/resource-guide/revisions/1"))
          .status,
        200,
      );
      await db.collection(C.REQUESTS).insertOne({
        ...context,
        clientCode: "MEL123",
        title: "Ambiguous duplicate",
      });
      assert.equal((await request("/api/requests/MEL123/tasks")).status, 409);
      assert.equal(
        (await request(`/api/requests/${demandId}/tasks`)).status,
        200,
      );
    } finally {
      if (server) await new Promise((resolve) => server.close(resolve));
      await db.dropDatabase();
      await closeMongoClient();
      await rm(directory, { recursive: true, force: true });
    }
  },
);
