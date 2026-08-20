import {
  Boxes,
  ChevronRight,
  CircleDot,
  CloudCog,
  Folder,
  FolderOpen,
  Layers3,
  Server,
} from "lucide-react";

import { collectionColumns } from "../../model.js";
import { RuntimeMonitoringWorkspace } from "./RuntimeMonitoringWorkspace.jsx";

const LEVEL_ICONS = {
  application: Layers3,
  component: Boxes,
  deployment: CloudCog,
  runtime: Server,
};

function NavigationColumn({ empty, items, kind, onSelect, selectedId, title }) {
  const Icon = LEVEL_ICONS[kind] || CircleDot;
  return (
    <section className="monitoringNavigatorColumn">
      <header>
        <span>{title}</span>
        <small>{items.length}</small>
      </header>
      <div className="monitoringNavigatorItems">
        {!items.length ? (
          <div className="monitoringNavigatorEmpty">{empty}</div>
        ) : (
          items.map((item) => (
            <button
              aria-current={selectedId === item.id ? "true" : undefined}
              className={
                selectedId === item.id
                  ? "monitoringNavigatorItem selected"
                  : "monitoringNavigatorItem"
              }
              key={item.id}
              onClick={() => onSelect(item)}
              type="button"
            >
              <Icon size={16} />
              <span>
                <strong>{item.name}</strong>
                <small>{item.environment || item.kind || item.key}</small>
              </span>
              <ChevronRight size={15} />
            </button>
          ))
        )}
      </div>
    </section>
  );
}

function CollectionNavigation({
  collections,
  onSelect,
  selectedId,
  showRoot = true,
}) {
  const columns = collectionColumns(collections, selectedId);
  return columns.map((column, index) => (
    <section
      className="monitoringNavigatorColumn monitoringCollectionColumn"
      key={`${column.parentId || "root"}-${index}`}
    >
      <header>
        <span>{index ? "Subcoleções" : "Coleções"}</span>
        <small>{column.items.length}</small>
      </header>
      <div className="monitoringNavigatorItems">
        {index === 0 && showRoot ? (
          <button
            aria-current={!selectedId ? "true" : undefined}
            className={
              !selectedId
                ? "monitoringNavigatorItem selected"
                : "monitoringNavigatorItem"
            }
            onClick={() => onSelect("")}
            type="button"
          >
            {!selectedId ? <FolderOpen size={16} /> : <Folder size={16} />}
            <span>
              <strong>Sem coleção</strong>
              <small>Raiz do catálogo</small>
            </span>
            <ChevronRight size={15} />
          </button>
        ) : null}
        {column.items.map((collection) => (
          <button
            aria-current={
              column.selectedId === collection.id ? "true" : undefined
            }
            className={
              column.selectedId === collection.id
                ? "monitoringNavigatorItem selected"
                : "monitoringNavigatorItem"
            }
            key={collection.id}
            onClick={() => onSelect(collection.id)}
            type="button"
          >
            {column.selectedId === collection.id ? (
              <FolderOpen size={16} />
            ) : (
              <Folder size={16} />
            )}
            <span>
              <strong>{collection.name}</strong>
              <small>Coleção</small>
            </span>
            <ChevronRight size={15} />
          </button>
        ))}
      </div>
    </section>
  ));
}

export function RuntimeNavigation({ actor, controller }) {
  const {
    application,
    component,
    deployment,
    filteredTopology,
    runtime,
    runtimes,
    selectedCollectionId,
    servers,
    showRootCollection,
    visibleApplications,
    visibleDeployments,
  } = controller.navigation;

  return (
    <>
      <div className="monitoringNavigator" aria-busy={controller.loading}>
        <CollectionNavigation
          collections={filteredTopology.collections}
          onSelect={controller.selectCollection}
          selectedId={selectedCollectionId}
          showRoot={!controller.monitoredOnly || showRootCollection}
        />
        <NavigationColumn
          empty="Nenhuma aplicação nesta coleção."
          items={visibleApplications}
          kind="application"
          onSelect={controller.selectApplication}
          selectedId={application?.id}
          title="Aplicação"
        />
        {application ? (
          <NavigationColumn
            empty="Nenhum componente."
            items={filteredTopology.components}
            kind="component"
            onSelect={controller.selectComponent}
            selectedId={component?.id}
            title="Componente"
          />
        ) : null}
        {component ? (
          <NavigationColumn
            empty="Nenhum deployment."
            items={visibleDeployments}
            kind="deployment"
            onSelect={controller.selectDeployment}
            selectedId={deployment?.id}
            title="Deployment"
          />
        ) : null}
        {deployment ? (
          <NavigationColumn
            empty="Nenhum runtime."
            items={runtimes}
            kind="runtime"
            onSelect={controller.setRuntime}
            selectedId={runtime?.id}
            title="Runtime"
          />
        ) : null}
      </div>
      {controller.loading ? (
        <div className="monitoringCenterLoading" role="status">
          Carregando contexto…
        </div>
      ) : null}
      {runtime && controller.workspace ? (
        <RuntimeMonitoringWorkspace
          actor={actor}
          context={{ application, component, deployment, runtime, servers }}
          key={runtime.id}
          workspace={controller.workspace}
        />
      ) : (
        <div className="monitoringCenterEmpty">
          <Server size={30} />
          <strong>Selecione um runtime</strong>
          <span>A configuração e o histórico serão exibidos nesta área.</span>
        </div>
      )}
    </>
  );
}
