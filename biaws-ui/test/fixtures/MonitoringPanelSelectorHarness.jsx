import { createRoot } from "react-dom/client";

import { TargetSelector } from "../../src/components/monitoring/runtimes/MonitoringRuntimesView/components/MonitoringDashboard/index.jsx";

export function mountMonitoringPanelSelector(container) {
  let savedWidgets = null;
  const root = createRoot(container);
  root.render(
    <TargetSelector
      onClose={() => {}}
      onSave={(widgets) => {
        savedWidgets = widgets;
      }}
      saving={false}
      selectedWidgets={[
        { runtimeId: "runtime-1", size: "small" },
        { runtimeId: "runtime-2", size: "medium-2" },
      ]}
      targets={[
        {
          id: "runtime-1",
          name: "API Produção",
          application: { id: "app-1", name: "API" },
          component: { name: "Backend" },
          deployment: { name: "Produção", environment: "production" },
          enabledMonitorCount: 1,
          monitorCount: 1,
          monitorNames: ["Healthcheck"],
        },
        {
          id: "runtime-2",
          name: "Worker Produção",
          application: { id: "app-1", name: "API" },
          component: { name: "Worker" },
          deployment: { name: "Produção", environment: "production" },
          enabledMonitorCount: 1,
          monitorCount: 1,
          monitorNames: ["Fila"],
        },
      ]}
    />,
  );
  return { getSavedWidgets: () => savedWidgets, root };
}
