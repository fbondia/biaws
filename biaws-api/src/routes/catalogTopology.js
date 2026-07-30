import { Router } from "express";

import {
  actorCanAccessApplication,
  authorizationQuery,
  requireAllPermissions,
  requireApplicationAccess,
  requireApplicationPermissions,
  requireWorkspaceScope,
} from "../auth/authorizationMiddleware.js";
import { getApplicationContext } from "../repositories/catalogContextRepository.js";
import {
  archiveComponent,
  createComponent,
  getComponent,
  listComponents,
  updateComponent,
} from "../repositories/componentsRepository.js";
import {
  archiveDeployment,
  archiveRuntime,
  createDeployment,
  createRuntime,
  getDeployment,
  getRuntime,
  listDeployments,
  listRuntimes,
  updateDeployment,
  updateRuntime,
} from "../repositories/deploymentsRepository.js";
import {
  archiveIntegration,
  createIntegration,
  getIntegration,
  listIntegrations,
  updateIntegration,
} from "../repositories/integrationsRepository.js";
import {
  archiveRepository,
  createRepository,
  getRepository,
  listRepositories,
  listRepositoryComponents,
  updateRepository,
} from "../repositories/repositoriesRepository.js";
import {
  archiveServer,
  createServer,
  getServer,
  listServerDeployments,
  listServerRuntimes,
  listServers,
  updateServer,
} from "../repositories/serversRepository.js";
import {
  createTopologyDiagram,
  getTopologyDiagram,
  listTopologyDiagrams,
  updateTopologyDiagram,
} from "../repositories/topologyDiagramsRepository.js";
import { recordAuditEvent } from "../repositories/auditRepository.js";

export const catalogTopologyRouter = Router();

function asyncHandler(handler) {
  return async (req, res, next) => {
    try {
      await handler(req, res, next);
    } catch (error) {
      next(error);
    }
  };
}

function sendNotFound(res, type) {
  const label = type.replaceAll("-", " ");
  res.status(404).json({
    error: {
      code: `${type.replaceAll("-", "_").toUpperCase()}_NOT_FOUND`,
      message: `${label[0].toUpperCase()}${label.slice(1)} not found`,
    },
  });
}

async function scopedApplicationEntity(req, permission, getter, id) {
  const entity = await getter(id, { workspaceId: req.actor.workspaceId });
  if (
    !entity ||
    !actorCanAccessApplication(req.actor, permission, entity.applicationId)
  ) {
    return null;
  }
  return entity;
}

async function auditMutation({ req, type, action, before = null, after }) {
  await recordAuditEvent({
    actor: req.actor,
    action,
    target: { type, id: after.id, label: after.name },
    before,
    after,
    metadata: {
      workspaceId: after.workspaceId,
      applicationId: after.applicationId || null,
      deploymentId: after.deploymentId || null,
    },
    summary: `${type} ${action}: ${after.name}`,
  });
}

catalogTopologyRouter.get(
  "/applications/:applicationId/context",
  requireAllPermissions(
    "applications.read",
    "integrations.read",
    "components.read",
    "repositories.read",
    "servers.read",
    "deployments.read",
    "runtimes.read",
    "issues.read",
    "demands.read",
    "procedures.read",
  ),
  requireApplicationPermissions(
    "applications.read",
    "integrations.read",
    "components.read",
    "repositories.read",
    "deployments.read",
    "runtimes.read",
    "issues.read",
    "demands.read",
    "procedures.read",
  ),
  asyncHandler(async (req, res) => {
    res.json(await getApplicationContext(req.params.applicationId, req.query));
  }),
);

catalogTopologyRouter.get(
  "/applications/:applicationId/components",
  requireAllPermissions("components.read"),
  requireApplicationAccess("components.read"),
  asyncHandler(async (req, res) => {
    res.json(await listComponents(req.params.applicationId, req.query));
  }),
);

catalogTopologyRouter.post(
  "/applications/:applicationId/components",
  requireAllPermissions("components.create"),
  requireApplicationAccess("components.create"),
  asyncHandler(async (req, res) => {
    const component = await createComponent(
      req.params.applicationId,
      req.body,
      req.actor,
    );
    await auditMutation({
      req,
      type: "component",
      action: "created",
      after: component,
    });
    res.status(201).json({ component });
  }),
);

catalogTopologyRouter.get(
  "/components/:componentId",
  requireAllPermissions("components.read"),
  asyncHandler(async (req, res) => {
    const component = await scopedApplicationEntity(
      req,
      "components.read",
      getComponent,
      req.params.componentId,
    );
    if (!component) return sendNotFound(res, "component");
    res.json({ component });
  }),
);

catalogTopologyRouter.patch(
  "/components/:componentId",
  requireAllPermissions("components.update"),
  asyncHandler(async (req, res) => {
    const before = await scopedApplicationEntity(
      req,
      "components.update",
      getComponent,
      req.params.componentId,
    );
    if (!before) return sendNotFound(res, "component");
    const after = await updateComponent(
      req.params.componentId,
      req.body,
      req.actor,
    );
    await auditMutation({
      req,
      type: "component",
      action: "updated",
      before,
      after,
    });
    res.json({ component: after });
  }),
);

catalogTopologyRouter.patch(
  "/components/:componentId/archive",
  requireAllPermissions("components.archive"),
  asyncHandler(async (req, res) => {
    const before = await scopedApplicationEntity(
      req,
      "components.archive",
      getComponent,
      req.params.componentId,
    );
    if (!before) return sendNotFound(res, "component");
    const after = await archiveComponent(req.params.componentId, req.actor);
    if (before.status !== after.status) {
      await auditMutation({
        req,
        type: "component",
        action: "archived",
        before,
        after,
      });
    }
    res.json({ component: after });
  }),
);

catalogTopologyRouter.get(
  "/applications/:applicationId/integrations",
  requireAllPermissions("integrations.read"),
  requireApplicationAccess("integrations.read"),
  asyncHandler(async (req, res) => {
    res.json(await listIntegrations(req.params.applicationId, req.query));
  }),
);

catalogTopologyRouter.post(
  "/applications/:applicationId/integrations",
  requireAllPermissions("integrations.create"),
  requireApplicationAccess("integrations.create"),
  asyncHandler(async (req, res) => {
    const integration = await createIntegration(
      req.params.applicationId,
      req.body,
      req.actor,
    );
    await auditMutation({
      req,
      type: "integration",
      action: "created",
      after: integration,
    });
    res.status(201).json({ integration });
  }),
);

catalogTopologyRouter.get(
  "/integrations/:integrationId",
  requireAllPermissions("integrations.read"),
  asyncHandler(async (req, res) => {
    const integration = await scopedApplicationEntity(
      req,
      "integrations.read",
      getIntegration,
      req.params.integrationId,
    );
    if (!integration) return sendNotFound(res, "integration");
    res.json({ integration });
  }),
);

catalogTopologyRouter.patch(
  "/integrations/:integrationId",
  requireAllPermissions("integrations.update"),
  asyncHandler(async (req, res) => {
    const before = await scopedApplicationEntity(
      req,
      "integrations.update",
      getIntegration,
      req.params.integrationId,
    );
    if (!before) return sendNotFound(res, "integration");
    const after = await updateIntegration(
      req.params.integrationId,
      req.body,
      req.actor,
    );
    await auditMutation({
      req,
      type: "integration",
      action: "updated",
      before,
      after,
    });
    res.json({ integration: after });
  }),
);

catalogTopologyRouter.patch(
  "/integrations/:integrationId/archive",
  requireAllPermissions("integrations.archive"),
  asyncHandler(async (req, res) => {
    const before = await scopedApplicationEntity(
      req,
      "integrations.archive",
      getIntegration,
      req.params.integrationId,
    );
    if (!before) return sendNotFound(res, "integration");
    const after = await archiveIntegration(req.params.integrationId, req.actor);
    if (before.status !== after.status) {
      await auditMutation({
        req,
        type: "integration",
        action: "archived",
        before,
        after,
      });
    }
    res.json({ integration: after });
  }),
);

catalogTopologyRouter.get(
  "/applications/:applicationId/repositories",
  requireAllPermissions("repositories.read"),
  requireApplicationAccess("repositories.read"),
  asyncHandler(async (req, res) => {
    res.json(await listRepositories(req.params.applicationId, req.query));
  }),
);

catalogTopologyRouter.post(
  "/applications/:applicationId/repositories",
  requireAllPermissions("repositories.create"),
  requireApplicationAccess("repositories.create"),
  asyncHandler(async (req, res) => {
    const repository = await createRepository(
      req.params.applicationId,
      req.body,
      req.actor,
    );
    await auditMutation({
      req,
      type: "repository",
      action: "created",
      after: repository,
    });
    res.status(201).json({ repository });
  }),
);

catalogTopologyRouter.get(
  "/repositories/:repositoryId",
  requireAllPermissions("repositories.read"),
  asyncHandler(async (req, res) => {
    const repository = await scopedApplicationEntity(
      req,
      "repositories.read",
      getRepository,
      req.params.repositoryId,
    );
    if (!repository) return sendNotFound(res, "repository");
    res.json({ repository });
  }),
);

catalogTopologyRouter.get(
  "/repositories/:repositoryId/components",
  requireAllPermissions("repositories.read", "components.read"),
  asyncHandler(async (req, res) => {
    const repository = await scopedApplicationEntity(
      req,
      "repositories.read",
      getRepository,
      req.params.repositoryId,
    );
    if (
      !repository ||
      !actorCanAccessApplication(
        req.actor,
        "components.read",
        repository.applicationId,
      )
    ) {
      return sendNotFound(res, "repository");
    }
    res.json(
      await listRepositoryComponents(req.params.repositoryId, req.query),
    );
  }),
);

catalogTopologyRouter.patch(
  "/repositories/:repositoryId",
  requireAllPermissions("repositories.update"),
  asyncHandler(async (req, res) => {
    const before = await scopedApplicationEntity(
      req,
      "repositories.update",
      getRepository,
      req.params.repositoryId,
    );
    if (!before) return sendNotFound(res, "repository");
    const after = await updateRepository(
      req.params.repositoryId,
      req.body,
      req.actor,
    );
    await auditMutation({
      req,
      type: "repository",
      action: "updated",
      before,
      after,
    });
    res.json({ repository: after });
  }),
);

catalogTopologyRouter.patch(
  "/repositories/:repositoryId/archive",
  requireAllPermissions("repositories.archive"),
  asyncHandler(async (req, res) => {
    const before = await scopedApplicationEntity(
      req,
      "repositories.archive",
      getRepository,
      req.params.repositoryId,
    );
    if (!before) return sendNotFound(res, "repository");
    const after = await archiveRepository(req.params.repositoryId, req.actor);
    if (before.status !== after.status) {
      await auditMutation({
        req,
        type: "repository",
        action: "archived",
        before,
        after,
      });
    }
    res.json({ repository: after });
  }),
);

catalogTopologyRouter.get(
  "/workspaces/:workspaceId/servers",
  requireAllPermissions("servers.read"),
  requireWorkspaceScope("servers.read"),
  asyncHandler(async (req, res) => {
    res.json(await listServers(req.params.workspaceId, req.query));
  }),
);

catalogTopologyRouter.post(
  "/workspaces/:workspaceId/servers",
  requireAllPermissions("servers.create"),
  requireWorkspaceScope("servers.create"),
  asyncHandler(async (req, res) => {
    const server = await createServer(
      req.params.workspaceId,
      req.body,
      req.actor,
    );
    await auditMutation({
      req,
      type: "server",
      action: "created",
      after: server,
    });
    res.status(201).json({ server });
  }),
);

catalogTopologyRouter.get(
  "/servers/:serverId",
  requireAllPermissions("servers.read"),
  asyncHandler(async (req, res) => {
    const server = await getServer(req.params.serverId, {
      workspaceId: req.actor.workspaceId,
    });
    if (!server) return sendNotFound(res, "server");
    res.json({ server });
  }),
);

catalogTopologyRouter.get(
  "/servers/:serverId/runtimes",
  requireAllPermissions("servers.read", "runtimes.read"),
  asyncHandler(async (req, res) => {
    const server = await getServer(req.params.serverId, {
      workspaceId: req.actor.workspaceId,
    });
    if (!server) return sendNotFound(res, "server");
    res.json(
      await listServerRuntimes(
        req.params.serverId,
        authorizationQuery(req.actor, "runtimes.read", req.query),
      ),
    );
  }),
);

catalogTopologyRouter.get(
  "/servers/:serverId/deployments",
  requireAllPermissions("servers.read", "deployments.read"),
  asyncHandler(async (req, res) => {
    const server = await getServer(req.params.serverId, {
      workspaceId: req.actor.workspaceId,
    });
    if (!server) return sendNotFound(res, "server");
    res.json(
      await listServerDeployments(
        req.params.serverId,
        authorizationQuery(req.actor, "deployments.read", req.query),
      ),
    );
  }),
);

catalogTopologyRouter.patch(
  "/servers/:serverId",
  requireAllPermissions("servers.update"),
  asyncHandler(async (req, res) => {
    const before = await getServer(req.params.serverId, {
      workspaceId: req.actor.workspaceId,
    });
    if (!before) return sendNotFound(res, "server");
    const after = await updateServer(req.params.serverId, req.body, req.actor);
    await auditMutation({
      req,
      type: "server",
      action: "updated",
      before,
      after,
    });
    res.json({ server: after });
  }),
);

catalogTopologyRouter.patch(
  "/servers/:serverId/archive",
  requireAllPermissions("servers.archive"),
  asyncHandler(async (req, res) => {
    const before = await getServer(req.params.serverId, {
      workspaceId: req.actor.workspaceId,
    });
    if (!before) return sendNotFound(res, "server");
    const after = await archiveServer(req.params.serverId, req.actor);
    if (before.status !== after.status) {
      await auditMutation({
        req,
        type: "server",
        action: "archived",
        before,
        after,
      });
    }
    res.json({ server: after });
  }),
);

catalogTopologyRouter.get(
  "/applications/:applicationId/deployments",
  requireAllPermissions("deployments.read"),
  requireApplicationAccess("deployments.read"),
  asyncHandler(async (req, res) => {
    res.json(await listDeployments(req.params.applicationId, req.query));
  }),
);

catalogTopologyRouter.post(
  "/applications/:applicationId/deployments",
  requireAllPermissions("deployments.create"),
  requireApplicationAccess("deployments.create"),
  asyncHandler(async (req, res) => {
    const deployment = await createDeployment(
      req.params.applicationId,
      req.body,
      req.actor,
    );
    await auditMutation({
      req,
      type: "deployment",
      action: "created",
      after: deployment,
    });
    res.status(201).json({ deployment });
  }),
);

catalogTopologyRouter.get(
  "/deployments/:deploymentId",
  requireAllPermissions("deployments.read"),
  asyncHandler(async (req, res) => {
    const deployment = await scopedApplicationEntity(
      req,
      "deployments.read",
      getDeployment,
      req.params.deploymentId,
    );
    if (!deployment) return sendNotFound(res, "deployment");
    res.json({ deployment });
  }),
);

catalogTopologyRouter.patch(
  "/deployments/:deploymentId",
  requireAllPermissions("deployments.update"),
  asyncHandler(async (req, res) => {
    const before = await scopedApplicationEntity(
      req,
      "deployments.update",
      getDeployment,
      req.params.deploymentId,
    );
    if (!before) return sendNotFound(res, "deployment");
    const after = await updateDeployment(
      req.params.deploymentId,
      req.body,
      req.actor,
    );
    await auditMutation({
      req,
      type: "deployment",
      action: "updated",
      before,
      after,
    });
    res.json({ deployment: after });
  }),
);

catalogTopologyRouter.patch(
  "/deployments/:deploymentId/archive",
  requireAllPermissions("deployments.archive"),
  asyncHandler(async (req, res) => {
    const before = await scopedApplicationEntity(
      req,
      "deployments.archive",
      getDeployment,
      req.params.deploymentId,
    );
    if (!before) return sendNotFound(res, "deployment");
    const after = await archiveDeployment(req.params.deploymentId, req.actor);
    if (before.status !== after.status) {
      await auditMutation({
        req,
        type: "deployment",
        action: "archived",
        before,
        after,
      });
    }
    res.json({ deployment: after });
  }),
);

catalogTopologyRouter.get(
  "/deployments/:deploymentId/runtimes",
  requireAllPermissions("runtimes.read"),
  asyncHandler(async (req, res) => {
    const deployment = await scopedApplicationEntity(
      req,
      "runtimes.read",
      getDeployment,
      req.params.deploymentId,
    );
    if (!deployment) return sendNotFound(res, "deployment");
    res.json(await listRuntimes(req.params.deploymentId, req.query));
  }),
);

catalogTopologyRouter.post(
  "/deployments/:deploymentId/runtimes",
  requireAllPermissions("runtimes.create"),
  asyncHandler(async (req, res) => {
    const deployment = await scopedApplicationEntity(
      req,
      "runtimes.create",
      getDeployment,
      req.params.deploymentId,
    );
    if (!deployment) return sendNotFound(res, "deployment");
    const runtime = await createRuntime(
      req.params.deploymentId,
      req.body,
      req.actor,
    );
    await auditMutation({
      req,
      type: "runtime",
      action: "created",
      after: runtime,
    });
    res.status(201).json({ runtime });
  }),
);

catalogTopologyRouter.get(
  "/runtimes/:runtimeId",
  requireAllPermissions("runtimes.read"),
  asyncHandler(async (req, res) => {
    const runtime = await scopedApplicationEntity(
      req,
      "runtimes.read",
      getRuntime,
      req.params.runtimeId,
    );
    if (!runtime) return sendNotFound(res, "runtime");
    res.json({ runtime });
  }),
);

catalogTopologyRouter.patch(
  "/runtimes/:runtimeId",
  requireAllPermissions("runtimes.update"),
  asyncHandler(async (req, res) => {
    const before = await scopedApplicationEntity(
      req,
      "runtimes.update",
      getRuntime,
      req.params.runtimeId,
    );
    if (!before) return sendNotFound(res, "runtime");
    const after = await updateRuntime(
      req.params.runtimeId,
      req.body,
      req.actor,
    );
    await auditMutation({
      req,
      type: "runtime",
      action: "updated",
      before,
      after,
    });
    res.json({ runtime: after });
  }),
);

catalogTopologyRouter.patch(
  "/runtimes/:runtimeId/archive",
  requireAllPermissions("runtimes.archive"),
  asyncHandler(async (req, res) => {
    const before = await scopedApplicationEntity(
      req,
      "runtimes.archive",
      getRuntime,
      req.params.runtimeId,
    );
    if (!before) return sendNotFound(res, "runtime");
    const after = await archiveRuntime(req.params.runtimeId, req.actor);
    if (before.status !== after.status) {
      await auditMutation({
        req,
        type: "runtime",
        action: "archived",
        before,
        after,
      });
    }
    res.json({ runtime: after });
  }),
);

catalogTopologyRouter.get(
  "/applications/:applicationId/topology-diagrams",
  requireAllPermissions("applications.read"),
  requireApplicationAccess("applications.read"),
  asyncHandler(async (req, res) => {
    res.json(await listTopologyDiagrams(req.params.applicationId, req.query));
  }),
);

catalogTopologyRouter.post(
  "/applications/:applicationId/topology-diagrams",
  requireAllPermissions("applications.update"),
  requireApplicationAccess("applications.update"),
  asyncHandler(async (req, res) => {
    const diagram = await createTopologyDiagram(
      req.params.applicationId,
      req.body,
      req.actor,
    );
    await auditMutation({
      req,
      type: "topology-diagram",
      action: "created",
      after: diagram,
    });
    res.status(201).json({ diagram });
  }),
);

catalogTopologyRouter.get(
  "/topology-diagrams/:diagramId",
  requireAllPermissions("applications.read"),
  asyncHandler(async (req, res) => {
    const diagram = await scopedApplicationEntity(
      req,
      "applications.read",
      getTopologyDiagram,
      req.params.diagramId,
    );
    if (!diagram) return sendNotFound(res, "topology-diagram");
    res.json({ diagram });
  }),
);

catalogTopologyRouter.patch(
  "/topology-diagrams/:diagramId",
  requireAllPermissions("applications.update"),
  asyncHandler(async (req, res) => {
    const before = await scopedApplicationEntity(
      req,
      "applications.update",
      getTopologyDiagram,
      req.params.diagramId,
    );
    if (!before) return sendNotFound(res, "topology-diagram");
    const after = await updateTopologyDiagram(
      req.params.diagramId,
      req.body,
      req.actor,
    );
    await auditMutation({
      req,
      type: "topology-diagram",
      action: "updated",
      before,
      after,
    });
    res.json({ diagram: after });
  }),
);
