import assert from "node:assert/strict";
import { COLLECTION_NAMES } from "../../../src/database/collectionNames.js";

export async function authenticationAndCatalogFixture(scenarioContext) {
  const { database, auth, admin, reader, server, login, request } = scenarioContext;
  assert.equal((await request("/api/catalog/workspaces")).status, 401);

  const readerCookie = await login("reader.phase2@example.test");

  assert.equal((await request("/api/catalog/workspaces", { cookie: readerCookie })).status, 200);

  assert.equal(
    (
      await request("/api/monitoring/executor/leases", {
        cookie: readerCookie,
        method: "POST",
        body: { executorId: "unauthorized-runner" },
        origin: true,
      })
    ).status,
    403,
  );

  assert.equal(
    (
      await database.collection(COLLECTION_NAMES.PERMISSION_GROUPS).findOne({
        _id: "administration",
      })
    ).permissions.includes("runtimes.read"),
    false,
  );

  await database
    .collection(COLLECTION_NAMES.PERMISSION_GROUPS)
    .updateOne({ _id: "administration" }, { $addToSet: { permissions: "runtimes.read" } });

  const adminCookie = await login("admin.phase2@example.test");

  const workspaceResponse = await request("/api/catalog/workspaces", {
    cookie: adminCookie,
  });

  assert.equal(workspaceResponse.status, 200);

  const workspace = (await workspaceResponse.json()).items[0];

  const createdApiKey = await auth.api.createApiKey({
    body: {
      name: "Phase 2 integration",
      userId: admin.user.id,
    },
  });

  assert.equal(
    await database.collection(COLLECTION_NAMES.AUTH_API_KEYS).countDocuments({
      referenceId: admin.user.id,
    }),
    1,
  );

  assert.equal(
    (
      await request("/api/catalog/workspaces", {
        apiKey: createdApiKey.key,
        workspaceId: workspace.id,
      })
    ).status,
    200,
  );

  async function mutate(route, body, expectedStatus = 201) {
    const response = await request(route, {
      cookie: adminCookie,
      method: "POST",
      body,
      origin: true,
    });
    if (response.status !== expectedStatus) {
      throw new Error(
        `Expected ${expectedStatus} from ${route}, received ${response.status}: ${await response.text()}`,
      );
    }
    return response.json();
  }

  async function patch(route, body) {
    const response = await request(route, {
      cookie: adminCookie,
      method: "PATCH",
      body,
      origin: true,
    });
    if (response.status !== 200) {
      throw new Error(`Expected 200 from ${route}, received ${response.status}: ${await response.text()}`);
    }
    return response.json();
  }

  const { application } = await mutate(`/api/catalog/workspaces/${workspace.id}/applications`, {
    key: "billing-http",
    name: "Billing HTTP",
  });

  const { repository } = await mutate(`/api/catalog/applications/${application.id}/repositories`, {
    key: "billing-http-repository",
    name: "Billing HTTP repository",
    provider: "github",
    url: "https://example.test/billing-http.git",
  });

  const { component } = await mutate(`/api/catalog/applications/${application.id}/components`, {
    key: "billing-http-api",
    name: "Billing HTTP API",
    type: "api",
    repositoryLinks: [{ repositoryId: repository.id, role: "source" }],
  });

  const { server: topologyServer } = await mutate(`/api/catalog/workspaces/${workspace.id}/servers`, {
    key: "billing-http-server",
    name: "Billing HTTP server",
    hostname: "billing.internal.example.test",
  });

  const { deployment } = await mutate(`/api/catalog/applications/${application.id}/deployments`, {
    key: "billing-http-production",
    name: "Billing HTTP production",
    componentId: component.id,
    environment: "production",
    source: { repositoryId: repository.id, revision: "abc123" },
    status: "active",
  });

  const { runtime } = await mutate(`/api/catalog/deployments/${deployment.id}/runtimes`, {
    key: "billing-http-runtime",
    name: "Billing HTTP runtime",
    kind: "container",
    serverId: topologyServer.id,
    endpoint: "https://billing-http.example.test",
    status: "healthy",
  });

  // Every catalog detail accepts its stable public ID, Mongo _id and key.
  for (const [collectionName, path, entity, field] of [
    [COLLECTION_NAMES.APPLICATIONS, "applications", application, "application"],
    [COLLECTION_NAMES.APPLICATION_REPOSITORIES, "repositories", repository, "repository"],
    [COLLECTION_NAMES.APPLICATION_COMPONENTS, "components", component, "component"],
    [COLLECTION_NAMES.SERVERS, "servers", topologyServer, "server"],
    [COLLECTION_NAMES.APPLICATION_DEPLOYMENTS, "deployments", deployment, "deployment"],
    [COLLECTION_NAMES.DEPLOYMENT_RUNTIMES, "runtimes", runtime, "runtime"],
  ]) {
    const stored = await database.collection(collectionName).findOne({ id: entity.id });
    for (const reference of [entity.id, String(stored._id), entity.key]) {
      const response = await request(`/api/catalog/${path}/${reference}`, { cookie: adminCookie });
      assert.equal(response.status, 200, `${path}/${reference}`);
      assert.equal((await response.json())[field].id, entity.id);
    }
  }
  assert.equal((await request(`/api/identity/users/${admin.user.id}`)).status, 401);
  assert.equal((await request(`/api/identity/users/${admin.user.id}`, { cookie: readerCookie })).status, 403);
  const directUser = await request(`/api/identity/users/${reader.user.id}`, { cookie: adminCookie });
  assert.equal(directUser.status, 200);
  assert.equal((await directUser.json()).user.id, reader.user.id);
  assert.equal((await request("/api/identity/users/missing", { cookie: adminCookie })).status, 404);

  const updatedApplication = (
    await patch(`/api/catalog/applications/${application.id}`, {
      key: "billing-service",
    })
  ).application;

  const updatedComponent = (
    await patch(`/api/catalog/components/${component.id}`, {
      key: "billing-api",
    })
  ).component;

  const updatedDeployment = (
    await patch(`/api/catalog/deployments/${deployment.id}`, {
      key: "production",
    })
  ).deployment;

  const updatedRuntime = (
    await patch(`/api/catalog/runtimes/${runtime.id}`, {
      key: "primary",
    })
  ).runtime;
  return {
    ...scenarioContext,
    readerCookie,
    adminCookie,
    workspaceResponse,
    workspace,
    createdApiKey,
    mutate,
    patch,
    application,
    repository,
    component,
    topologyServer,
    deployment,
    runtime,
    updatedApplication,
    updatedComponent,
    updatedDeployment,
    updatedRuntime,
  };
}
