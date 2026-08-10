import {
  Boxes,
  ChevronRight,
  Filter,
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
  status,
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
          {status ? (
            <span className={`catalogStatus catalogStatus-${status}`}>
              {status}
            </span>
          ) : null}
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

function TopologyHeader({
  canFilter,
  canViewDiagram,
  deployableOnly,
  onOpenDiagram,
  onToggleDeployable,
}) {
  return (
    <div className="catalogSectionHeader">
      <span>
        Navegue da estrutura lógica da aplicação até suas instâncias em
        execução.
      </span>
      <div className="catalogHeaderActions">
        {canFilter ? (
          <button
            aria-pressed={deployableOnly}
            className={
              deployableOnly
                ? "secondaryButton catalogDeployableFilterButton isActive"
                : "secondaryButton catalogDeployableFilterButton"
            }
            onClick={onToggleDeployable}
            title="Exibir somente componentes com deployment configurado"
            type="button"
          >
            <Filter size={16} /> Somente deployáveis
          </button>
        ) : null}
        {canViewDiagram ? (
          <button
            className="secondaryButton"
            onClick={onOpenDiagram}
            type="button"
          >
            <Network size={16} /> Visualizar topologia
          </button>
        ) : null}
      </div>
    </div>
  );
}

function ComponentsColumn({
  actor,
  canReadComponents,
  canReadDeployments,
  deployableOnly,
  entityActions,
  onCreate,
  onSelect,
  selectedId,
  visibleComponents,
}) {
  let emptyMessage =
    "Nenhum componente acessível pelos deployments disponíveis.";
  if (deployableOnly)
    emptyMessage = "Nenhum componente com deployment configurado.";
  else if (canReadComponents) emptyMessage = "Nenhum componente cadastrado.";
  return (
    <section className="catalogColumn" role="group">
      <ColumnHeader
        action={
          hasPermission(actor, "components.create") ? (
            <button
              aria-label="Novo componente"
              className="iconButton catalogTopologyAddButton"
              onClick={onCreate}
              title="Novo componente"
              type="button"
            >
              <Plus size={15} />
            </button>
          ) : null
        }
        count={visibleComponents.length}
        icon={Boxes}
        title="Componentes"
      />
      <div className="catalogColumnList">
        {visibleComponents.map((component) => (
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
            active={component.id === selectedId}
            hasChildren={canReadDeployments}
            key={component.id}
            meta={component.key}
            name={component.name}
            onSelect={() => onSelect(component.id)}
          />
        ))}
        {!visibleComponents.length ? (
          <EmptyColumn>{emptyMessage}</EmptyColumn>
        ) : null}
      </div>
    </section>
  );
}

function DeploymentsColumn({
  actor,
  canReadRuntimes,
  deployments,
  entityActions,
  onCreate,
  onSelect,
  selectedComponent,
  selectedComponentId,
  selectedDeploymentId,
}) {
  return (
    <section className="catalogColumn" role="group">
      <ColumnHeader
        action={
          hasPermission(actor, "deployments.create") ? (
            <button
              aria-label="Novo deployment"
              className="iconButton catalogTopologyAddButton"
              disabled={!selectedComponentId}
              onClick={onCreate}
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
            meta={deployment.key}
            name={deployment.name}
            onSelect={() => onSelect(deployment.id)}
          />
        ))}
      </div>
    </section>
  );
}

function RuntimesColumn({
  actor,
  entityActions,
  error,
  loading,
  loadRuntimes,
  onCreate,
  onEdit,
  runtimes,
  selectedDeployment,
  selectedDeploymentId,
}) {
  return (
    <section className="catalogColumn" role="group">
      <ColumnHeader
        action={
          hasPermission(actor, "runtimes.create") ? (
            <button
              aria-label="Novo runtime"
              className="iconButton catalogTopologyAddButton"
              disabled={!selectedDeploymentId}
              onClick={onCreate}
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
        {selectedDeploymentId && loading ? (
          <EmptyColumn>Carregando runtimes…</EmptyColumn>
        ) : null}
        {selectedDeploymentId && error ? (
          <div className="catalogTopologyLoadError">
            <p>{error}</p>
            <button
              className="secondaryButton"
              onClick={() =>
                loadRuntimes(selectedDeploymentId, { force: true })
              }
              type="button"
            >
              Tentar novamente
            </button>
          </div>
        ) : null}
        {selectedDeploymentId && Array.isArray(runtimes) && !runtimes.length ? (
          <EmptyColumn>Nenhum runtime cadastrado neste deployment.</EmptyColumn>
        ) : null}
        {(runtimes || []).map((runtime) => (
          <TopologyRow
            actions={entityActions(
              "runtime",
              "runtimes.update",
              "runtimes.archive",
            )(runtime)}
            key={runtime.id}
            meta={runtime.key}
            name={runtime.name}
            onSelect={
              hasPermission(actor, "runtimes.update")
                ? () => onEdit(runtime)
                : undefined
            }
            status={runtime.status}
          />
        ))}
      </div>
    </section>
  );
}

function TopologyDiagramOverlay({ actor, context, onClose, open }) {
  if (!open) return null;
  return (
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
        onClose={onClose}
      />
    </Suspense>
  );
}

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
