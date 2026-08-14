import {
  ChevronDown,
  GripVertical,
  LayoutDashboard,
  Plus,
  RefreshCw,
  Save,
  Settings,
  Settings2,
  Trash2,
} from "lucide-react";

import { HOME_WIDGET_SIZES, widgetSubtitle, widgetTitle } from "../model.js";
import { WidgetContent } from "../../widgets/WidgetContent.jsx";
import { HOME_WIDGET_ICONS } from "../constants.js";

export function HomeDashboard({
  canRequestMonitoringExecution,
  catalogById,
  dashboard,
  draggingId,
  editing,
  error,
  loading,
  onAddWidget,
  onBeginEditing,
  onCancel,
  onConfigure,
  onDragEnd,
  onDragStart,
  onDrop,
  onOpenRequestTask,
  onRequestMonitoringExecution,
  onRefresh,
  onRemove,
  onResize,
  onSave,
  onSelectRuntime,
  saving,
  widgets,
}) {
  return (
    <>
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
            onAddWidget={onAddWidget}
            onBeginEditing={onBeginEditing}
            onCancel={onCancel}
            onRefresh={onRefresh}
            onSave={onSave}
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
        onBeginEditing={onBeginEditing}
        onConfigure={onConfigure}
        onDragEnd={onDragEnd}
        onDragStart={onDragStart}
        onDrop={onDrop}
        onOpenRequestTask={onOpenRequestTask}
        canRequestMonitoringExecution={canRequestMonitoringExecution}
        onRequestMonitoringExecution={onRequestMonitoringExecution}
        onRemove={onRemove}
        onResize={onResize}
        onSelectRuntime={onSelectRuntime}
        widgets={widgets}
      />
    </>
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

function HomeWidgetArea({ editing, onBeginEditing, widgets, ...gridProps }) {
  if (widgets.length)
    return (
      <HomeWidgetGrid {...gridProps} editing={editing} widgets={widgets} />
    );
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

function HomeWidgetCard({
  canRequestMonitoringExecution,
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
  onRequestMonitoringExecution,
  onRemove,
  onResize,
  onSelectRuntime,
}) {
  const Icon = HOME_WIDGET_ICONS[instance.widgetId] || LayoutDashboard;
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
          canRequestMonitoringExecution={canRequestMonitoringExecution}
          config={instance.config}
          data={dashboard.data[instance.id]}
          onOpenRequestTask={onOpenRequestTask}
          onRequestMonitoringExecution={onRequestMonitoringExecution}
          onSelectRuntime={onSelectRuntime}
        />
      </div>
    </article>
  );
}
