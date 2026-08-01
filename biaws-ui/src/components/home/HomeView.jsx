import {
  Activity,
  BarChart3,
  CheckCircle2,
  CircleAlert,
  ClipboardList,
  GripVertical,
  LayoutDashboard,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Settings2,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { fetchHomeDashboard, updateHomeConfiguration } from "../../api.js";
import {
  createWidgetInstance,
  HOME_WIDGET_SIZES,
  moveWidget,
  updateWidgetInstance,
  widgetTitle,
} from "./homeModel.js";

const ICONS = {
  "issues-period": Activity,
  "open-issues-by-application": BarChart3,
  "open-issues-by-type": BarChart3,
  "pending-tasks": ClipboardList,
  "application-health": CheckCircle2,
};

function formatDate(value) {
  if (!value) return "Sem sinal recebido";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function WidgetContent({ data }) {
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
            <CheckCircle2 size={18} /> <strong>{data.ok}</strong> OK
          </span>
          <span className="homeHealthNok">
            <CircleAlert size={18} /> <strong>{data.nok}</strong> NOK
          </span>
        </div>
        {!data.items?.length ? (
          <div className="homeWidgetEmpty">Nenhuma aplicação monitorada.</div>
        ) : (
          <div className="homeHealthApplications">
            {data.items.map((application) => (
              <article key={application.id}>
                <div>
                  <strong>{application.name}</strong>
                  <small>{formatDate(application.observedAt)}</small>
                </div>
                <span
                  className={`catalogStatus catalogStatus-${application.status}`}
                >
                  {application.status}
                </span>
              </article>
            ))}
          </div>
        )}
      </div>
    );
  }
  return <div className="homeWidgetEmpty">Widget indisponível.</div>;
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
                      <small>{definition.category}</small>
                    </div>
                  </div>
                  {editing ? (
                    <div className="homeWidgetActions">
                      <select
                        aria-label={`Tamanho de ${definition.label}`}
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
                            {size.label}
                          </option>
                        ))}
                      </select>
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
                          <Pencil size={15} />
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
                  <WidgetContent data={dashboard.data[instance.id]} />
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
    </section>
  );
}
