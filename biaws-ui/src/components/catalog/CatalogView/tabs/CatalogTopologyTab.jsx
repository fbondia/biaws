import {
  Boxes,
  ChevronRight,
  Layers3,
  Network,
  Plus,
  ServerCog,
} from "lucide-react";
import { lazy, Suspense, useEffect, useMemo, useState } from "react";

import { hasPermission } from "../../../../permissions.js";

const TopologyDiagramDialog = lazy(() =>
  import("../components/TopologyDiagramDialog/index.jsx").then((module) => ({
    default: module.TopologyDiagramDialog,
  })),
);

function ColumnHeader({ action, count, icon: Icon, title }) {
  return (
    <header className="catalogTopologyColumnHeader">
      <span className="catalogTopologyColumnTitle">
        <Icon size={15} />
        {title}
        {count !== undefined ? (
          <small className="catalogTopologyCount">{count}</small>
        ) : null}
      </span>
      {action}
    </header>
  );
}

function TopologyRow({
  actions,
  active = false,
  hasChildren = false,
  meta,
  name,
  onSelect,
}) {
  return (
    <div
      className={
        active
          ? "catalogTopologyRow activeCatalogTopologyRow"
          : "catalogTopologyRow"
      }
    >
      <button
        aria-pressed={active}
        className="catalogTopologyRowMain"
        onClick={onSelect}
        type="button"
      >
        <span className="catalogTopologyRowText">
          <strong>{name}</strong>
          {meta ? <small>{meta}</small> : null}
        </span>
      </button>
      <div className="catalogTopologyRowControls">
        {actions ? (
          <div
            className="catalogTopologyRowActions"
            onClick={(event) => event.stopPropagation()}
          >
            {actions}
          </div>
        ) : null}
        {hasChildren ? (
          <span className="catalogTopologyRowState">
            <ChevronRight size={15} />
          </span>
        ) : null}
      </div>
    </div>
  );
}

function EmptyColumn({ children }) {
  return <p className="catalogColumnEmpty">{children}</p>;
}

export function CatalogTopologyTab({
  actor,
  context,
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
      !components.some(({ id }) => id === selectedComponentId)
    ) {
      setSelectedComponentId("");
      setSelectedDeploymentId("");
    }
  }, [components, selectedComponentId]);

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
      void loadRuntimes(selectedDeploymentId);
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
      <div className="catalogSectionHeader">
        <span>
          Navegue da estrutura lógica da aplicação até suas instâncias em
          execução.
        </span>
        {canViewDiagram ? (
          <button
            className="secondaryButton"
            onClick={() => setDiagramOpen(true)}
            type="button"
          >
            <Network size={16} /> Visualizar topologia
          </button>
        ) : null}
      </div>
      <div
        aria-label="Componentes, deployments e runtimes"
        className="catalogColumns catalogTopologyColumns"
        role="tree"
      >
        <section className="catalogColumn" role="group">
          <ColumnHeader
            action={
              hasPermission(actor, "components.create") ? (
                <button
                  aria-label="Novo componente"
                  className="iconButton catalogTopologyAddButton"
                  onClick={() => setDialog({ kind: "component", entity: null })}
                  title="Novo componente"
                  type="button"
                >
                  <Plus size={15} />
                </button>
              ) : null
            }
            count={components.length}
            icon={Boxes}
            title="Componentes"
          />
          <div className="catalogColumnList">
            {components.map((component) => (
              <TopologyRow
                actions={
                  canReadComponents
                    ? entityActions(
                        "component",
                        "components.update",
                        "components.archive",
                      )(component)
                    : null
                }
                active={component.id === selectedComponentId}
                hasChildren={canReadDeployments}
                key={component.id}
                name={component.name}
                onSelect={() => selectComponent(component.id)}
              />
            ))}
            {!components.length ? (
              <EmptyColumn>
                {canReadComponents
                  ? "Nenhum componente cadastrado."
                  : "Nenhum componente acessível pelos deployments disponíveis."}
              </EmptyColumn>
            ) : null}
          </div>
        </section>

        {canReadDeployments ? (
          <section className="catalogColumn" role="group">
            <ColumnHeader
              action={
                hasPermission(actor, "deployments.create") ? (
                  <button
                    aria-label="Novo deployment"
                    className="iconButton catalogTopologyAddButton"
                    disabled={!selectedComponentId}
                    onClick={() =>
                      setDialog({
                        kind: "deployment",
                        entity: { componentId: selectedComponentId },
                      })
                    }
                    title={
                      selectedComponentId
                        ? `Novo deployment de ${selectedComponent?.name}`
                        : "Selecione um componente"
                    }
                    type="button"
                  >
                    <Plus size={15} />
                  </button>
                ) : null
              }
              count={selectedComponentId ? deployments.length : undefined}
              icon={Layers3}
              title="Deployments"
            />
            <div className="catalogColumnList">
              {!selectedComponentId ? (
                <EmptyColumn>
                  Selecione um componente para visualizar seus deployments.
                </EmptyColumn>
              ) : null}
              {selectedComponentId && !deployments.length ? (
                <EmptyColumn>
                  Nenhum deployment cadastrado para este componente.
                </EmptyColumn>
              ) : null}
              {deployments.map((deployment) => (
                <TopologyRow
                  actions={entityActions(
                    "deployment",
                    "deployments.update",
                    "deployments.archive",
                  )(deployment)}
                  active={deployment.id === selectedDeploymentId}
                  hasChildren={canReadRuntimes}
                  key={deployment.id}
                  name={deployment.name}
                  onSelect={() => setSelectedDeploymentId(deployment.id)}
                />
              ))}
            </div>
          </section>
        ) : null}

        {canReadDeployments && canReadRuntimes ? (
          <section className="catalogColumn" role="group">
            <ColumnHeader
              action={
                hasPermission(actor, "runtimes.create") ? (
                  <button
                    aria-label="Novo runtime"
                    className="iconButton catalogTopologyAddButton"
                    disabled={!selectedDeploymentId}
                    onClick={() =>
                      setDialog({
                        kind: "runtime",
                        entity: null,
                        deploymentId: selectedDeploymentId,
                      })
                    }
                    title={
                      selectedDeploymentId
                        ? `Novo runtime de ${selectedDeployment?.name}`
                        : "Selecione um deployment"
                    }
                    type="button"
                  >
                    <Plus size={15} />
                  </button>
                ) : null
              }
              count={Array.isArray(runtimes) ? runtimes.length : undefined}
              icon={ServerCog}
              title="Runtimes"
            />
            <div className="catalogColumnList">
              {!selectedDeploymentId ? (
                <EmptyColumn>
                  Selecione um deployment para visualizar seus runtimes.
                </EmptyColumn>
              ) : null}
              {selectedDeploymentId &&
              runtimeLoadingByDeployment[selectedDeploymentId] ? (
                <EmptyColumn>Carregando runtimes…</EmptyColumn>
              ) : null}
              {selectedDeploymentId &&
              runtimeErrorByDeployment[selectedDeploymentId] ? (
                <div className="catalogTopologyLoadError">
                  <p>{runtimeErrorByDeployment[selectedDeploymentId]}</p>
                  <button
                    className="secondaryButton"
                    onClick={() =>
                      void loadRuntimes(selectedDeploymentId, { force: true })
                    }
                    type="button"
                  >
                    Tentar novamente
                  </button>
                </div>
              ) : null}
              {selectedDeploymentId &&
              Array.isArray(runtimes) &&
              !runtimes.length ? (
                <EmptyColumn>
                  Nenhum runtime cadastrado neste deployment.
                </EmptyColumn>
              ) : null}
              {(runtimes || []).map((runtime) => {
                const server = context.servers.find(
                  ({ id }) => id === runtime.serverId,
                );
                return (
                  <TopologyRow
                    actions={entityActions(
                      "runtime",
                      "runtimes.update",
                      "runtimes.archive",
                    )(runtime)}
                    key={runtime.id}
                    meta={server?.hostname || "Hostname não informado"}
                    name={runtime.name}
                    onSelect={() => undefined}
                  />
                );
              })}
            </div>
          </section>
        ) : null}
      </div>
      {diagramOpen ? (
        <Suspense
          fallback={
            <div className="dialogBackdrop topologyDiagramBackdrop">
              <div className="topologyDiagramBootstrap">
                Carregando editor de topologia…
              </div>
            </div>
          }
        >
          <TopologyDiagramDialog
            actor={actor}
            context={context}
            onClose={() => setDiagramOpen(false)}
          />
        </Suspense>
      ) : null}
    </section>
  );
}
