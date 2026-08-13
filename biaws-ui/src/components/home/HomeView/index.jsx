import "../../../styles/features/home/index.css";

import { HomeDashboard } from "./components/HomeDashboard.jsx";
import {
  ConfigurationDialog,
  WidgetCatalog,
} from "./components/HomeDialogs.jsx";
import { RuntimeMonitoringDialog } from "./components/RuntimeMonitoringDialog.jsx";
import { useHomeView } from "./hooks/useHomeView.js";

export function HomeView({ onOpenRequestTask }) {
  const home = useHomeView();

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
    </section>
  );
}
