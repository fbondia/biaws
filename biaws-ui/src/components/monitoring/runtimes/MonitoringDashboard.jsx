import {
  Activity,
  CheckSquare2,
  LayoutDashboard,
  RefreshCw,
  Settings2,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import {
  fetchApplicationMonitoringHealth,
  fetchMonitoredRuntimeTargets,
  fetchMonitoringPanelPreference,
  updateMonitoringPanelPreference,
} from "../../../api.js";
import "../../../styles/features/home/index.css";
import { ApplicationHealthWidget } from "../../home/widgets/ApplicationHealthWidget.jsx";
import {
  groupMonitoringTargets,
  runtimeHealthData,
  selectedMonitoringTargets,
} from "./panelModel.js";

function TargetSelector({ onClose, onSave, saving, selectedIds, targets }) {
  const [draftIds, setDraftIds] = useState(() => new Set(selectedIds));
  const groups = groupMonitoringTargets(targets);

  function toggle(runtimeId) {
    setDraftIds((current) => {
      const next = new Set(current);
      if (next.has(runtimeId)) next.delete(runtimeId);
      else next.add(runtimeId);
      return next;
    });
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
          {!groups.length ? (
            <div className="monitoringPanelEmptySelection">
              Nenhum runtime possui monitor ativo configurado.
            </div>
          ) : (
            groups.map(({ application, targets: applicationTargets }) => (
              <section key={application.id}>
                <header>
                  <strong>{application.name}</strong>
                  <small>{applicationTargets.length} disponíveis</small>
                </header>
                <div className="monitoringPanelTargetList">
                  {applicationTargets.map((target) => (
                    <label key={target.id}>
                      <input
                        checked={draftIds.has(target.id)}
                        onChange={() => toggle(target.id)}
                        type="checkbox"
                      />
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
                      <span className="monitoringPanelMonitorCount">
                        {target.enabledMonitorCount}/{target.monitorCount}{" "}
                        ativos
                      </span>
                    </label>
                  ))}
                </div>
              </section>
            ))
          )}
        </div>
        <footer>
          <span>{draftIds.size} selecionados</span>
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
              onClick={() => onSave([...draftIds])}
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

export function MonitoringDashboard({ onOpenTarget }) {
  const [targets, setTargets] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [healthByRuntimeId, setHealthByRuntimeId] = useState({});
  const [selecting, setSelecting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const selectedTargets = useMemo(
    () => selectedMonitoringTargets(targets, selectedIds),
    [selectedIds, targets],
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
    setLoading(true);
    setError("");
    try {
      const [targetPayload, preference] = await Promise.all([
        fetchMonitoredRuntimeTargets(),
        fetchMonitoringPanelPreference(),
      ]);
      const nextTargets = targetPayload.items || [];
      const availableIds = new Set(nextTargets.map(({ id }) => id));
      const nextSelectedIds = (preference.runtimeIds || []).filter((id) =>
        availableIds.has(id),
      );
      setTargets(nextTargets);
      setSelectedIds(nextSelectedIds);
      await loadHealth(selectedMonitoringTargets(nextTargets, nextSelectedIds));
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function saveSelection(runtimeIds) {
    setSaving(true);
    setError("");
    try {
      const preference = await updateMonitoringPanelPreference(runtimeIds);
      setSelectedIds(preference.runtimeIds || []);
      setSelecting(false);
      await loadHealth(selectedMonitoringTargets(targets, runtimeIds));
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setSaving(false);
    }
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
            <Settings2 size={16} /> Selecionar monitoramentos
          </button>
        </div>
      </header>
      {error ? (
        <div className="errorBox" role="alert">
          {error}
        </div>
      ) : null}
      {!loading && !selectedTargets.length ? (
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
      {selectedTargets.length ? (
        <div className="homeWidgetGrid monitoringPanelGrid">
          {selectedTargets.map((target) => (
            <article
              className="homeWidget homeWidget-medium-2 monitoringPanelWidget"
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
          selectedIds={selectedIds}
          targets={targets}
        />
      ) : null}
    </section>
  );
}
