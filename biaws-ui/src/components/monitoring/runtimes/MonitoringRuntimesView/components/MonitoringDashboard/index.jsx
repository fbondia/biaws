import { Activity, LayoutDashboard, X } from "lucide-react";
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  fetchApplicationMonitoringHealth,
  fetchMonitoredRuntimeTargets,
  fetchMonitoringPanelPreference,
  updateMonitoringPanelPreference,
} from "../../../../../../api.js";
import {
  MONITORING_REFRESH_INTERVAL_MS,
  useAutoRefresh,
  useManualExecutionRefresh,
} from "../../../../../../hooks/useAutoRefresh.js";
import "../../../../../../styles/features/home/index.css";
import { RuntimeMonitoringDialog } from "../../../../../home/HomeView/components/RuntimeMonitoringDialog.jsx";
import { ApplicationHealthWidget } from "../../../../../home/widgets/ApplicationHealthWidget.jsx";
import { MonitoringExecutionButton } from "../../../../components/MonitoringActions.jsx";
import {
  canRequestMonitoringExecution,
  MonitoringExecutionDialog,
} from "../../../../runtime/MonitoringExecutionDialog.jsx";
import { activeManualExecutionIds } from "../../../../runtime/model.js";
import { TargetSelector } from "./components/TargetSelector.jsx";
import { runtimeHealthData, selectedMonitoringWidgets } from "./model.js";

export { TargetSelector } from "./components/TargetSelector.jsx";

export const MonitoringDashboard = forwardRef(function MonitoringDashboard(
  { actor, onLoadingChange },
  ref,
) {
  const [targets, setTargets] = useState([]);
  const [widgets, setWidgets] = useState([]);
  const [healthByRuntimeId, setHealthByRuntimeId] = useState({});
  const [selecting, setSelecting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [executionDialog, setExecutionDialog] = useState(null);
  const [historyRuntime, setHistoryRuntime] = useState(null);
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

  async function refreshHealth() {
    await loadHealth(selectedWidgets.map(({ target }) => target));
  }

  useImperativeHandle(ref, () => ({
    configure() {
      setSelecting(true);
    },
    refresh() {
      return load();
    },
  }));

  useEffect(() => {
    onLoadingChange?.(loading);
  }, [loading, onLoadingChange]);

  const scheduleExecutionRefresh = useManualExecutionRefresh(refreshHealth);

  useEffect(() => {
    void load();
  }, []);

  useAutoRefresh(load, {
    enabled: !selecting && !executionDialog && !historyRuntime,
    intervalMs: MONITORING_REFRESH_INTERVAL_MS,
  });

  useEffect(() => {
    const active = activeManualExecutionIds(Object.values(healthByRuntimeId));
    setPendingExecutions((current) => {
      const entries = Object.entries(current).filter(([, executionId]) =>
        active.has(executionId),
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
    scheduleExecutionRefresh();
  }

  return (
    <section className="monitoringPanelView" aria-busy={loading}>
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
                  <MonitoringExecutionButton
                    className="iconButton"
                    disabled={Boolean(pendingExecutions[target.id])}
                    onExecute={setExecutionDialog}
                    runtime={target}
                  />
                ) : null}
              </header>
              <div className="homeWidgetBody">
                {healthByRuntimeId[target.id] ? (
                  <ApplicationHealthWidget
                    config={{ runtimeId: target.id, presentation: "tabs" }}
                    data={healthByRuntimeId[target.id]}
                    onSelectRuntime={setHistoryRuntime}
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
      {historyRuntime ? (
        <RuntimeMonitoringDialog
          onClose={() => setHistoryRuntime(null)}
          runtime={historyRuntime}
        />
      ) : null}
    </section>
  );
});
