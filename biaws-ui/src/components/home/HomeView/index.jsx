import "../../../styles/features/home/index.css";

import { HomeDashboard } from "./components/HomeDashboard.jsx";
import {
  ConfigurationDialog,
  WidgetCatalog,
} from "./components/HomeDialogs.jsx";
import { RuntimeMonitoringDialog } from "./components/RuntimeMonitoringDialog.jsx";
import { useHomeView } from "./hooks/useHomeView.js";
import {
  canRequestMonitoringExecution,
  MonitoringExecutionDialog,
} from "../../monitoring/runtime/MonitoringExecutionDialog.jsx";
import { X } from "lucide-react";
import { useEffect, useState } from "react";

function completedExecutionIds(dashboard) {
  const ids = new Set();
  for (const widget of Object.values(dashboard?.data || {})) {
    for (const application of widget?.items || []) {
      for (const component of application.components || []) {
        for (const deployment of component.deployments || []) {
          for (const runtime of deployment.runtimes || []) {
            if (runtime.latestSignal?.executionId) {
              ids.add(runtime.latestSignal.executionId);
            }
          }
        }
      }
    }
  }
  return ids;
}

export function HomeView({ actor, onOpenRequestTask }) {
  const home = useHomeView();
  const [executionTarget, setExecutionTarget] = useState(null);
  const [executionNotice, setExecutionNotice] = useState("");
  const [pendingExecutions, setPendingExecutions] = useState({});

  useEffect(() => {
    const completed = completedExecutionIds(home.dashboard);
    setPendingExecutions((current) => {
      const entries = Object.entries(current).filter(
        ([, executionId]) => !completed.has(executionId),
      );
      return entries.length === Object.keys(current).length
        ? current
        : Object.fromEntries(entries);
    });
  }, [home.dashboard]);

  if (home.loading && !home.dashboard) {
    return (
      <div className="emptyState homeLoading">
        Carregando sua página inicial…
      </div>
    );
  }
  if (!home.dashboard) {
    return (
      <section className="homePage">
        <div className="errorBox">
          {home.error || "Não foi possível carregar a home."}
        </div>
        <button
          className="primaryButton"
          onClick={() => void home.load()}
          type="button"
        >
          Tentar novamente
        </button>
      </section>
    );
  }

  return (
    <section className="homePage">
      {executionNotice ? (
        <div className="monitoringExecutionNotice" role="status">
          {executionNotice}
          <button
            aria-label="Fechar aviso"
            onClick={() => setExecutionNotice("")}
            type="button"
          >
            <X size={15} />
          </button>
        </div>
      ) : null}
      <HomeDashboard
        {...home}
        onAddWidget={() => home.setCatalogOpen(true)}
        onBeginEditing={home.beginEditing}
        onCancel={() => home.setEditing(false)}
        onConfigure={home.configureWidget}
        onDragEnd={() => home.setDraggingId("")}
        onDragStart={home.setDraggingId}
        onDrop={home.dropWidget}
        onOpenRequestTask={onOpenRequestTask}
        canRequestMonitoringExecution={(runtime) =>
          canRequestMonitoringExecution(actor, runtime.applicationId)
        }
        isMonitoringExecutionPending={(runtime) =>
          Boolean(pendingExecutions[runtime.id])
        }
        onRequestMonitoringExecution={setExecutionTarget}
        onRefresh={() => void home.load()}
        onRemove={home.removeWidget}
        onResize={home.resizeWidget}
        onSave={() => void home.save()}
        onSelectRuntime={home.setMonitoringRuntime}
      />
      {home.catalogOpen ? (
        <WidgetCatalog
          catalog={home.dashboard.catalog}
          onAdd={home.addWidget}
          onClose={() => home.setCatalogOpen(false)}
        />
      ) : null}
      {home.configuration ? (
        <ConfigurationDialog
          applications={home.dashboard.applications || []}
          definition={home.configuration.definition}
          instance={home.configuration.instance}
          onClose={() => home.setConfiguration(null)}
          onConfirm={home.applyConfiguration}
        />
      ) : null}
      {home.monitoringRuntime ? (
        <RuntimeMonitoringDialog
          onClose={() => home.setMonitoringRuntime(null)}
          runtime={home.monitoringRuntime}
        />
      ) : null}
      {executionTarget ? (
        <MonitoringExecutionDialog
          onClose={() => {
            setExecutionTarget(null);
            void home.load();
          }}
          onRequested={({ monitor, result, target }) => {
            setPendingExecutions((current) => ({
              ...current,
              [target.id]: result.execution.id,
            }));
            setExecutionNotice(
              result.created
                ? `Execução de “${monitor.name}” solicitada.`
                : `“${monitor.name}” já possuía uma execução pendente.`,
            );
          }}
          target={executionTarget}
        />
      ) : null}
    </section>
  );
}
