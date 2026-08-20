import "../../../../styles/features/catalog/index.css";
import "../../../../styles/features/monitoring-center.css";

import { MonitoringRuntimesHeader } from "./components/MonitoringRuntimesHeader.jsx";
import { RuntimeNavigation } from "./components/RuntimeNavigation.jsx";
import { MonitoringDashboard } from "./components/MonitoringDashboard/index.jsx";
import { useMonitoringRuntimesView } from "./hooks/useMonitoringRuntimesView.js";

export function MonitoringRuntimesView({ actor }) {
  const controller = useMonitoringRuntimesView(actor);

  return (
    <section className="monitoringCenterPage">
      <MonitoringRuntimesHeader controller={controller} />
      {controller.error ? (
        <div className="errorBox" role="alert">
          {controller.error}
        </div>
      ) : null}
      {controller.viewMode === "dashboard" ? (
        <MonitoringDashboard
          actor={actor}
          onLoadingChange={controller.dashboard.onLoadingChange}
          ref={controller.dashboard.ref}
        />
      ) : (
        <RuntimeNavigation actor={actor} controller={controller} />
      )}
    </section>
  );
}
