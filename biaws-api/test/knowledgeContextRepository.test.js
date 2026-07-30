import assert from "node:assert/strict";
import test from "node:test";

import {
  buildKnowledgeContextFilter,
  knowledgeContextMetadata,
  normalizeAffectedComponentIds,
  resolveKnowledgeContext,
} from "../src/repositories/knowledgeContextRepository.js";

function fakeDatabase({ workspace, application, components = [] }) {
  const collections = {
    workspaces: [workspace],
    applications: [application],
    applicationComponents: components,
  };
  return {
    collection(name) {
      const documents = collections[name] || [];
      return {
        async findOne(filter) {
          return (
            documents.find((document) =>
              Object.entries(filter).every(
                ([key, value]) => document[key] === value,
              ),
            ) || null
          );
        },
        find(filter) {
          const ids = filter.id?.$in || [];
          const matches = documents.filter((document) =>
            ids.includes(document.id),
          );
          return {
            project() {
              return {
                async toArray() {
                  return matches;
                },
              };
            },
          };
        },
      };
    },
  };
}

test("normalizes affected components and builds scoped filters", () => {
  assert.deepEqual(
    normalizeAffectedComponentIds([
      "component-1",
      " component-1 ",
      "",
      "component-2",
    ]),
    ["component-1", "component-2"],
  );
  assert.deepEqual(
    buildKnowledgeContextFilter({
      workspaceId: " workspace-1 ",
      applicationId: "application-1",
      affectedComponentId: "component-1",
    }),
    {
      workspaceId: "workspace-1",
      applicationId: "application-1",
      affectedComponentIds: "component-1",
    },
  );
});

test("authorization scope overrides client workspace and application filters", () => {
  assert.deepEqual(
    buildKnowledgeContextFilter({
      workspaceId: "workspace-forged",
      applicationId: "app-forged",
      authorizationScope: {
        workspaceId: "workspace-a",
        workspace: false,
        applicationIds: ["app-a", "app-b"],
      },
    }),
    {
      workspaceId: "workspace-a",
      applicationId: { $in: [] },
    },
  );
  assert.deepEqual(
    buildKnowledgeContextFilter({
      applicationId: "app-b",
      authorizationScope: {
        workspaceId: "workspace-a",
        workspace: false,
        applicationIds: ["app-a", "app-b"],
      },
    }),
    {
      workspaceId: "workspace-a",
      applicationId: "app-b",
    },
  );
});

test("resolves workspace from the application and validates active components", async () => {
  const workspace = {
    id: "workspace-1",
    key: "default",
    default: true,
    status: "active",
  };
  const application = {
    id: "application-1",
    workspaceId: workspace.id,
    status: "active",
  };
  const component = {
    id: "component-1",
    workspaceId: workspace.id,
    applicationId: application.id,
    status: "active",
  };
  const context = await resolveKnowledgeContext(
    fakeDatabase({ workspace, application, components: [component] }),
    {
      applicationId: application.id,
      affectedComponentIds: [component.id],
    },
    null,
    { applicationRequired: true, create: true },
  );
  assert.deepEqual(context, {
    workspaceId: workspace.id,
    applicationId: application.id,
    affectedComponentIds: [component.id],
  });
  assert.deepEqual(knowledgeContextMetadata(context), context);
});

test("rejects cross-application, archived or missing affected components", async () => {
  const workspace = {
    id: "workspace-1",
    key: "default",
    default: true,
    status: "active",
  };
  const application = {
    id: "application-1",
    workspaceId: workspace.id,
    status: "active",
  };
  const component = {
    id: "component-1",
    workspaceId: workspace.id,
    applicationId: "another-application",
    status: "active",
  };
  await assert.rejects(
    resolveKnowledgeContext(
      fakeDatabase({ workspace, application, components: [component] }),
      {
        applicationId: application.id,
        affectedComponentIds: [component.id, "missing"],
      },
      null,
      { applicationRequired: true, create: true },
    ),
    (error) =>
      error.statusCode === 422 && error.code === "INVALID_AFFECTED_COMPONENTS",
  );
});

test("requires applications for new issues and demands", async () => {
  const workspace = {
    id: "workspace-1",
    key: "default",
    default: true,
    status: "active",
  };
  await assert.rejects(
    resolveKnowledgeContext(
      fakeDatabase({ workspace, application: null }),
      {},
      null,
      { applicationRequired: true, create: true },
    ),
    (error) =>
      error.statusCode === 422 && error.code === "APPLICATION_REQUIRED",
  );
});
