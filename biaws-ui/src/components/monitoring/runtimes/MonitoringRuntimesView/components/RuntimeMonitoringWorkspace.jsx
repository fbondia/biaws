import { Activity, ChevronRight, Settings2 } from "lucide-react";
import { useEffect, useState } from "react";

import { buildUrl } from "../../../../../api/client.js";
import { hasPermission } from "../../../../../permissions.js";
import { MonitoringObservation } from "../../../components/MonitoringObservation.jsx";
import { MonitoringStatusBadge } from "../../../components/MonitoringStatusBadge.jsx";
import {
  monitoringCliExample,
  RuntimeMonitoringConfiguration,
  RuntimeMonitoringHistory,
  useRuntimeMonitoring,
} from "../../../runtime/index.js";
import { latestEventForMonitor } from "../../model.js";

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
      <MonitoringObservation
        emptyClassName="monitoringRuntimeEmptyObservation"
        emptyMessage="Este monitor ainda não possui uma observação com dados para exibir."
        event={event}
      />
    </div>
  );
}

export function RuntimeMonitoringWorkspace({ actor, context, workspace }) {
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
          <MonitoringStatusBadge status={runtime.status} />
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
