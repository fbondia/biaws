import {
  Activity,
  BarChart3,
  CheckCircle2,
  CircleAlert,
  ChevronDown,
  Clock3,
  ClipboardList,
  Eye,
  EyeOff,
  GripVertical,
  LayoutDashboard,
  Plus,
  RefreshCw,
  Save,
  Server,
  Settings,
  Settings2,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import {
  fetchHomeDashboard,
  fetchRuntimeMonitoringTimeline,
  updateHomeConfiguration,
} from "../../api.js";
import {
  MonitoringEventDetails,
  MonitoringMetadataPresentation,
} from "../shared/MonitoringEventDetails.jsx";
import {
  createWidgetInstance,
  HOME_WIDGET_SIZES,
  moveWidget,
  updateWidgetInstance,
  widgetSubtitle,
  widgetTitle,
} from "./homeModel.js";

const ICONS = {
  "issues-period": Activity,
  "open-issues-by-application": BarChart3,
  "open-issues-by-type": BarChart3,
  "pending-tasks": ClipboardList,
  "application-health": CheckCircle2,
};
const MONITORING_STATUSES = [
  "unknown",
  "healthy",
  "degraded",
  "unavailable",
  "stopped",
];
const EMPTY_MONITORING_FILTERS = {
  status: "",
  observedFrom: "",
  observedTo: "",
};

function formatDate(value) {
  if (!value) return "Sem sinal recebido";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function applicationRuntimes(application) {
  return (application?.components || []).flatMap((component) =>
    (component.deployments || []).flatMap((deployment) =>
      (deployment.runtimes || []).map((runtime) => ({
        ...runtime,
        componentName: component.name,
        deploymentName: deployment.name,
      })),
    ),
  );
}

function HealthMetadataExplorer({ applications, onSelectRuntime }) {
  const [applicationId, setApplicationId] = useState(
    () => applications[0]?.id || "",
  );
  const [runtimeId, setRuntimeId] = useState("");
  const activeApplication =
    applications.find(({ id }) => id === applicationId) || applications[0];
  const runtimes = applicationRuntimes(activeApplication);
  const activeRuntime =
    runtimes.find(({ id }) => id === runtimeId) || runtimes[0];

  function selectApplication(application) {
    setApplicationId(application.id);
    setRuntimeId(applicationRuntimes(application)[0]?.id || "");
  }

  if (!activeApplication || !activeRuntime) return null;
  const hasMetadata = Boolean(
    activeRuntime.latestSignal?.metadata &&
    Object.keys(activeRuntime.latestSignal.metadata).length,
  );

  return (
    <section className="homeHealthMetadataExplorer">
      <div
        aria-label="Aplicações monitoradas"
        className="homeHealthApplicationTabs"
        role="tablist"
      >
        {applications.map((application) => (
          <button
            aria-selected={application.id === activeApplication.id}
            className={
              application.id === activeApplication.id ? "isActive" : undefined
            }
            key={application.id}
            onClick={() => selectApplication(application)}
            role="tab"
            type="button"
          >
            {application.name}
          </button>
        ))}
      </div>
      <div
        aria-label={`Runtimes de ${activeApplication.name}`}
        className="homeHealthRuntimeTabs"
        role="tablist"
      >
        {runtimes.map((runtime) => (
          <button
            aria-selected={runtime.id === activeRuntime.id}
            className={runtime.id === activeRuntime.id ? "isActive" : undefined}
            key={runtime.id}
            onClick={() => setRuntimeId(runtime.id)}
            role="tab"
            type="button"
          >
            <span>{runtime.name}</span>
            <small>{runtime.deploymentName}</small>
          </button>
        ))}
      </div>
      <div className="homeHealthMetadataPanel" role="tabpanel">
        <header>
          <div>
            <strong>{activeRuntime.name}</strong>
            <small>
              {activeRuntime.componentName} · {activeRuntime.deploymentName} ·{" "}
              {activeRuntime.server?.name || "Sem servidor associado"}
            </small>
          </div>
          <button
            className="secondaryButton"
            onClick={() => onSelectRuntime(activeRuntime)}
            type="button"
          >
            Ver histórico
          </button>
        </header>
        <div className="homeHealthMetadataPanelContext">
          <span
            className={`catalogStatus catalogStatus-${activeRuntime.status}`}
          >
            {activeRuntime.status}
          </span>
          <span>Última entrada: {formatDate(activeRuntime.observedAt)}</span>
        </div>
        {hasMetadata ? (
          <MonitoringMetadataPresentation
            event={activeRuntime.latestSignal}
            showRawFallback
          />
        ) : (
          <div className="homeHealthRuntimeMetadataEmpty">
            O último sinal não possui metadados.
          </div>
        )}
      </div>
    </section>
  );
}

function WidgetContent({
  data,
  onRefresh,
  onSelectRuntime,
  refreshing = false,
}) {
  const [showMetadata, setShowMetadata] = useState(false);
  if (!data) {
    return (
      <div className="homeWidgetPending">
        Salve a personalização para carregar este widget.
      </div>
    );
  }
  if (data.kind === "stat") {
    return (
      <div className="homeStatWidget">
        <strong>{data.value}</strong>
        <span>chamados recebidos</span>
      </div>
    );
  }
  if (data.kind === "breakdown") {
    const maximum = Math.max(
      1,
      ...(data.items || []).map(({ value }) => value),
    );
    if (!data.items?.length)
      return <div className="homeWidgetEmpty">Nenhum chamado aberto.</div>;
    return (
      <div className="homeBreakdown">
        {data.items.map((item) => (
          <div className="homeBreakdownRow" key={item.key}>
            <div>
              <span>{item.label}</span>
              <strong>{item.value}</strong>
            </div>
            <span className="homeBreakdownTrack">
              <span style={{ width: `${(item.value / maximum) * 100}%` }} />
            </span>
          </div>
        ))}
      </div>
    );
  }
  if (data.kind === "tasks") {
    return (
      <div className="homeTasksWidget">
        <strong className="homeTasksTotal">{data.value} pendentes</strong>
        {!data.items?.length ? (
          <div className="homeWidgetEmpty">Nenhuma tarefa pendente.</div>
        ) : (
          <div className="homeTaskList">
            {data.items.map((task) => (
              <article key={task.id}>
                <div>
                  <strong>{task.title}</strong>
                  <small>{task.requestTitle}</small>
                </div>
                <span>{task.status}</span>
              </article>
            ))}
          </div>
        )}
      </div>
    );
  }
  if (data.kind === "health") {
    return (
      <div className="homeHealthWidget">
        <div className="homeHealthSummary">
          <span className="homeHealthOk">
            <CheckCircle2 size={18} /> <strong>{data.ok}</strong> runtimes OK
          </span>
          <span className="homeHealthNok">
            <CircleAlert size={18} /> <strong>{data.nok}</strong> runtimes NOK
          </span>
        </div>
        <div className="homeHealthToolbar">
          <button
            className="secondaryButton"
            onClick={() => setShowMetadata((current) => !current)}
            type="button"
          >
            {showMetadata ? <EyeOff size={15} /> : <Eye size={15} />}
            {showMetadata ? "Ocultar metadados" : "Mostrar metadados"}
          </button>
          <button
            aria-label="Atualizar widget de monitoramento"
            className="secondaryButton"
            disabled={refreshing}
            onClick={() => void onRefresh?.()}
            type="button"
          >
            <RefreshCw
              className={refreshing ? "spinIcon" : undefined}
              size={15}
            />
            {refreshing ? "Atualizando…" : "Atualizar widget"}
          </button>
        </div>
        {!data.items?.length ? (
          <div className="homeWidgetEmpty">
            Nenhum runtime com sinais de monitoramento.
          </div>
        ) : showMetadata ? (
          <HealthMetadataExplorer
            applications={data.items}
            onSelectRuntime={onSelectRuntime}
          />
        ) : (
          <div className="homeHealthApplications">
            {data.items.map((application) => (
              <section className="homeHealthApplication" key={application.id}>
                <header>
                  <div>
                    <strong>{application.name}</strong>
                  </div>
                  <span
                    className={`catalogStatus catalogStatus-${application.status}`}
                  >
                    {application.status}
                  </span>
                </header>
                <div className="homeHealthComponents">
                  {application.components.map((component) => (
                    <section key={component.id}>
                      <header>
                        <strong>{component.name}</strong>
                      </header>
                      <div className="homeHealthDeployments">
                        {component.deployments.map((deployment) => (
                          <section key={deployment.id}>
                            <header>
                              <div>
                                <strong>{deployment.name}</strong>
                              </div>
                            </header>
                            <div className="homeHealthRuntimes">
                              {deployment.runtimes.map((runtime) => (
                                <div
                                  className="homeHealthRuntimeCard"
                                  key={runtime.id}
                                >
                                  <button
                                    className="homeHealthRuntime"
                                    onClick={() => onSelectRuntime(runtime)}
                                    type="button"
                                  >
                                    <div className="homeHealthRuntimeIdentity">
                                      <strong>{runtime.name}</strong>
                                      <span className="homeHealthServer">
                                        <Server size={13} />
                                        {runtime.server?.name ||
                                          "Sem servidor associado"}
                                      </span>
                                      <span className="homeHealthLastSignal">
                                        <Clock3 size={13} />
                                        Última entrada:{" "}
                                        {formatDate(runtime.observedAt)}
                                        {runtime.source
                                          ? ` · ${runtime.source}`
                                          : ""}
                                        {runtime.message
                                          ? ` · ${runtime.message}`
                                          : ""}
                                      </span>
                                    </div>
                                    <span
                                      className={`catalogStatus catalogStatus-${runtime.status}`}
                                    >
                                      {runtime.status}
                                    </span>
                                  </button>
                                </div>
                              ))}
                            </div>
                          </section>
                        ))}
                      </div>
                    </section>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    );
  }
  return <div className="homeWidgetEmpty">Widget indisponível.</div>;
}

function RuntimeMonitoringDialog({ runtime, onClose }) {
  const [signals, setSignals] = useState([]);
  const [meta, setMeta] = useState(null);
  const [draftFilters, setDraftFilters] = useState(EMPTY_MONITORING_FILTERS);
  const [filters, setFilters] = useState(EMPTY_MONITORING_FILTERS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    void fetchRuntimeMonitoringTimeline(runtime.id, {
      page: 1,
      limit: 20,
      ...filters,
    })
      .then((payload) => {
        if (!active) return;
        setSignals(payload.items || []);
        setMeta(payload.meta || null);
      })
      .catch((loadError) => {
        if (active) setError(loadError.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [runtime.id, filters]);

  function applyFilters(event) {
    event.preventDefault();
    if (
      draftFilters.observedFrom &&
      draftFilters.observedTo &&
      draftFilters.observedFrom > draftFilters.observedTo
    ) {
      setError("A data final deve ser igual ou posterior à data inicial.");
      return;
    }
    setFilters({ ...draftFilters });
  }

  function clearFilters() {
    setDraftFilters({ ...EMPTY_MONITORING_FILTERS });
    setFilters({ ...EMPTY_MONITORING_FILTERS });
  }

  return (
    <div
      className="dialogBackdrop homeMonitoringBackdrop"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <section
        aria-labelledby="home-monitoring-dialog-title"
        aria-modal="true"
        className="homeMonitoringDialog"
        role="dialog"
      >
        <header>
          <div>
            <span>Histórico de monitoramento</span>
            <h2 id="home-monitoring-dialog-title">{runtime.name}</h2>
            <small>
              {runtime.server?.name || "Sem servidor associado"} · UUID{" "}
              {runtime.id}
            </small>
          </div>
          <button
            aria-label="Fechar histórico"
            className="iconButton"
            onClick={onClose}
            type="button"
          >
            <X size={18} />
          </button>
        </header>
        <div className="homeMonitoringDialogBody">
          <form className="homeMonitoringFilters" onSubmit={applyFilters}>
            <label className="field">
              <span>Data inicial</span>
              <input
                max={draftFilters.observedTo || undefined}
                onChange={(event) =>
                  setDraftFilters((current) => ({
                    ...current,
                    observedFrom: event.target.value,
                  }))
                }
                type="date"
                value={draftFilters.observedFrom}
              />
            </label>
            <label className="field">
              <span>Data final</span>
              <input
                min={draftFilters.observedFrom || undefined}
                onChange={(event) =>
                  setDraftFilters((current) => ({
                    ...current,
                    observedTo: event.target.value,
                  }))
                }
                type="date"
                value={draftFilters.observedTo}
              />
            </label>
            <label className="field">
              <span>Status</span>
              <select
                onChange={(event) =>
                  setDraftFilters((current) => ({
                    ...current,
                    status: event.target.value,
                  }))
                }
                value={draftFilters.status}
              >
                <option value="">Todos</option>
                {MONITORING_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </label>
            <div className="homeMonitoringFilterActions">
              <button
                className="secondaryButton"
                disabled={loading}
                onClick={clearFilters}
                type="button"
              >
                Limpar
              </button>
              <button
                className="primaryButton"
                disabled={loading}
                type="submit"
              >
                Filtrar
              </button>
            </div>
          </form>
          {loading ? (
            <div className="homeWidgetPending">Carregando sinais…</div>
          ) : error ? (
            <div className="errorBox">{error}</div>
          ) : !signals.length ? (
            <div className="homeWidgetEmpty">
              Nenhum sinal encontrado para os filtros informados.
            </div>
          ) : (
            <div className="homeMonitoringSignals">
              {signals.map((signal) => (
                <article key={signal.id}>
                  <div className="homeMonitoringSignalHeading">
                    <div className="homeMonitoringSignalBadges">
                      <span
                        className={`catalogStatus catalogStatus-${signal.status}`}
                      >
                        {signal.status}
                      </span>
                      <span className="monitoringOriginBadge">
                        {signal.origin === "manual" ? "Manual" : "Externo"}
                      </span>
                    </div>
                    <time dateTime={signal.observedAt}>
                      {formatDate(signal.observedAt)}
                    </time>
                  </div>
                  <strong>{signal.source}</strong>
                  {signal.message ? <p>{signal.message}</p> : null}
                  <small>
                    Recebido em {formatDate(signal.receivedAt)}
                    {signal.signalId ? ` · Sinal ${signal.signalId}` : ""}
                  </small>
                  <MonitoringEventDetails event={signal} />
                </article>
              ))}
            </div>
          )}
        </div>
        {meta?.total ? (
          <footer>
            Exibindo {signals.length} de {meta.total} eventos, do mais recente
            para o mais antigo.
          </footer>
        ) : null}
      </section>
    </div>
  );
}

function ConfigurationDialog({
  applications,
  definition,
  instance,
  onClose,
  onConfirm,
}) {
  const [config, setConfig] = useState(() => ({
    ...(instance?.config || {}),
  }));
  return (
    <div className="dialogBackdrop homeDialogBackdrop">
      <section
        aria-modal="true"
        className="homeConfigurationDialog"
        role="dialog"
      >
        <header>
          <div>
            <span>Configurar widget</span>
            <h2>{definition.label}</h2>
          </div>
          <button
            aria-label="Fechar"
            className="iconButton"
            onClick={onClose}
            type="button"
          >
            <X size={18} />
          </button>
        </header>
        <div className="homeConfigurationFields">
          {(definition.configuration?.fields || []).map((field) => (
            <label className="field" key={field.key}>
              <span>{field.label}</span>
              <select
                onChange={(event) =>
                  setConfig((current) => ({
                    ...current,
                    [field.key]: event.target.value,
                  }))
                }
                value={config[field.key] || ""}
              >
                {!field.required ? (
                  <option value="">
                    {field.emptyLabel || "Não informado"}
                  </option>
                ) : null}
                {field.type === "application"
                  ? applications.map((application) => (
                      <option key={application.id} value={application.id}>
                        {application.name}
                      </option>
                    ))
                  : (field.options || []).map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
              </select>
            </label>
          ))}
        </div>
        <footer>
          <button className="secondaryButton" onClick={onClose} type="button">
            Cancelar
          </button>
          <button
            className="primaryButton"
            onClick={() => onConfirm(config)}
            type="button"
          >
            <Save size={16} /> Aplicar
          </button>
        </footer>
      </section>
    </div>
  );
}

function WidgetCatalog({ catalog, onAdd, onClose }) {
  const categories = useMemo(
    () =>
      Object.entries(
        catalog.reduce((result, widget) => {
          (result[widget.category] ||= []).push(widget);
          return result;
        }, {}),
      ),
    [catalog],
  );
  return (
    <div
      className="homeCatalogBackdrop"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <aside className="homeWidgetCatalog">
        <header>
          <div>
            <span>Catálogo</span>
            <h2>Adicionar widget</h2>
          </div>
          <button
            aria-label="Fechar catálogo"
            className="iconButton"
            onClick={onClose}
            type="button"
          >
            <X size={19} />
          </button>
        </header>
        <div className="homeWidgetCatalogContent">
          {categories.map(([category, widgets]) => (
            <section key={category}>
              <h3>{category}</h3>
              {widgets.map((widget) => {
                const Icon = ICONS[widget.id] || LayoutDashboard;
                return (
                  <button
                    className="homeCatalogWidget"
                    key={widget.id}
                    onClick={() => onAdd(widget)}
                    type="button"
                  >
                    <span>
                      <Icon size={18} />
                    </span>
                    <div>
                      <strong>{widget.label}</strong>
                      <small>{widget.description}</small>
                    </div>
                    <Plus size={17} />
                  </button>
                );
              })}
            </section>
          ))}
        </div>
      </aside>
    </div>
  );
}

export function HomeView() {
  const [dashboard, setDashboard] = useState(null);
  const [draftWidgets, setDraftWidgets] = useState([]);
  const [editing, setEditing] = useState(false);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [configuration, setConfiguration] = useState(null);
  const [monitoringRuntime, setMonitoringRuntime] = useState(null);
  const [draggingId, setDraggingId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      setDashboard(await fetchHomeDashboard());
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  function beginEditing() {
    setDraftWidgets(structuredClone(dashboard.configuration.widgets));
    setEditing(true);
  }

  function addWidget(definition) {
    const instance = createWidgetInstance(definition, {});
    if (definition.configuration?.fields?.length) {
      setConfiguration({ definition, instance, creating: true });
    } else {
      setDraftWidgets((current) => [...current, instance]);
    }
    setCatalogOpen(false);
  }

  function applyConfiguration(config) {
    const { instance, creating } = configuration;
    if (creating) {
      setDraftWidgets((current) => [...current, { ...instance, config }]);
    } else {
      setDraftWidgets((current) =>
        updateWidgetInstance(current, instance.id, { config }),
      );
    }
    setConfiguration(null);
  }

  async function save() {
    setSaving(true);
    setError("");
    try {
      const payload = await updateHomeConfiguration(draftWidgets);
      setDashboard(payload);
      setEditing(false);
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading && !dashboard) {
    return (
      <div className="emptyState homeLoading">
        Carregando sua página inicial…
      </div>
    );
  }

  if (!dashboard) {
    return (
      <section className="homePage">
        <div className="errorBox">
          {error || "Não foi possível carregar a home."}
        </div>
        <button
          className="primaryButton"
          onClick={() => void load()}
          type="button"
        >
          Tentar novamente
        </button>
      </section>
    );
  }

  const widgets = editing
    ? draftWidgets
    : dashboard?.configuration.widgets || [];
  const catalogById = new Map(
    (dashboard?.catalog || []).map((item) => [item.id, item]),
  );

  return (
    <section className="homePage">
      <header className="homeHero">
        <div>
          <span>Visão operacional</span>
          <h1>Olá, acompanhe o que importa agora.</h1>
          <p>
            Sua página inicial combina chamados, tarefas e saúde das aplicações.
          </p>
        </div>
        <div className="homeHeroActions">
          {editing ? (
            <>
              <button
                className="secondaryButton"
                disabled={saving}
                onClick={() => setCatalogOpen(true)}
                type="button"
              >
                <Plus size={16} /> Adicionar widget
              </button>
              <button
                className="secondaryButton"
                disabled={saving}
                onClick={() => setEditing(false)}
                type="button"
              >
                Cancelar
              </button>
              <button
                className="primaryButton"
                disabled={saving}
                onClick={() => void save()}
                type="button"
              >
                <Save size={16} /> {saving ? "Salvando…" : "Salvar página"}
              </button>
            </>
          ) : (
            <>
              <button
                className="secondaryButton"
                disabled={loading}
                onClick={() => void load()}
                type="button"
              >
                <RefreshCw
                  className={loading ? "spinIcon" : undefined}
                  size={16}
                />{" "}
                Atualizar
              </button>
              <button
                className="primaryButton"
                onClick={beginEditing}
                type="button"
              >
                <Settings2 size={16} /> Personalizar
              </button>
            </>
          )}
        </div>
      </header>

      {error ? <div className="errorBox">{error}</div> : null}
      {!widgets.length ? (
        <div className="homeEmptyState">
          <LayoutDashboard size={34} />
          <h2>Sua home está vazia</h2>
          <p>Abra o catálogo e escolha os primeiros widgets.</p>
          {!editing ? (
            <button
              className="primaryButton"
              onClick={beginEditing}
              type="button"
            >
              Personalizar
            </button>
          ) : null}
        </div>
      ) : (
        <div className="homeWidgetGrid">
          {widgets.map((instance) => {
            const definition = catalogById.get(instance.widgetId);
            if (!definition) return null;
            const Icon = ICONS[instance.widgetId] || LayoutDashboard;
            return (
              <article
                className={`homeWidget homeWidget-${instance.size}${draggingId === instance.id ? " homeWidgetDragging" : ""}`}
                draggable={editing}
                key={instance.id}
                onDragEnd={() => setDraggingId("")}
                onDragOver={(event) => editing && event.preventDefault()}
                onDragStart={() => setDraggingId(instance.id)}
                onDrop={() => {
                  if (editing && draggingId) {
                    setDraftWidgets((current) =>
                      moveWidget(current, draggingId, instance.id),
                    );
                  }
                  setDraggingId("");
                }}
              >
                <header>
                  <div className="homeWidgetHeading">
                    {editing ? (
                      <GripVertical className="homeWidgetGrip" size={17} />
                    ) : null}
                    <span>
                      <Icon size={17} />
                    </span>
                    <div>
                      <h2>{widgetTitle(definition, instance)}</h2>
                      <small>{widgetSubtitle(definition, instance)}</small>
                    </div>
                  </div>
                  {editing ? (
                    <div className="homeWidgetActions">
                      <label className="homeWidgetSizeChip">
                        <span className="srOnly">
                          Tamanho de {definition.label}
                        </span>
                        <select
                          onChange={(event) =>
                            setDraftWidgets((current) =>
                              updateWidgetInstance(current, instance.id, {
                                size: event.target.value,
                              }),
                            )
                          }
                          value={instance.size}
                        >
                          {HOME_WIDGET_SIZES.map((size) => (
                            <option key={size.value} value={size.value}>
                              {size.shortLabel}
                            </option>
                          ))}
                        </select>
                        <ChevronDown aria-hidden="true" size={13} />
                      </label>
                      {definition.configuration?.fields?.length ? (
                        <button
                          aria-label={`Configurar ${definition.label}`}
                          className="iconButton"
                          onClick={() =>
                            setConfiguration({
                              definition,
                              instance,
                              creating: false,
                            })
                          }
                          type="button"
                        >
                          <Settings size={15} />
                        </button>
                      ) : null}
                      <button
                        aria-label={`Remover ${definition.label}`}
                        className="iconButton dangerIconButton"
                        onClick={() =>
                          setDraftWidgets((current) =>
                            current.filter(({ id }) => id !== instance.id),
                          )
                        }
                        type="button"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  ) : null}
                </header>
                <div className="homeWidgetBody">
                  <WidgetContent
                    data={dashboard.data[instance.id]}
                    onRefresh={load}
                    onSelectRuntime={setMonitoringRuntime}
                    refreshing={loading}
                  />
                </div>
              </article>
            );
          })}
        </div>
      )}

      {catalogOpen ? (
        <WidgetCatalog
          catalog={dashboard.catalog}
          onAdd={addWidget}
          onClose={() => setCatalogOpen(false)}
        />
      ) : null}
      {configuration ? (
        <ConfigurationDialog
          applications={dashboard.applications || []}
          definition={configuration.definition}
          instance={configuration.instance}
          onClose={() => setConfiguration(null)}
          onConfirm={applyConfiguration}
        />
      ) : null}
      {monitoringRuntime ? (
        <RuntimeMonitoringDialog
          onClose={() => setMonitoringRuntime(null)}
          runtime={monitoringRuntime}
        />
      ) : null}
    </section>
  );
}
