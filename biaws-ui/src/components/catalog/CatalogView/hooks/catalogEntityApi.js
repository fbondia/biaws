import {
  archiveComponent,
  archiveDeployment,
  archiveIntegration,
  archiveRepository,
  archiveRuntime,
  createComponent,
  createDeployment,
  createIntegration,
  createRepository,
  createRuntime,
  deleteComponent,
  deleteDeployment,
  deleteIntegration,
  deleteRepository,
  deleteRuntime,
  fetchComponent,
  fetchApplication,
  fetchDeployment,
  fetchIntegration,
  fetchRepository,
  fetchRuntime,
  restoreComponent,
  restoreDeployment,
  restoreIntegration,
  restoreRepository,
  restoreRuntime,
  updateComponent,
  updateDeployment,
  updateIntegration,
  updateRepository,
  updateRuntime,
} from "../../../../api.js";

export const CATALOG_ENTITY_API = {
  integration: {
    create: createIntegration,
    update: updateIntegration,
    archive: archiveIntegration,
    restore: restoreIntegration,
    remove: deleteIntegration,
    detail: fetchIntegration,
    response: "integration",
  },
  component: {
    create: createComponent,
    update: updateComponent,
    archive: archiveComponent,
    restore: restoreComponent,
    remove: deleteComponent,
    detail: fetchComponent,
    response: "component",
  },
  repository: {
    create: createRepository,
    update: updateRepository,
    archive: archiveRepository,
    restore: restoreRepository,
    remove: deleteRepository,
    detail: fetchRepository,
    response: "repository",
  },
  deployment: {
    create: createDeployment,
    update: updateDeployment,
    archive: archiveDeployment,
    restore: restoreDeployment,
    remove: deleteDeployment,
    detail: fetchDeployment,
    response: "deployment",
  },
  runtime: {
    create: createRuntime,
    update: updateRuntime,
    archive: archiveRuntime,
    restore: restoreRuntime,
    remove: deleteRuntime,
    detail: fetchRuntime,
    response: "runtime",
  },
};

export async function loadCatalogRouteEntity(kind, reference, applicationReference) {
  const api = CATALOG_ENTITY_API[kind];
  const payload = await api.detail(reference);
  const entity = payload[api.response];
  if (!entity?.applicationId) throw new Error("Registro não encontrado ou sem acesso.");
  if (applicationReference) {
    const parent = await fetchApplication(applicationReference);
    if (entity.applicationId !== parent.application?.id) throw new Error("Registro não encontrado ou sem acesso.");
  }
  return { kind, entity, deploymentId: entity.deploymentId };
}
