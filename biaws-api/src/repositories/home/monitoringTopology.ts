import type { Db } from "mongodb";
import type { Actor } from "../../types/http.js";
import { hasPermission } from "./support.js";
import { applicationScope } from "./filters.js";
import { COLLECTION_NAMES } from "../../database/collectionNames.js";

interface NamedItem {
  id: string;
  name: string;
}
interface RuntimeItem extends NamedItem {
  applicationId: string;
  componentId: string;
  deploymentId: string;
}
interface ComponentItem extends NamedItem {
  applicationId: string;
}
interface DeploymentItem extends NamedItem {
  applicationId: string;
  componentId: string;
}

function monitoringRuntimeItem({ id, name }: RuntimeItem) {
  return { id, name };
}

function monitoringDeploymentItem(
  deployment: DeploymentItem,
  runtimes: RuntimeItem[],
  applicationId: string,
  componentId: string,
) {
  const relatedRuntimes = runtimes.filter(
    (runtime) =>
      runtime.applicationId === applicationId &&
      runtime.componentId === componentId &&
      runtime.deploymentId === deployment.id,
  );
  return {
    id: deployment.id,
    name: deployment.name,
    runtimes: relatedRuntimes.map(monitoringRuntimeItem),
  };
}

function monitoringComponentItem(
  component: ComponentItem,
  deployments: DeploymentItem[],
  runtimes: RuntimeItem[],
  applicationId: string,
) {
  const relatedDeployments = deployments.filter(
    (deployment) => deployment.applicationId === applicationId && deployment.componentId === component.id,
  );
  return {
    id: component.id,
    name: component.name,
    deployments: relatedDeployments.map((deployment) =>
      monitoringDeploymentItem(deployment, runtimes, applicationId, component.id),
    ),
  };
}

function monitoringApplicationItem(
  application: NamedItem,
  components: ComponentItem[],
  deployments: DeploymentItem[],
  runtimes: RuntimeItem[],
) {
  const relatedComponents = components.filter(({ applicationId }) => applicationId === application.id);
  return {
    ...application,
    components: relatedComponents.map((component) =>
      monitoringComponentItem(component, deployments, runtimes, application.id),
    ),
  };
}

export async function homeMonitoringApplications(database: Db, actor: Partial<Actor>) {
  if (!hasPermission(actor, "runtimes.read")) return [];
  const monitoringScope = applicationScope(actor, "runtimes.read");
  const applications = await database
    .collection(COLLECTION_NAMES.APPLICATIONS)
    .find({
      workspaceId: actor.workspaceId,
      status: { $ne: "archived" },
      ...(monitoringScope ? { id: { $in: monitoringScope } } : {}),
    })
    .project<NamedItem>({ _id: 0, id: 1, name: 1 })
    .sort({ name: 1 })
    .toArray();
  const applicationIds = applications.map(({ id }) => id);
  if (!applicationIds.length) return applications;
  const runtimes = await database
    .collection(COLLECTION_NAMES.DEPLOYMENT_RUNTIMES)
    .find({
      workspaceId: actor.workspaceId,
      applicationId: { $in: applicationIds },
      status: { $ne: "archived" },
      monitoring: { $exists: true, $ne: null },
    })
    .project<RuntimeItem>({
      _id: 0,
      id: 1,
      name: 1,
      applicationId: 1,
      componentId: 1,
      deploymentId: 1,
    })
    .sort({ name: 1 })
    .toArray();
  const componentIds = [...new Set(runtimes.map(({ componentId }) => componentId))];
  const deploymentIds = [...new Set(runtimes.map(({ deploymentId }) => deploymentId))];
  const [components, deployments] = await Promise.all([
    componentIds.length
      ? database
          .collection(COLLECTION_NAMES.APPLICATION_COMPONENTS)
          .find({
            workspaceId: actor.workspaceId,
            id: { $in: componentIds },
            status: { $ne: "archived" },
          })
          .project<ComponentItem>({ _id: 0, id: 1, name: 1, applicationId: 1 })
          .sort({ name: 1 })
          .toArray()
      : [],
    deploymentIds.length
      ? database
          .collection(COLLECTION_NAMES.APPLICATION_DEPLOYMENTS)
          .find({
            workspaceId: actor.workspaceId,
            id: { $in: deploymentIds },
            status: { $ne: "archived" },
          })
          .project<DeploymentItem>({
            _id: 0,
            id: 1,
            name: 1,
            applicationId: 1,
            componentId: 1,
          })
          .sort({ name: 1 })
          .toArray()
      : [],
  ]);
  return applications.map((application) => monitoringApplicationItem(application, components, deployments, runtimes));
}
