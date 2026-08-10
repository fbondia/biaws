import {
  Activity,
  BarChart3,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  GripVertical,
  LayoutDashboard,
  Plus,
  RefreshCw,
  Save,
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
import { MonitoringEventDetails } from "../shared/MonitoringEventDetails.jsx";
import {
  createWidgetInstance,
  HOME_WIDGET_SIZES,
  moveWidget,
  updateWidgetInstance,
  widgetSubtitle,
  widgetTitle,
} from "./homeModel.js";
import { WidgetContent } from "./widgets/WidgetContent.jsx";
import { formatMonitoringDate } from "./widgets/widgetUtils.js";

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
                      {formatMonitoringDate(signal.observedAt)}
                    </time>
                  </div>
                  <strong>{signal.source}</strong>
                  {signal.message ? <p>{signal.message}</p> : null}
                  <small>
                    Recebido em {formatMonitoringDate(signal.receivedAt)}
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
  const selectedApplication = applications.find(
    ({ id }) => id === config.applicationId,
  );
  const selectedComponent = selectedApplication?.components?.find(
    ({ id }) => id === config.componentId,
  );
  const selectedDeployment = selectedComponent?.deployments?.find(
    ({ id }) => id === config.deploymentId,
  );

  function fieldOptions(field) {
    if (field.type === "application") return applications;
    if (field.type === "component")
      return selectedApplication?.components || [];
    if (field.type === "deployment")
      return selectedComponent?.deployments || [];
    if (field.type === "runtime") return selectedDeployment?.runtimes || [];
    return field.options || [];
  }

  function fieldIsVisible(field) {
    if (field.type === "component") return Boolean(selectedApplication);
    if (field.type === "deployment") return Boolean(selectedComponent);
    if (field.type === "runtime") return Boolean(selectedDeployment);
    return true;
  }

  function updateConfigurationField(field, value) {
    setConfig((current) => {
      const next = { ...current, [field.key]: value };
      if (field.type === "application") {
        next.componentId = "";
        next.deploymentId = "";
        next.runtimeId = "";
      } else if (field.type === "component") {
        next.deploymentId = "";
        next.runtimeId = "";
      } else if (field.type === "deployment") {
        next.runtimeId = "";
      } else if (field.type === "runtime" && value) {
        next.presentation = "tabs";
      }
      return next;
    });
  }
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
          {(definition.configuration?.fields || [])
            .filter(fieldIsVisible)
            .map((field) => (
              <label className="field" key={field.key}>
                <span>{field.label}</span>
                <select
                  disabled={field.key === "presentation" && config.runtimeId}
                  onChange={(event) =>
                    updateConfigurationField(field, event.target.value)
                  }
                  value={config[field.key] || ""}
                >
                  {!field.required ? (
                    <option value="">
                      {field.emptyLabel || "Não informado"}
                    </option>
                  ) : null}
                  {fieldOptions(field).map((option) => (
                    <option
                      key={option.value || option.id}
                      value={option.value || option.id}
                    >
                      {option.label || option.name}
                    </option>
                  ))}
                </select>
                {field.key === "presentation" && config.runtimeId ? (
                  <small className="homeConfigurationHint">
                    Um runtime específico é apresentado diretamente com seus
                    metadados.
                  </small>
                ) : null}
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

function HomeHeroActions({
  editing,
  loading,
  onAddWidget,
  onBeginEditing,
  onCancel,
  onRefresh,
  onSave,
  saving,
}) {
  if (editing) {
    return (
      <>
        <button
          className="secondaryButton"
          disabled={saving}
          onClick={onAddWidget}
          type="button"
        >
          <Plus size={16} /> Adicionar widget
        </button>
        <button
          className="secondaryButton"
          disabled={saving}
          onClick={onCancel}
          type="button"
        >
          Cancelar
        </button>
        <button
          className="primaryButton"
          disabled={saving}
          onClick={onSave}
          type="button"
        >
          <Save size={16} /> {saving ? "Salvando…" : "Salvar página"}
        </button>
      </>
    );
  }
  return (
    <>
      <button
        className="secondaryButton"
        disabled={loading}
        onClick={onRefresh}
        type="button"
      >
        <RefreshCw className={loading ? "spinIcon" : undefined} size={16} />{" "}
        Atualizar
      </button>
      <button className="primaryButton" onClick={onBeginEditing} type="button">
        <Settings2 size={16} /> Personalizar
      </button>
    </>
  );
}

function HomeWidgetCard({
  dashboard,
  definition,
  draggingId,
  editing,
  instance,
  onConfigure,
  onDragEnd,
  onDragStart,
  onDrop,
  onOpenRequestTask,
  onRemove,
  onResize,
  onSelectRuntime,
}) {
  const Icon = ICONS[instance.widgetId] || LayoutDashboard;
  return (
    <article
      className={`homeWidget homeWidget-${instance.size}${draggingId === instance.id ? " homeWidgetDragging" : ""}`}
      draggable={editing}
      onDragEnd={onDragEnd}
      onDragOver={(event) => editing && event.preventDefault()}
      onDragStart={() => onDragStart(instance.id)}
      onDrop={() => onDrop(instance.id)}
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
              <span className="srOnly">Tamanho de {definition.label}</span>
              <select
                onChange={(event) => onResize(instance.id, event.target.value)}
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
                onClick={() => onConfigure(definition, instance)}
                type="button"
              >
                <Settings size={15} />
              </button>
            ) : null}
            <button
              aria-label={`Remover ${definition.label}`}
              className="iconButton dangerIconButton"
              onClick={() => onRemove(instance.id)}
              type="button"
            >
              <Trash2 size={15} />
            </button>
          </div>
        ) : null}
      </header>
      <div className="homeWidgetBody">
        <WidgetContent
          config={instance.config}
          data={dashboard.data[instance.id]}
          onOpenRequestTask={onOpenRequestTask}
          onSelectRuntime={onSelectRuntime}
        />
      </div>
    </article>
  );
}

function HomeWidgetGrid({ catalogById, widgets, ...cardProps }) {
  return (
    <div className="homeWidgetGrid">
      {widgets.map((instance) => {
        const definition = catalogById.get(instance.widgetId);
        return definition ? (
          <HomeWidgetCard
            {...cardProps}
            definition={definition}
            instance={instance}
            key={instance.id}
          />
        ) : null;
      })}
    </div>
  );
}

function HomeWidgetArea({ editing, onBeginEditing, widgets, ...gridProps }) {
  if (widgets.length) {
    return <HomeWidgetGrid {...gridProps} widgets={widgets} />;
  }
  return (
    <div className="homeEmptyState">
      <LayoutDashboard size={34} />
      <h2>Sua home está vazia</h2>
      <p>Abra o catálogo e escolha os primeiros widgets.</p>
      {!editing ? (
        <button
          className="primaryButton"
          onClick={onBeginEditing}
          type="button"
        >
          Personalizar
        </button>
      ) : null}
    </div>
  );
}

export function HomeView({ onOpenRequestTask }) {
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
    let active = true;
    setLoading(true);
    setError("");
    void fetchHomeDashboard()
      .then((payload) => {
        if (active) setDashboard(payload);
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

  function dropWidget(targetId) {
    if (editing && draggingId) {
      setDraftWidgets((current) => moveWidget(current, draggingId, targetId));
    }
    setDraggingId("");
  }

  function resizeWidget(id, size) {
    setDraftWidgets((current) => updateWidgetInstance(current, id, { size }));
  }

  function removeWidget(id) {
    setDraftWidgets((current) =>
      current.filter((instance) => instance.id !== id),
    );
  }

  function configureWidget(definition, instance) {
    setConfiguration({ definition, instance, creating: false });
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
          <HomeHeroActions
            editing={editing}
            loading={loading}
            onAddWidget={() => setCatalogOpen(true)}
            onBeginEditing={beginEditing}
            onCancel={() => setEditing(false)}
            onRefresh={() => void load()}
            onSave={() => void save()}
            saving={saving}
          />
        </div>
      </header>

      {error ? <div className="errorBox">{error}</div> : null}
      <HomeWidgetArea
        catalogById={catalogById}
        dashboard={dashboard}
        draggingId={draggingId}
        editing={editing}
        onBeginEditing={beginEditing}
        onConfigure={configureWidget}
        onDragEnd={() => setDraggingId("")}
        onDragStart={setDraggingId}
        onDrop={dropWidget}
        onOpenRequestTask={onOpenRequestTask}
        onRemove={removeWidget}
        onResize={resizeWidget}
        onSelectRuntime={setMonitoringRuntime}
        widgets={widgets}
      />

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
