import assert from "node:assert/strict";
import test from "node:test";

const integrationEnabled = Boolean(process.env.BIAWS_INTEGRATION_MONGO_URI);

test(
  "topology persists relations, reverse queries, conflicts and bounded context in MongoDB",
  { skip: !integrationEnabled },
  async () => {
    process.env.MONGO_URI = process.env.BIAWS_INTEGRATION_MONGO_URI;
    process.env.MONGO_DB =
      process.env.BIAWS_INTEGRATION_MONGO_DB || "biaws_topology_integration";

    const { closeMongoClient, getMongoDatabase } =
      await import("../src/helpers/mongoClient.js");
    const { archiveApplication, createApplication, ensureDefaultWorkspace } =
      await import("../src/repositories/catalogRepository.js");
    const { archiveComponent, createComponent, updateComponent } =
      await import("../src/repositories/componentsRepository.js");
    const {
      archiveRepository,
      createRepository,
      listRepositoryComponents,
      updateRepository,
    } = await import("../src/repositories/repositoriesRepository.js");
    const {
      archiveServer,
      createServer,
      listServerDeployments,
      listServerRuntimes,
      updateServer,
    } = await import("../src/repositories/serversRepository.js");
    const {
      archiveDeployment,
      archiveRuntime,
      assertApplicationCanArchive,
      createDeployment,
      createRuntime,
      listDeployments,
      listRuntimes,
      updateDeployment,
      updateRuntime,
    } = await import("../src/repositories/deploymentsRepository.js");
    const { getApplicationContext } =
      await import("../src/repositories/catalogContextRepository.js");
    const { archiveIntegration, createIntegration, listIntegrations } =
      await import("../src/repositories/integrationsRepository.js");
    const {
      createTopologyDiagram,
      getTopologyDiagram,
      listTopologyDiagrams,
      updateTopologyDiagram,
    } = await import("../src/repositories/topologyDiagramsRepository.js");

    const actor = {
      userId: "integration-user",
      email: "integration@example.test",
    };
    const database = await getMongoDatabase();

    try {
      await database.dropDatabase();
      const workspace = await ensureDefaultWorkspace(actor);
      const application = await createApplication(
        workspace.id,
        { key: "billing", name: "Billing" },
        actor,
      );
      const otherApplication = await createApplication(
        workspace.id,
        { key: "customer", name: "Customer" },
        actor,
      );
      await assert.rejects(
        createIntegration(
          application.id,
          {
            key: "self",
            name: "Self",
            targetApplicationId: application.id,
          },
          actor,
        ),
        (error) => error.code === "INTEGRATION_SELF_REFERENCE",
      );
      const integration = await createIntegration(
        application.id,
        {
          key: "customer",
          name: "Customer",
          targetApplicationId: otherApplication.id,
        },
        actor,
      );
      assert.equal(
        (await listIntegrations(application.id)).items[0].targetApplicationId,
        otherApplication.id,
      );
      await assert.rejects(
        () => assertApplicationCanArchive(otherApplication.id),
        (error) => error.code === "APPLICATION_INTEGRATION_IN_USE",
      );
      const repository = await createRepository(
        application.id,
        {
          key: "billing-repository",
          name: "Billing repository",
          provider: "github",
          url: "https://example.test/billing.git",
        },
        actor,
      );
      const foreignRepository = await createRepository(
        otherApplication.id,
        {
          key: "customer-repository",
          name: "Customer repository",
          provider: "github",
          url: "https://example.test/customer.git",
        },
        actor,
      );

      await assert.rejects(
        createComponent(
          application.id,
          {
            key: "invalid-cross-application",
            name: "Invalid cross application",
            repositoryLinks: [
              { repositoryId: foreignRepository.id, role: "source" },
            ],
          },
          actor,
        ),
        (error) =>
          error.statusCode === 422 &&
          error.code === "INVALID_COMPONENT_REPOSITORY",
      );

      const component = await createComponent(
        application.id,
        {
          key: "billing-api",
          name: "Billing API",
          type: "api",
          repositoryLinks: [{ repositoryId: repository.id, role: "source" }],
        },
        actor,
      );
      await assert.rejects(
        createDeployment(
          otherApplication.id,
          {
            key: "invalid-cross-application",
            name: "Invalid cross application",
            componentId: component.id,
          },
          actor,
        ),
        (error) =>
          error.statusCode === 422 &&
          error.code === "INVALID_DEPLOYMENT_COMPONENT",
      );
      const server = await createServer(
        workspace.id,
        {
          key: "production-1",
          name: "Production 1",
          hostname: "prod-1.example.test",
          addresses: ["10.0.0.10"],
        },
        actor,
      );
      assert.equal(
        (
          await updateRepository(
            repository.id,
            { url: "https://example.test/billing-renamed.git" },
            actor,
          )
        ).url,
        "https://example.test/billing-renamed.git",
      );
      assert.equal(
        (await updateServer(server.id, { status: "maintenance" }, actor))
          .status,
        "maintenance",
      );
      const deployment = await createDeployment(
        application.id,
        {
          key: "billing-production",
          name: "Billing production",
          componentId: component.id,
          environment: "production",
          version: "1.0.0",
          source: { repositoryId: repository.id, revision: "abc123" },
          status: "active",
        },
        actor,
      );
      assert.equal(
        (
          await updateDeployment(
            deployment.id,
            { version: "1.0.1", status: "active" },
            actor,
          )
        ).version,
        "1.0.1",
      );
      const runtime = await createRuntime(
        deployment.id,
        {
          key: "billing-production-1",
          name: "Billing production 1",
          kind: "container",
          serverId: server.id,
          endpoint: "https://billing.example.test",
          port: 443,
          metadata: { image: "billing:1.0.0" },
          status: "healthy",
        },
        actor,
      );
      const productionDiagram = await createTopologyDiagram(
        application.id,
        {
          name: "Produção principal",
          environment: "production",
          nodes: [
            {
              id: "group:production",
              position: { x: 40, y: 80 },
            },
            {
              id: `server:${server.id}`,
              parentId: "group:production",
              position: { x: 20, y: 90 },
            },
            {
              id: "element:firewall",
              position: { x: 760, y: 140 },
            },
          ],
          elements: [
            {
              id: "element:firewall",
              type: "Segurança",
              title: "Firewall",
              description: "Fronteira da topologia",
              headerColor: "#b91c1c",
            },
          ],
          groups: [
            {
              id: "group:production",
              title: "Produção",
              description: "Infraestrutura principal",
            },
          ],
          edges: [
            {
              id: "edge-group-firewall",
              source: "group:production",
              target: "element:firewall",
              sourceHandle: "right",
              targetHandle: "top-left",
              connectionType: "network",
              direction: "both",
              lineType: "smoothstep",
            },
          ],
          comments: "Topologia principal",
          hiddenIntegrationIds: [integration.id],
          hiddenServerIds: [server.id],
        },
        actor,
      );
      const homologationDiagram = await createTopologyDiagram(
        application.id,
        {
          name: "Homologação",
          environment: "staging",
          nodes: [],
          edges: [],
        },
        actor,
      );
      assert.deepEqual(
        (await listTopologyDiagrams(application.id)).items
          .map(({ id }) => id)
          .sort(),
        [homologationDiagram.id, productionDiagram.id].sort(),
      );
      assert.equal(
        (
          await updateTopologyDiagram(
            productionDiagram.id,
            { comments: "Topologia revisada" },
            actor,
          )
        ).comments,
        "Topologia revisada",
      );
      assert.equal(
        (await getTopologyDiagram(productionDiagram.id)).applicationId,
        application.id,
      );
      assert.deepEqual(
        (await getTopologyDiagram(productionDiagram.id)).hiddenIntegrationIds,
        [integration.id],
      );
      assert.deepEqual(
        (await getTopologyDiagram(productionDiagram.id)).hiddenServerIds,
        [server.id],
      );
      assert.equal(
        (await getTopologyDiagram(productionDiagram.id)).groups[0].title,
        "Produção",
      );
      assert.equal(
        (await getTopologyDiagram(productionDiagram.id)).nodes[1].parentId,
        "group:production",
      );
      assert.equal(
        (await getTopologyDiagram(productionDiagram.id)).elements[0].title,
        "Firewall",
      );
      assert.equal(
        (await getTopologyDiagram(productionDiagram.id)).elements[0].type,
        "Segurança",
      );
      assert.equal(
        (
          await updateRuntime(
            runtime.id,
            { status: "degraded", metadata: { image: "billing:1.0.1" } },
            actor,
          )
        ).status,
        "degraded",
      );
      await database.collection("servers").insertOne({
        id: "foreign-server",
        key: "foreign-server",
        name: "Foreign server",
        workspaceId: "foreign-workspace",
        status: "active",
      });
      await assert.rejects(
        updateRuntime(runtime.id, { serverId: "foreign-server" }, actor),
        (error) =>
          error.statusCode === 422 && error.code === "INVALID_RUNTIME_SERVER",
      );
      await assert.rejects(
        createServer(
          "foreign-workspace",
          { key: "forged", name: "Forged" },
          actor,
        ),
        (error) =>
          error.statusCode === 404 && error.code === "WORKSPACE_NOT_FOUND",
      );

      assert.deepEqual(
        (await listRepositoryComponents(repository.id)).items.map(
          ({ id }) => id,
        ),
        [component.id],
      );
      assert.deepEqual(
        (
          await listDeployments(application.id, { componentId: component.id })
        ).items.map(({ id }) => id),
        [deployment.id],
      );
      assert.deepEqual(
        (await listRuntimes(deployment.id)).items.map(({ id }) => id),
        [runtime.id],
      );
      assert.deepEqual(
        (await listServerRuntimes(server.id)).items.map(({ id }) => id),
        [runtime.id],
      );
      assert.deepEqual(
        (await listServerDeployments(server.id)).items.map(({ id }) => id),
        [deployment.id],
      );

      const context = await getApplicationContext(application.id, { limit: 1 });
      assert.equal(context.meta.limitPerCollection, 1);
      assert.equal(context.meta.totals.runtimes, 1);
      assert.equal(context.meta.totals.integrations, 1);
      assert.equal(
        context.integrations[0].targetApplicationId,
        otherApplication.id,
      );
      assert.equal(context.servers[0].id, server.id);
      assert.equal(Object.hasOwn(context.servers[0], "hostname"), false);
      assert.equal(Object.hasOwn(context.servers[0], "addresses"), false);
      assert.equal(Object.hasOwn(context.runtimes[0], "metadata"), false);

      for (const operation of [
        () => archiveRepository(repository.id, actor),
        () => archiveComponent(component.id, actor),
        () => archiveServer(server.id, actor),
        () => archiveDeployment(deployment.id, actor),
        () => assertApplicationCanArchive(application.id),
      ]) {
        await assert.rejects(operation(), (error) => error.statusCode === 409);
      }

      const concurrent = await Promise.allSettled([
        createServer(
          workspace.id,
          { key: "concurrent", name: "Concurrent A" },
          actor,
        ),
        createServer(
          workspace.id,
          { key: "concurrent", name: "Concurrent B" },
          actor,
        ),
      ]);
      assert.equal(
        concurrent.filter(({ status }) => status === "fulfilled").length,
        1,
      );
      assert.equal(
        concurrent.filter(
          ({ status, reason }) =>
            status === "rejected" && reason.code === "SERVER_KEY_CONFLICT",
        ).length,
        1,
      );

      await archiveIntegration(integration.id, actor);
      await archiveRuntime(runtime.id, actor);
      await archiveDeployment(deployment.id, actor);
      await updateComponent(component.id, { repositoryLinks: [] }, actor);
      await archiveComponent(component.id, actor);
      await archiveRepository(repository.id, actor);
      await archiveServer(server.id, actor);
      await assertApplicationCanArchive(application.id);
      assert.equal(
        (await archiveApplication(application.id, actor)).status,
        "archived",
      );

      const indexNames = (
        await database.collection("deploymentRuntimes").indexes()
      ).map(({ name }) => name);
      assert.ok(indexNames.includes("workspaceId_1_serverId_1_status_1"));
    } finally {
      await database.dropDatabase();
      await closeMongoClient();
    }
  },
);
