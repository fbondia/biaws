import { useEffect, useMemo, useState } from "react";

import { hasPermission } from "../../../../permissions.js";
import {
  ComponentsColumn,
  DeploymentsColumn,
  RuntimesColumn,
  TopologyDiagramOverlay,
  TopologyHeader,
} from "../components/CatalogTopologySections.jsx";

export function CatalogTopologyTab({
  actor,
  context,
  editEntity,
  entityActions,
  loadRuntimes,
  runtimeByDeployment,
  runtimeErrorByDeployment,
  runtimeLoadingByDeployment,
  setDialog,
}) {
  const [selectedComponentId, setSelectedComponentId] = useState("");
  const [selectedDeploymentId, setSelectedDeploymentId] = useState("");
  const [diagramOpen, setDiagramOpen] = useState(false);
  const [deployableOnly, setDeployableOnly] = useState(false);
  const canReadComponents = hasPermission(actor, "components.read");
  const canReadDeployments = hasPermission(actor, "deployments.read");
  const canReadRuntimes = hasPermission(actor, "runtimes.read");
  const canViewDiagram =
    canReadComponents &&
    canReadDeployments &&
    canReadRuntimes &&
    hasPermission(actor, "servers.read") &&
    hasPermission(actor, "applications.read");
  const components = useMemo(() => {
    if (canReadComponents) return context.components;
    const componentIds = [
      ...new Set(context.deployments.map(({ componentId }) => componentId)),
    ];
    return componentIds.map((id) => ({
      id,
      name: id,
      type: "componente",
      status: "unknown",
    }));
  }, [canReadComponents, context.components, context.deployments]);
  const visibleComponents = useMemo(() => {
    if (!deployableOnly) return components;
    const deployableComponentIds = new Set(
      context.deployments.map(({ componentId }) => componentId),
    );
    return components.filter(({ id }) => deployableComponentIds.has(id));
  }, [components, context.deployments, deployableOnly]);
  const deployments = useMemo(
    () =>
      selectedComponentId
        ? context.deployments.filter(
            ({ componentId }) => componentId === selectedComponentId,
          )
        : [],
    [context.deployments, selectedComponentId],
  );
  const runtimes = selectedDeploymentId
    ? runtimeByDeployment[selectedDeploymentId]
    : undefined;
  const selectedComponent = components.find(
    ({ id }) => id === selectedComponentId,
  );
  const selectedDeployment = context.deployments.find(
    ({ id }) => id === selectedDeploymentId,
  );

  useEffect(() => {
    if (
      selectedComponentId &&
      !visibleComponents.some(({ id }) => id === selectedComponentId)
    ) {
      setSelectedComponentId("");
      setSelectedDeploymentId("");
    }
  }, [selectedComponentId, visibleComponents]);

  useEffect(() => {
    if (
      selectedDeploymentId &&
      !deployments.some(({ id }) => id === selectedDeploymentId)
    ) {
      setSelectedDeploymentId("");
    }
  }, [deployments, selectedDeploymentId]);

  useEffect(() => {
    if (
      selectedDeploymentId &&
      canReadRuntimes &&
      runtimes === undefined &&
      !runtimeLoadingByDeployment[selectedDeploymentId] &&
      !runtimeErrorByDeployment[selectedDeploymentId]
    ) {
      loadRuntimes(selectedDeploymentId);
    }
  }, [
    canReadRuntimes,
    selectedDeploymentId,
    runtimes,
    runtimeLoadingByDeployment,
    runtimeErrorByDeployment,
  ]);

  function selectComponent(componentId) {
    setSelectedComponentId(componentId);
    setSelectedDeploymentId("");
  }

  return (
    <section>
      <TopologyHeader
        canFilter={canReadComponents && canReadDeployments}
        canViewDiagram={canViewDiagram}
        deployableOnly={deployableOnly}
        onOpenDiagram={() => setDiagramOpen(true)}
        onToggleDeployable={() => setDeployableOnly((current) => !current)}
      />
      <div
        aria-label="Componentes, deployments e runtimes"
        className="catalogColumns catalogTopologyColumns"
        role="tree"
      >
        <ComponentsColumn
          actor={actor}
          canReadComponents={canReadComponents}
          canReadDeployments={canReadDeployments}
          deployableOnly={deployableOnly}
          entityActions={entityActions}
          onCreate={() => setDialog({ kind: "component", entity: null })}
          onSelect={selectComponent}
          selectedId={selectedComponentId}
          visibleComponents={visibleComponents}
        />

        {canReadDeployments ? (
          <DeploymentsColumn
            actor={actor}
            canReadRuntimes={canReadRuntimes}
            deployments={deployments}
            entityActions={entityActions}
            onCreate={() =>
              setDialog({
                kind: "deployment",
                entity: { componentId: selectedComponentId },
              })
            }
            onSelect={setSelectedDeploymentId}
            selectedComponent={selectedComponent}
            selectedComponentId={selectedComponentId}
            selectedDeploymentId={selectedDeploymentId}
          />
        ) : null}

        {canReadDeployments && canReadRuntimes ? (
          <RuntimesColumn
            actor={actor}
            entityActions={entityActions}
            error={runtimeErrorByDeployment[selectedDeploymentId]}
            loading={runtimeLoadingByDeployment[selectedDeploymentId]}
            loadRuntimes={loadRuntimes}
            onCreate={() =>
              setDialog({
                kind: "runtime",
                entity: null,
                deploymentId: selectedDeploymentId,
              })
            }
            onEdit={(runtime) => editEntity("runtime", runtime)}
            runtimes={runtimes}
            selectedDeployment={selectedDeployment}
            selectedDeploymentId={selectedDeploymentId}
          />
        ) : null}
      </div>
      <TopologyDiagramOverlay
        actor={actor}
        context={context}
        onClose={() => setDiagramOpen(false)}
        open={diagramOpen}
      />
    </section>
  );
}
