import { Pencil, Plus, RefreshCw, Trash2 } from "lucide-react";

import { ActiveMonitorDialog } from "./ActiveMonitorDialog.jsx";
import { MonitorCreationDialog } from "./MonitorCreationDialog.jsx";
import { Feedback, formatDate } from "./support.jsx";

function MonitorCard({
  canUpdate,
  deleting,
  monitor,
  onDelete,
  onEdit,
  onToggle,
}) {
  return (
    <article className="catalogActiveMonitorCard">
      <header>
        <div>
          <strong>{monitor.name}</strong>
          <span
            className={`catalogStatus catalogStatus-${monitor.enabled ? "active" : "archived"}`}
          >
            {monitor.enabled ? "Ativo" : "Inativo"}
          </span>
        </div>
        {canUpdate ? (
          <div className="catalogActiveMonitorActions">
            <button
              aria-label={`Editar ${monitor.name}`}
              className="iconButton"
              onClick={() => onEdit(monitor)}
              type="button"
            >
              <Pencil size={16} />
            </button>
            <button
              className="secondaryButton"
              onClick={() => onToggle(monitor)}
              type="button"
            >
              {monitor.enabled ? "Desativar" : "Ativar"}
            </button>
            <button
              aria-label={`Arquivar ${monitor.name}`}
              className="iconButton dangerIconButton"
              disabled={deleting}
              onClick={() => onDelete(monitor)}
              type="button"
            >
              <Trash2 size={16} />
            </button>
          </div>
        ) : null}
      </header>
      {monitor.description ? <p>{monitor.description}</p> : null}
      <dl>
        <div>
          <dt>Provider</dt>
          <dd>{monitor.provider.toUpperCase()}</dd>
        </div>
        <div>
          <dt>Intervalo</dt>
          <dd>{monitor.intervalSeconds}s</dd>
        </div>
        <div>
          <dt>Timeout</dt>
          <dd>{monitor.timeoutSeconds}s</dd>
        </div>
        <div>
          <dt>Próxima execução</dt>
          <dd>{monitor.enabled ? formatDate(monitor.nextRunAt) : "Pausada"}</dd>
        </div>
        <div>
          <dt>Template</dt>
          <dd>
            {monitor.provider === "shell" && monitor.templateRef
              ? "Legado incompatível — edite para remover"
              : monitor.templateRef
                ? `${monitor.templateRef.id} · ${monitor.templateRef.version}`
                : "Sem template"}
          </dd>
        </div>
        <div>
          <dt>Versão</dt>
          <dd>{monitor.version}</dd>
        </div>
      </dl>
    </article>
  );
}

export function RuntimeMonitoringConfiguration({
  controller,
  draft,
  editing,
  options,
  showRetention = true,
  update,
}) {
  const {
    activeMonitors,
    loadMonitoring,
    monitorDeletingId,
    monitorCreationMode,
    monitorDraft,
    monitorSaving,
    monitoringError,
    monitoringLoading,
    monitoringNotice,
    monitoringTemplates,
    openMonitor,
    removeMonitor,
    saveMonitor,
    setMonitorDraft,
    startMonitorCreation,
    toggleMonitor,
  } = controller;
  const canUpdate = Boolean(options.canUpdateRuntime);
  return (
    <div className="catalogHistorySection catalogWideField">
      <Feedback error={monitoringError} notice={monitoringNotice} />
      {showRetention ? (
        <section className="catalogMonitoringRetentionPanel">
          <div>
            <strong>Retenção do histórico</strong>
            <span>O novo prazo é aplicado ao salvar o runtime.</span>
          </div>
          <label className="field catalogMonitoringRetention">
            <span>Dias</span>
            <input
              disabled={!canUpdate}
              max="3650"
              min="0"
              onChange={(event) =>
                update("monitoringRetentionDays", event.target.value)
              }
              type="number"
              value={draft.monitoringRetentionDays}
            />
            <small>Use 0 para manter sem expiração.</small>
          </label>
        </section>
      ) : null}
      <div className="catalogMonitoringSectionHeader">
        <div>
          <h3>Monitoramentos</h3>
          <span>
            Configure execuções ativas ou consulte como enviar sinais externos.
          </span>
        </div>
        <div>
          <button
            aria-label="Recarregar monitoramentos"
            className="iconButton"
            disabled={monitoringLoading}
            onClick={loadMonitoring}
            type="button"
          >
            <RefreshCw size={16} />
          </button>
          {canUpdate && editing ? (
            <button
              className="primaryButton"
              onClick={startMonitorCreation}
              type="button"
            >
              <Plus size={16} /> Novo monitoramento
            </button>
          ) : null}
        </div>
      </div>
      {!editing ? (
        <div className="catalogHistoryEmpty">
          Salve o runtime antes de configurar monitoramentos.
        </div>
      ) : monitoringLoading && !activeMonitors.length ? (
        <div className="catalogHistoryEmpty" role="status">
          Carregando monitoramentos…
        </div>
      ) : !activeMonitors.length ? (
        <div className="catalogHistoryEmpty">
          Nenhum monitoramento ativo configurado.
        </div>
      ) : (
        <div className="catalogActiveMonitorList">
          {activeMonitors.map((monitor) => (
            <MonitorCard
              canUpdate={canUpdate}
              deleting={monitorDeletingId === monitor.id}
              key={monitor.id}
              monitor={monitor}
              onDelete={removeMonitor}
              onEdit={openMonitor}
              onToggle={toggleMonitor}
            />
          ))}
        </div>
      )}
      {!canUpdate && editing ? (
        <div className="catalogPermissionNotice">
          Você pode consultar a configuração, mas não possui permissão para
          alterá-la.
        </div>
      ) : null}
      {monitorDraft ? (
        <ActiveMonitorDialog
          draft={monitorDraft}
          onChange={setMonitorDraft}
          onClose={controller.closeMonitor}
          onSave={saveMonitor}
          saving={monitorSaving}
          templates={monitoringTemplates}
        />
      ) : null}
      {monitorCreationMode ? (
        <MonitorCreationDialog
          cliExample={controller.cliExample}
          curlExample={controller.curlExample}
          entity={controller.entity}
          mode={monitorCreationMode}
          onBack={controller.showMonitorProviderChoice}
          onChoose={controller.selectMonitorProvider}
          onClose={controller.closeMonitorCreation}
          options={options}
          runtimePath={controller.runtimePath}
          templates={monitoringTemplates}
        />
      ) : null}
    </div>
  );
}
