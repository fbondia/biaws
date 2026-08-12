import {
  fetchComponents,
  fetchDeployments,
  fetchRuntimes,
} from "../../../../../api.js";
import {
  buildTopologyGraph,
  topologyDiagramPayload,
} from "../../topologyDiagramModel.js";
import { edgeDirectionMarkers } from "./topologyDiagramPresentation.js";

export function createTopologyEnvironmentLoader({
  comments,
  context,
  diagram,
  edges,
  hiddenIntegrationIds,
  hiddenServerIds,
  nodes,
  setters,
  topologyRequest,
}) {
  return async function loadEnvironment(
    nextEnvironment,
    sourceDiagram = diagram,
    { preserveCurrentPositions = false } = {},
  ) {
    const requestId = topologyRequest.current + 1;
    topologyRequest.current = requestId;
    setters.setTopologyLoading(true);
    setters.setError("");
    setters.setIntegrationWarning("");
    setters.setVisibleDeploymentCount(0);
    try {
      const localDeployments = context.deployments.filter(
        (deployment) => deployment.environment === nextEnvironment,
      );
      const localRuntimeGroups = await Promise.all(
        localDeployments.map((deployment) =>
          fetchRuntimes(deployment.id, { limit: 100 }),
        ),
      );
      const applicationsById = new Map(
        (context.availableApplications || []).map((application) => [
          application.id,
          application,
        ]),
      );
      const integratedResults = await Promise.allSettled(
        (context.integrations || []).map(async (integration) => {
          const application =
            applicationsById.get(integration.targetApplicationId) || {};
          const [componentsPayload, deploymentsPayload] = await Promise.all([
            fetchComponents(integration.targetApplicationId, { limit: 100 }),
            fetchDeployments(integration.targetApplicationId, { limit: 100 }),
          ]);
          const deployments = (deploymentsPayload.items || []).filter(
            (deployment) => deployment.environment === nextEnvironment,
          );
          const runtimeGroups = await Promise.all(
            deployments.map((deployment) =>
              fetchRuntimes(deployment.id, { limit: 100 }),
            ),
          );
          return {
            integration,
            application: {
              id: integration.targetApplicationId,
              key: application.key || "",
              name: application.name || integration.targetApplicationId,
              status: application.status || integration.status,
            },
            components: (componentsPayload.items || []).map((component) => ({
              ...component,
              applicationName:
                application.name || integration.targetApplicationId,
              integrated: true,
              integrationId: integration.id,
            })),
            deployments,
            runtimes: runtimeGroups.flatMap(({ items }) => items || []),
          };
        }),
      );
      if (requestId !== topologyRequest.current) return;

      const integratedTopology = integratedResults
        .filter(({ status }) => status === "fulfilled")
        .map(({ value }) => value);
      const unavailableIntegrations = integratedResults.filter(
        ({ status }) => status === "rejected",
      ).length;
      if (unavailableIntegrations) {
        setters.setIntegrationWarning(
          `${unavailableIntegrations} integração(ões) não pôde(ram) ser carregada(s) com as permissões atuais.`,
        );
      }

      const components = [
        ...context.components.map((component) => ({
          ...component,
          applicationName: context.application.name,
          integrated: false,
        })),
        ...integratedTopology.flatMap(({ components: items }) => items),
      ];
      const deployments = [
        ...localDeployments,
        ...integratedTopology.flatMap(({ deployments: items }) => items),
      ];
      setters.setVisibleDeploymentCount(deployments.length);
      const runtimes = [
        ...localRuntimeGroups.flatMap(({ items }) => items || []),
        ...integratedTopology.flatMap(({ runtimes: items }) => items),
      ];
      const integratedTopologyById = new Map(
        integratedTopology.map((result) => [result.integration.id, result]),
      );
      const integrations = (context.integrations || []).map((integration) => {
        const loaded = integratedTopologyById.get(integration.id);
        const application =
          applicationsById.get(integration.targetApplicationId) || {};
        return {
          id: integration.id,
          integration,
          application: loaded?.application || {
            id: integration.targetApplicationId,
            key: application.key || "",
            name: application.name || integration.name,
            status: application.status || integration.status,
          },
          componentCount: loaded?.components.length || 0,
          deploymentCount: loaded?.deployments.length || 0,
          runtimeCount: loaded?.runtimes.length || 0,
          topologyUnavailable: !loaded,
        };
      });

      const savedNodes = preserveCurrentPositions
        ? nodes.map(({ id, parentId, position }) => ({
            id,
            position,
            ...(parentId ? { parentId } : {}),
          }))
        : sourceDiagram?.nodes || [];
      const savedEdges = preserveCurrentPositions
        ? topologyDiagramPayload({
            name: sourceDiagram?.name || "Rascunho",
            environment: nextEnvironment,
            nodes,
            edges,
            comments,
            hiddenIntegrationIds,
            hiddenServerIds,
          }).edges
        : sourceDiagram?.edges || [];
      const savedGroups = preserveCurrentPositions
        ? nodes
            .filter(({ type }) => type === "topologyGroup")
            .map(({ id, data }) => ({
              id,
              title: data.group.title,
              description: data.group.description || "",
            }))
        : sourceDiagram?.groups || [];
      const savedElements = preserveCurrentPositions
        ? nodes
            .filter(({ type }) => type === "topologyElement")
            .map(({ id, data }) => ({
              id,
              title: data.element.title,
              description: data.element.description || "",
            }))
        : sourceDiagram?.elements || [];
      const graph = buildTopologyGraph({
        components,
        deployments,
        integrations,
        runtimes,
        savedElements,
        servers: context.servers,
        savedNodes,
        savedEdges,
        savedGroups,
      });
      setters.setNodes(graph.nodes);
      setters.setEdges(
        graph.edges.map((edge) => ({
          ...edge,
          ...edgeDirectionMarkers(edge.data?.direction),
        })),
      );
      setters.setSelectedEdgeId("");
      setters.setSelectedElementId("");
      setters.setSelectedGroupId("");
      setters.setFlowRevision((current) => current + 1);
    } catch (loadError) {
      if (requestId === topologyRequest.current) {
        setters.setError(loadError.message);
        setters.setVisibleDeploymentCount(0);
        setters.setNodes([]);
        setters.setEdges([]);
      }
    } finally {
      if (requestId === topologyRequest.current) {
        setters.setTopologyLoading(false);
      }
    }
  };
}
