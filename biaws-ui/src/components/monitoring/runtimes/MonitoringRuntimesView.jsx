import {
  Activity,
  Boxes,
  ChevronRight,
  CircleDot,
  CloudCog,
  Folder,
  FolderOpen,
  Layers3,
  ListFilter,
  RefreshCw,
  Server,
  Settings2,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import {
  fetchApplications,
  fetchComponents,
  fetchDeployments,
  fetchMonitoredRuntimeTopology,
  fetchResourceCollections,
  fetchRuntimes,
  fetchServers,
  fetchWorkspaces,
} from "../../../api.js";
import { buildUrl } from "../../../api/client.js";
import { hasPermission } from "../../../permissions.js";
import "../../../styles/features/catalog/index.css";
import "../../../styles/features/monitoring-center.css";
import { MonitoringMetadataPresentation } from "../../shared/MonitoringEventDetails/index.jsx";
import {
  monitoringCliExample,
  RuntimeMonitoringConfiguration,
  RuntimeMonitoringHistory,
  useRuntimeMonitoring,
} from "../runtime/index.js";
import {
  applicationsInCollection,
  collectionColumns,
  deploymentsForComponent,
  filterMonitoredTopology,
  latestEventForMonitor,
  runtimeListParams,
} from "./model.js";

const LEVEL_ICONS = {
  application: Layers3,
  component: Boxes,
  deployment: CloudCog,
  runtime: Server,
};

function runtimePath({ application, component, deployment, runtime }) {
  if (!application || !component || !deployment || !runtime) return "";
  return [application.key, component.key, deployment.key, runtime.key].join(
    ".",
  );
}

function signalCurl(reference, workspaceId) {
  if (!reference || !workspaceId) return "";
  const url = buildUrl(
    `/api/monitoring/runtimes/${encodeURIComponent(reference)}/signals`,
  ).toString();
  return [
    `curl -X POST '${url}' \\`,
    "  -H 'Authorization: Bearer <api-key>' \\",
    `  -H 'X-Biaws-Workspace-Id: ${workspaceId}' \\`,
    "  -H 'Content-Type: application/json' \\",
    `  --data '${JSON.stringify({ signalId: "example:check:1", status: "healthy", source: "external-monitor", metadata: {} })}'`,
  ].join("\n");
}

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

function MonitorSummary({ event, monitor }) {
  return (
    <div className="monitoringRuntimeSummary">
      <dl>
        <div>
          <dt>Provider</dt>
          <dd>{monitor.provider.toUpperCase()}</dd>
        </div>
        <div>
          <dt>Execução</dt>
          <dd>
            {monitor.enabled ? `A cada ${monitor.intervalSeconds}s` : "Pausada"}
          </dd>
        </div>
        <div>
          <dt>Timeout</dt>
          <dd>{monitor.timeoutSeconds}s</dd>
        </div>
        <div>
          <dt>Template</dt>
          <dd>
            {monitor.templateRef
              ? `${monitor.templateRef.id} · v${monitor.templateRef.version}`
              : "Sem template"}
          </dd>
        </div>
        <div>
          <dt>Último resultado</dt>
          <dd>{monitor.lastExecution?.status || "Ainda não executado"}</dd>
        </div>
        <div>
          <dt>Próxima execução</dt>
          <dd>
            {monitor.enabled && monitor.nextRunAt
              ? new Date(monitor.nextRunAt).toLocaleString("pt-BR")
              : "Não agendada"}
          </dd>
        </div>
      </dl>
      {event?.metadata && Object.keys(event.metadata).length ? (
        <MonitoringMetadataPresentation event={event} showRawFallback />
      ) : (
        <div className="monitoringRuntimeEmptyObservation">
          Este monitor ainda não possui uma observação com dados para exibir.
        </div>
      )}
    </div>
  );
}

function RuntimeMonitoringWorkspace({ actor, context, workspace }) {
  const { application, component, deployment, runtime, servers } = context;
  const controller = useRuntimeMonitoring({
    editing: true,
    entity: runtime,
    kind: "runtime",
  });
  const [mode, setMode] = useState("overview");
  const [tab, setTab] = useState("overview");
  const [selectedMonitorId, setSelectedMonitorId] = useState("");
  const reference = runtimePath(context);
  const canUpdateRuntime = hasPermission(actor, "runtimes.update");
  const selectedMonitor =
    controller.activeMonitors.find(({ id }) => id === selectedMonitorId) ||
    controller.activeMonitors[0] ||
    null;
  const latestEvent = selectedMonitor
    ? latestEventForMonitor(controller.monitoringEvents, selectedMonitor.id)
    : null;

  useEffect(() => {
    setSelectedMonitorId("");
    setTab("overview");
  }, [runtime.id]);

  useEffect(() => {
    if (!controller.monitoringLoading && !controller.activeMonitors.length) {
      setMode("configuration");
    } else if (controller.activeMonitors.length && mode !== "configuration") {
      setMode("overview");
    }
  }, [controller.monitoringLoading, controller.activeMonitors.length]);

  const augmentedController = {
    ...controller,
    cliExample: monitoringCliExample({
      runtimeReference: reference,
      workspaceId: workspace.id,
    }),
    curlExample: signalCurl(reference, workspace.id),
    entity: runtime,
    runtimePath: reference,
    saveMonitor: async () => {
      const savedMonitor = await controller.saveMonitor();
      if (savedMonitor) {
        setSelectedMonitorId(savedMonitor.id);
        setTab("overview");
        setMode("overview");
      }
      return savedMonitor;
    },
  };
  const options = {
    application,
    canUpdateRuntime,
    components: [component],
    deployments: [deployment],
    servers,
    workspace,
  };
  const server = servers.find(({ id }) => id === runtime.serverId);

  return (
    <section className="monitoringRuntimeWorkspace">
      <header className="monitoringRuntimeHeader">
        <div>
          <span>
            {application.name} / {component.name} / {deployment.name}
          </span>
          <h2>{runtime.name}</h2>
          <p>
            {deployment.environment || "Ambiente não informado"} ·{" "}
            {server?.name || "Sem servidor associado"}
          </p>
        </div>
        <div className="monitoringRuntimeHeaderActions">
          <span className={`catalogStatus catalogStatus-${runtime.status}`}>
            {runtime.status}
          </span>
          {mode === "overview" && canUpdateRuntime ? (
            <button
              className="primaryButton"
              onClick={() => setMode("configuration")}
              type="button"
            >
              <Settings2 size={16} /> Configurar
            </button>
          ) : controller.activeMonitors.length ? (
            <button
              className="secondaryButton"
              onClick={() => setMode("overview")}
              type="button"
            >
              <Activity size={16} /> Visualizar
            </button>
          ) : null}
        </div>
      </header>

      {mode === "configuration" ? (
        <RuntimeMonitoringConfiguration
          controller={augmentedController}
          draft={{
            monitoringRetentionDays: runtime.monitoringRetentionDays ?? 90,
          }}
          editing
          options={options}
          showRetention={false}
          update={() => {}}
        />
      ) : (
        <>
          <div
            className="monitoringRuntimeTabs"
            role="tablist"
            aria-label="Detalhes do monitoramento"
          >
            <button
              aria-selected={tab === "overview"}
              onClick={() => setTab("overview")}
              role="tab"
              type="button"
            >
              Visão geral
            </button>
            <button
              aria-selected={tab === "history"}
              onClick={() => setTab("history")}
              role="tab"
              type="button"
            >
              Histórico
            </button>
          </div>
          {tab === "history" ? (
            <RuntimeMonitoringHistory
              controller={augmentedController}
              editing
              entity={runtime}
              options={options}
            />
          ) : (
            <div className="monitoringOverviewLayout">
              <aside
                aria-label="Monitores do runtime"
                className="monitoringMonitorSelector"
              >
                {controller.activeMonitors.map((monitor) => (
                  <button
                    aria-current={
                      selectedMonitor?.id === monitor.id ? "true" : undefined
                    }
                    key={monitor.id}
                    onClick={() => setSelectedMonitorId(monitor.id)}
                    type="button"
                  >
                    <span
                      className={`monitoringMonitorState ${monitor.enabled ? "enabled" : "disabled"}`}
                    />
                    <span>
                      <strong>{monitor.name}</strong>
                      <small>
                        {monitor.provider.toUpperCase()} ·{" "}
                        {monitor.enabled ? "Ativo" : "Inativo"}
                      </small>
                    </span>
                    <ChevronRight size={15} />
                  </button>
                ))}
              </aside>
              {selectedMonitor ? (
                <MonitorSummary event={latestEvent} monitor={selectedMonitor} />
              ) : null}
            </div>
          )}
        </>
      )}
    </section>
  );
}

export function MonitoringRuntimesView({ actor }) {
  const [workspace, setWorkspace] = useState(null);
  const [collections, setCollections] = useState([]);
  const [applications, setApplications] = useState([]);
  const [servers, setServers] = useState([]);
  const [components, setComponents] = useState([]);
  const [deployments, setDeployments] = useState([]);
  const [runtimes, setRuntimes] = useState([]);
  const [selectedCollectionId, setSelectedCollectionId] = useState("");
  const [application, setApplication] = useState(null);
  const [component, setComponent] = useState(null);
  const [deployment, setDeployment] = useState(null);
  const [runtime, setRuntime] = useState(null);
  const [monitoredOnly, setMonitoredOnly] = useState(false);
  const [monitoredTopology, setMonitoredTopology] = useState({
    applicationIds: [],
    componentIds: [],
    deploymentIds: [],
    runtimeIds: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const filteredTopology = useMemo(
    () =>
      filterMonitoredTopology({
        applications,
        collections,
        components,
        deployments,
        monitoredOnly,
        topology: monitoredTopology,
      }),
    [
      applications,
      collections,
      components,
      deployments,
      monitoredOnly,
      monitoredTopology,
    ],
  );
  const visibleApplications = useMemo(
    () =>
      applicationsInCollection(
        filteredTopology.applications,
        selectedCollectionId,
      ),
    [filteredTopology.applications, selectedCollectionId],
  );
  const showRootCollection = useMemo(
    () =>
      applicationsInCollection(filteredTopology.applications, "").length > 0,
    [filteredTopology.applications],
  );
  const visibleDeployments = useMemo(
    () => deploymentsForComponent(filteredTopology.deployments, component?.id),
    [filteredTopology.deployments, component?.id],
  );

  async function loadRoot() {
    setLoading(true);
    setError("");
    try {
      const workspacePayload = await fetchWorkspaces();
      const currentWorkspace = (workspacePayload.items || []).find(
        ({ id }) => id === actor.workspaceId,
      );
      if (!currentWorkspace) throw new Error("Workspace atual não encontrado.");
      const [
        collectionPayload,
        applicationPayload,
        serverPayload,
        monitoringTopologyPayload,
      ] = await Promise.all([
        fetchResourceCollections("applications"),
        fetchApplications(currentWorkspace.id, { limit: 100 }),
        hasPermission(actor, "servers.read")
          ? fetchServers(currentWorkspace.id, { limit: 100 })
          : Promise.resolve({ items: [] }),
        fetchMonitoredRuntimeTopology(),
      ]);
      setWorkspace(currentWorkspace);
      setCollections(collectionPayload.items || []);
      setApplications(applicationPayload.items || []);
      setServers(serverPayload.items || []);
      setMonitoredTopology(monitoringTopologyPayload.topology || {});
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadRoot();
  }, [actor.workspaceId]);

  async function selectApplication(nextApplication) {
    setApplication(nextApplication);
    setComponent(null);
    setDeployment(null);
    setRuntime(null);
    setRuntimes([]);
    setLoading(true);
    setError("");
    try {
      const [componentPayload, deploymentPayload] = await Promise.all([
        fetchComponents(nextApplication.id, { limit: 100 }),
        fetchDeployments(nextApplication.id, { limit: 100 }),
      ]);
      setComponents(componentPayload.items || []);
      setDeployments(deploymentPayload.items || []);
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  }

  function selectComponent(nextComponent) {
    setComponent(nextComponent);
    setDeployment(null);
    setRuntime(null);
    setRuntimes([]);
  }

  async function loadDeploymentRuntimes(nextDeployment, onlyMonitored) {
    setDeployment(nextDeployment);
    setLoading(true);
    setError("");
    try {
      const payload = await fetchRuntimes(
        nextDeployment.id,
        runtimeListParams(onlyMonitored),
      );
      const nextRuntimes = payload.items || [];
      setRuntimes(nextRuntimes);
      setRuntime((current) =>
        current && nextRuntimes.some(({ id }) => id === current.id)
          ? current
          : null,
      );
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  }

  async function selectDeployment(nextDeployment) {
    setRuntime(null);
    setRuntimes([]);
    await loadDeploymentRuntimes(nextDeployment, monitoredOnly);
  }

  async function toggleMonitoredOnly() {
    const nextValue = !monitoredOnly;
    if (!nextValue) {
      setMonitoredOnly(false);
      return;
    }

    setLoading(true);
    setError("");
    try {
      const payload = await fetchMonitoredRuntimeTopology();
      const nextTopology = payload.topology || {};
      setMonitoredTopology(nextTopology);
      setMonitoredOnly(true);
      const visibleCollectionIds = new Set(
        filterMonitoredTopology({
          applications,
          collections,
          monitoredOnly: true,
          topology: nextTopology,
        }).collections.map(({ id }) => id),
      );
      if (
        selectedCollectionId &&
        !visibleCollectionIds.has(selectedCollectionId)
      ) {
        setSelectedCollectionId("");
      }
      setApplication(null);
      setComponent(null);
      setDeployment(null);
      setRuntime(null);
      setComponents([]);
      setDeployments([]);
      setRuntimes([]);
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  }

  async function refreshNavigation() {
    await loadRoot();
    if (monitoredOnly) {
      setApplication(null);
      setComponent(null);
      setDeployment(null);
      setRuntime(null);
      setComponents([]);
      setDeployments([]);
      setRuntimes([]);
      return;
    }
    if (deployment) {
      await loadDeploymentRuntimes(deployment, monitoredOnly);
    }
  }

  function selectCollection(collectionId) {
    setSelectedCollectionId(collectionId);
    setApplication(null);
    setComponent(null);
    setDeployment(null);
    setRuntime(null);
    setComponents([]);
    setDeployments([]);
    setRuntimes([]);
  }

  return (
    <section className="monitoringCenterPage">
      <header className="monitoringCenterHero">
        <div>
          <span>{workspace?.name || "Monitoramento"}</span>
          <h1>Runtimes monitorados</h1>
          <p>
            Navegue pela topologia operacional e gerencie monitores sem alterar
            o catálogo.
          </p>
        </div>
        <div className="monitoringCenterHeroActions">
          <button
            aria-pressed={monitoredOnly}
            className={
              monitoredOnly
                ? "secondaryButton monitoringRuntimeFilter active"
                : "secondaryButton monitoringRuntimeFilter"
            }
            disabled={loading}
            onClick={toggleMonitoredOnly}
            type="button"
          >
            <ListFilter size={16} /> Somente monitorados
          </button>
          <button
            aria-label="Atualizar navegação"
            className="iconButton"
            disabled={loading}
            onClick={refreshNavigation}
            type="button"
          >
            <RefreshCw size={17} />
          </button>
        </div>
      </header>
      {error ? (
        <div className="errorBox" role="alert">
          {error}
        </div>
      ) : null}
      <div className="monitoringNavigator" aria-busy={loading}>
        <CollectionNavigation
          collections={filteredTopology.collections}
          onSelect={selectCollection}
          selectedId={selectedCollectionId}
          showRoot={!monitoredOnly || showRootCollection}
        />
        <NavigationColumn
          empty="Nenhuma aplicação nesta coleção."
          items={visibleApplications}
          kind="application"
          onSelect={selectApplication}
          selectedId={application?.id}
          title="Aplicação"
        />
        {application ? (
          <NavigationColumn
            empty="Nenhum componente."
            items={filteredTopology.components}
            kind="component"
            onSelect={selectComponent}
            selectedId={component?.id}
            title="Componente"
          />
        ) : null}
        {component ? (
          <NavigationColumn
            empty="Nenhum deployment."
            items={visibleDeployments}
            kind="deployment"
            onSelect={selectDeployment}
            selectedId={deployment?.id}
            title="Deployment"
          />
        ) : null}
        {deployment ? (
          <NavigationColumn
            empty="Nenhum runtime."
            items={runtimes}
            kind="runtime"
            onSelect={setRuntime}
            selectedId={runtime?.id}
            title="Runtime"
          />
        ) : null}
      </div>
      {loading ? (
        <div className="monitoringCenterLoading" role="status">
          Carregando contexto…
        </div>
      ) : null}
      {runtime && workspace ? (
        <RuntimeMonitoringWorkspace
          actor={actor}
          context={{ application, component, deployment, runtime, servers }}
          key={runtime.id}
          workspace={workspace}
        />
      ) : (
        <div className="monitoringCenterEmpty">
          <Server size={30} />
          <strong>Selecione um runtime</strong>
          <span>A configuração e o histórico serão exibidos nesta área.</span>
        </div>
      )}
    </section>
  );
}
