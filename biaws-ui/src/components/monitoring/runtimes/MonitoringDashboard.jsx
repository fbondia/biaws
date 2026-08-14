import {
  Activity,
  CheckSquare2,
  GripVertical,
  LayoutDashboard,
  LoaderCircle,
  Play,
  RefreshCw,
  Settings2,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import {
  fetchApplicationMonitoringHealth,
  fetchMonitoredRuntimeTargets,
  fetchMonitoringPanelPreference,
  updateMonitoringPanelPreference,
} from "../../../api.js";
import {
  MONITORING_REFRESH_INTERVAL_MS,
  useAutoRefresh,
} from "../../../hooks/useAutoRefresh.js";
import "../../../styles/features/home/index.css";
import { HOME_WIDGET_SIZES } from "../../home/HomeView/model.js";
import { ApplicationHealthWidget } from "../../home/widgets/ApplicationHealthWidget.jsx";
import {
  canRequestMonitoringExecution,
  MonitoringExecutionDialog,
} from "../runtime/MonitoringExecutionDialog.jsx";
import {
  groupMonitoringTargets,
  moveMonitoringWidget,
  runtimeHealthData,
  selectedMonitoringWidgets,
} from "./panelModel.js";

export function TargetSelector({
  onClose,
  onSave,
  saving,
  selectedWidgets,
  targets,
}) {
  const [draftWidgets, setDraftWidgets] = useState(() =>
    structuredClone(selectedWidgets),
  );
  const [draggingId, setDraggingId] = useState("");
  const draggingIdRef = useRef("");
  const selectedEntries = selectedMonitoringWidgets(targets, draftWidgets);
  const selectedIds = new Set(draftWidgets.map(({ runtimeId }) => runtimeId));
  const groups = groupMonitoringTargets(
    targets.filter(({ id }) => !selectedIds.has(id)),
  );

  function toggle(runtimeId) {
    setDraftWidgets((current) =>
      current.some((widget) => widget.runtimeId === runtimeId)
        ? current.filter((widget) => widget.runtimeId !== runtimeId)
        : [...current, { runtimeId, size: "medium-2" }],
    );
  }

  function updateSize(runtimeId, size) {
    setDraftWidgets((current) =>
      current.map((widget) =>
        widget.runtimeId === runtimeId ? { ...widget, size } : widget,
      ),
    );
  }

  function dropWidget(targetId) {
    if (draggingIdRef.current) {
      setDraftWidgets((current) =>
        moveMonitoringWidget(current, draggingIdRef.current, targetId),
      );
    }
    draggingIdRef.current = "";
    setDraggingId("");
  }

  function finishDragging() {
    draggingIdRef.current = "";
    setDraggingId("");
  }

  function beginDragging(runtimeId) {
    draggingIdRef.current = runtimeId;
    setDraggingId(runtimeId);
  }

  function targetIdentity(target) {
    return (
      <span>
        <strong>{target.name}</strong>
        <small>
          {target.component?.name} · {target.deployment?.name}
          {target.deployment?.environment
            ? ` · ${target.deployment.environment}`
            : ""}
        </small>
        <small>{target.monitorNames.join(" · ")}</small>
      </span>
    );
  }

  return (
    <div className="dialogBackdrop" role="presentation">
      <section
        aria-labelledby="monitoring-panel-selector-title"
        aria-modal="true"
        className="monitoringPanelSelector"
        role="dialog"
      >
        <header>
          <div>
            <span>Painel de monitoramento</span>
            <h2 id="monitoring-panel-selector-title">Selecionar runtimes</h2>
          </div>
          <button
            aria-label="Fechar"
            className="iconButton"
            disabled={saving}
            onClick={onClose}
            type="button"
          >
            <X size={18} />
          </button>
        </header>
        <div className="monitoringPanelSelectorBody">
          {!targets.length ? (
            <div className="monitoringPanelEmptySelection">
              Nenhum runtime possui monitor ativo configurado.
            </div>
          ) : (
            <>
              {selectedEntries.length ? (
                <section>
                  <header>
                    <strong>Widgets selecionados</strong>
                    <small>Arraste para definir a ordem no painel</small>
                  </header>
                  <div className="monitoringPanelTargetList">
                    {selectedEntries.map(({ target, widget }) => (
                      <div
                        className={`monitoringPanelTarget monitoringPanelSelectedTarget${draggingId === target.id ? " isDragging" : ""}`}
                        key={target.id}
                        onDragOver={(event) => event.preventDefault()}
                        onDrop={() => dropWidget(target.id)}
                      >
                        <span
                          aria-label={`Reordenar ${target.name}`}
                          className="monitoringPanelDragHandle"
                          draggable
                          onDragEnd={finishDragging}
                          onDragStart={() => beginDragging(target.id)}
                          role="img"
                        >
                          <GripVertical size={17} />
                        </span>
                        <label>
                          <input
                            checked
                            onChange={() => toggle(target.id)}
                            type="checkbox"
                          />
                          {targetIdentity(target)}
                        </label>
                        <div className="monitoringPanelTargetActions">
                          <span className="monitoringPanelMonitorCount">
                            {target.enabledMonitorCount}/{target.monitorCount}{" "}
                            ativos
                          </span>
                          <label className="field monitoringPanelSizeField">
                            <span>Tamanho</span>
                            <select
                              aria-label={`Tamanho de ${target.name}`}
                              onChange={(event) =>
                                updateSize(target.id, event.target.value)
                              }
                              value={widget.size}
                            >
                              {HOME_WIDGET_SIZES.map((size) => (
                                <option key={size.value} value={size.value}>
                                  {size.label}
                                </option>
                              ))}
                            </select>
                          </label>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              ) : null}
              {groups.map(({ application, targets: applicationTargets }) => (
                <section key={application.id}>
                  <header>
                    <strong>{application.name}</strong>
                    <small>{applicationTargets.length} disponíveis</small>
                  </header>
                  <div className="monitoringPanelTargetList">
                    {applicationTargets.map((target) => (
                      <div className="monitoringPanelTarget" key={target.id}>
                        <label>
                          <input
                            checked={false}
                            onChange={() => toggle(target.id)}
                            type="checkbox"
                          />
                          {targetIdentity(target)}
                        </label>
                        <span className="monitoringPanelMonitorCount">
                          {target.enabledMonitorCount}/{target.monitorCount}{" "}
                          ativos
                        </span>
                      </div>
                    ))}
                  </div>
                </section>
              ))}
            </>
          )}
        </div>
        <footer>
          <span>{draftWidgets.length} selecionados</span>
          <div>
            <button
              className="secondaryButton"
              disabled={saving}
              onClick={onClose}
              type="button"
            >
              Cancelar
            </button>
            <button
              className="primaryButton"
              disabled={saving}
              onClick={() => onSave(draftWidgets)}
              type="button"
            >
              <CheckSquare2 size={16} />
              {saving ? "Salvando…" : "Aplicar seleção"}
            </button>
          </div>
        </footer>
      </section>
    </div>
  );
}

export function MonitoringDashboard({ actor, onOpenTarget }) {
  const [targets, setTargets] = useState([]);
  const [widgets, setWidgets] = useState([]);
  const [healthByRuntimeId, setHealthByRuntimeId] = useState({});
  const [selecting, setSelecting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [executionDialog, setExecutionDialog] = useState(null);
  const [pendingExecutions, setPendingExecutions] = useState({});
  const loadPromiseRef = useRef(null);
  const selectedWidgets = useMemo(
    () => selectedMonitoringWidgets(targets, widgets),
    [targets, widgets],
  );

  async function loadHealth(nextTargets) {
    const applicationIds = [
      ...new Set(nextTargets.map(({ applicationId }) => applicationId)),
    ];
    const entries = await Promise.all(
      applicationIds.map(async (applicationId) => {
        const payload = await fetchApplicationMonitoringHealth(applicationId, {
          includeConfigured: true,
        });
        return [applicationId, payload.health.details];
      }),
    );
    const byApplicationId = new Map(entries);
    setHealthByRuntimeId(
      Object.fromEntries(
        nextTargets.map((target) => [
          target.id,
          runtimeHealthData(
            byApplicationId.get(target.applicationId),
            target.id,
          ),
        ]),
      ),
    );
  }

  async function load() {
    if (loadPromiseRef.current) return loadPromiseRef.current;
    setLoading(true);
    setError("");
    const promise = (async () => {
      try {
        const [targetPayload, preference] = await Promise.all([
          fetchMonitoredRuntimeTargets(),
          fetchMonitoringPanelPreference(),
        ]);
        const nextTargets = targetPayload.items || [];
        const availableIds = new Set(nextTargets.map(({ id }) => id));
        const nextWidgets = (
          preference.widgets ||
          (preference.runtimeIds || []).map((runtimeId) => ({
            runtimeId,
            size: "medium-2",
          }))
        ).filter(({ runtimeId }) => availableIds.has(runtimeId));
        setTargets(nextTargets);
        setWidgets(nextWidgets);
        await loadHealth(
          selectedMonitoringWidgets(nextTargets, nextWidgets).map(
            ({ target }) => target,
          ),
        );
      } catch (loadError) {
        setError(loadError.message);
      } finally {
        loadPromiseRef.current = null;
        setLoading(false);
      }
    })();
    loadPromiseRef.current = promise;
    return promise;
  }

  useEffect(() => {
    void load();
  }, []);

  useAutoRefresh(load, {
    enabled: !selecting && !executionDialog,
    intervalMs: MONITORING_REFRESH_INTERVAL_MS,
  });

  useEffect(() => {
    const completed = new Set(
      Object.values(healthByRuntimeId).flatMap((health) =>
        (health?.items || []).flatMap((application) =>
          (application.components || []).flatMap((component) =>
            (component.deployments || []).flatMap((deployment) =>
              (deployment.runtimes || [])
                .map((runtime) => runtime.latestSignal?.executionId)
                .filter(Boolean),
            ),
          ),
        ),
      ),
    );
    setPendingExecutions((current) => {
      const entries = Object.entries(current).filter(
        ([, executionId]) => !completed.has(executionId),
      );
      return entries.length === Object.keys(current).length
        ? current
        : Object.fromEntries(entries);
    });
  }, [healthByRuntimeId]);

  async function saveSelection(nextWidgets) {
    setSaving(true);
    setError("");
    try {
      const preference = await updateMonitoringPanelPreference(nextWidgets);
      const savedWidgets = preference.widgets || nextWidgets;
      setWidgets(savedWidgets);
      setSelecting(false);
      await loadHealth(
        selectedMonitoringWidgets(targets, savedWidgets).map(
          ({ target }) => target,
        ),
      );
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setSaving(false);
    }
  }

  function executionRequested({ monitor, result, target }) {
    setPendingExecutions((current) => ({
      ...current,
      [target.id]: result.execution.id,
    }));
    setNotice(
      result.created
        ? `Execução de “${monitor.name}” solicitada.`
        : `“${monitor.name}” já possuía uma execução pendente.`,
    );
  }

  return (
    <section className="monitoringPanelView" aria-busy={loading}>
      <header className="monitoringPanelToolbar">
        <div>
          <h2>Meu painel</h2>
          <p>Acompanhe os runtimes que importam para sua operação.</p>
        </div>
        <div>
          <button
            aria-label="Atualizar painel"
            className="iconButton"
            disabled={loading}
            onClick={load}
            type="button"
          >
            <RefreshCw className={loading ? "spinIcon" : undefined} size={17} />
          </button>
          <button
            className="primaryButton"
            disabled={loading}
            onClick={() => setSelecting(true)}
            type="button"
          >
            <Settings2 size={16} /> Configurar painel
          </button>
        </div>
      </header>
      {error ? (
        <div className="errorBox" role="alert">
          {error}
        </div>
      ) : null}
      {notice ? (
        <div className="monitoringExecutionNotice" role="status">
          {notice}
          <button
            aria-label="Fechar aviso"
            onClick={() => setNotice("")}
            type="button"
          >
            <X size={15} />
          </button>
        </div>
      ) : null}
      {!loading && !selectedWidgets.length ? (
        <div className="monitoringPanelEmpty">
          <LayoutDashboard size={34} />
          <strong>Seu painel está vazio</strong>
          <span>Selecione os runtimes que deseja acompanhar aqui.</span>
          <button
            className="primaryButton"
            onClick={() => setSelecting(true)}
            type="button"
          >
            Selecionar monitoramentos
          </button>
        </div>
      ) : null}
      {selectedWidgets.length ? (
        <div className="homeWidgetGrid monitoringPanelGrid">
          {selectedWidgets.map(({ target, widget }) => (
            <article
              className={`homeWidget homeWidget-${widget.size} monitoringPanelWidget`}
              key={target.id}
            >
              <header>
                <div className="homeWidgetHeading">
                  <span>
                    <Activity size={17} />
                  </span>
                  <div>
                    <h2>{target.name}</h2>
                    <small>
                      {target.application?.name} · {target.component?.name} ·{" "}
                      {target.deployment?.name}
                    </small>
                  </div>
                </div>
                {canRequestMonitoringExecution(actor, target.applicationId) ? (
                  <button
                    aria-label={`Executar monitor de ${target.name}`}
                    className="iconButton"
                    disabled={Boolean(pendingExecutions[target.id])}
                    onClick={() => setExecutionDialog(target)}
                    title="Executar monitor agora"
                    type="button"
                  >
                    {pendingExecutions[target.id] ? (
                      <LoaderCircle className="spinIcon" size={16} />
                    ) : (
                      <Play size={16} />
                    )}
                  </button>
                ) : null}
              </header>
              <div className="homeWidgetBody">
                {healthByRuntimeId[target.id] ? (
                  <ApplicationHealthWidget
                    config={{ runtimeId: target.id, presentation: "tabs" }}
                    data={healthByRuntimeId[target.id]}
                    onSelectRuntime={() => onOpenTarget(target)}
                  />
                ) : (
                  <div className="homeWidgetPending">Carregando saúde…</div>
                )}
              </div>
            </article>
          ))}
        </div>
      ) : null}
      {selecting ? (
        <TargetSelector
          onClose={() => setSelecting(false)}
          onSave={saveSelection}
          saving={saving}
          selectedWidgets={widgets}
          targets={targets}
        />
      ) : null}
      {executionDialog ? (
        <MonitoringExecutionDialog
          onClose={() => {
            setExecutionDialog(null);
            void load();
          }}
          onRequested={executionRequested}
          target={executionDialog}
        />
      ) : null}
    </section>
  );
}
