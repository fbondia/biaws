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
import { useState } from "react";

export function HomeView({ actor, onOpenRequestTask }) {
  const home = useHomeView();
  const [executionTarget, setExecutionTarget] = useState(null);
  const [executionNotice, setExecutionNotice] = useState("");

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
          onClose={() => setExecutionTarget(null)}
          onRequested={({ monitor, result }) => {
            setExecutionNotice(
              result.created
                ? `Execução de “${monitor.name}” solicitada.`
                : `“${monitor.name}” já possuía uma execução pendente.`,
            );
            setExecutionTarget(null);
          }}
          target={executionTarget}
        />
      ) : null}
    </section>
  );
}
