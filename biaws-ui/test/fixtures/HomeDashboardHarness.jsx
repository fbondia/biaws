import { createRoot } from "react-dom/client";

import { HomeDashboard } from "../../src/components/home/HomeView/components/HomeDashboard.jsx";

const noop = () => {};

export function mountEditingHomeDashboard(container) {
  const definition = {
    id: "issues-period",
    category: "Chamados",
    label: "Chamados no período",
    configuration: {
      fields: [{ key: "period", label: "Período", type: "select" }],
    },
  };
  const instance = {
    id: "widget-1",
    widgetId: definition.id,
    size: "medium-2",
    config: { period: "week" },
  };

  const root = createRoot(container);
  root.render(
    <HomeDashboard
      catalogById={new Map([[definition.id, definition]])}
      dashboard={{ data: {} }}
      draggingId=""
      editing
      error=""
      loading={false}
      onAddWidget={noop}
      onBeginEditing={noop}
      onCancel={noop}
      onConfigure={noop}
      onDragEnd={noop}
      onDragStart={noop}
      onDrop={noop}
      onOpenRequestTask={noop}
      onRefresh={noop}
      onRemove={noop}
      onResize={noop}
      onSave={noop}
      onSelectRuntime={noop}
      saving={false}
      widgets={[instance]}
    />,
  );
  return root;
}

export function mountMonitoringHomeDashboard(container, onRequestExecution) {
  const definition = {
    id: "application-health",
    category: "Monitoramento",
    label: "Saúde das aplicações",
    configuration: { fields: [] },
  };
  const instance = {
    id: "health-widget",
    widgetId: definition.id,
    size: "medium-2",
    config: { presentation: "list" },
  };
  const dashboard = {
    data: {
      "health-widget": {
        kind: "health",
        items: [
          {
            id: "application-1",
            name: "Billing",
            status: "healthy",
            components: [
              {
                id: "component-1",
                name: "API",
                deployments: [
                  {
                    id: "deployment-1",
                    name: "Produção",
                    runtimes: [
                      {
                        id: "runtime-1",
                        name: "Principal",
                        status: "healthy",
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
    },
  };
  const root = createRoot(container);
  root.render(
    <HomeDashboard
      canRequestMonitoringExecution={() => true}
      catalogById={new Map([[definition.id, definition]])}
      dashboard={dashboard}
      draggingId=""
      editing={false}
      error=""
      loading={false}
      onAddWidget={noop}
      onBeginEditing={noop}
      onCancel={noop}
      onConfigure={noop}
      onDragEnd={noop}
      onDragStart={noop}
      onDrop={noop}
      onOpenRequestTask={noop}
      onRefresh={noop}
      onRemove={noop}
      onRequestMonitoringExecution={onRequestExecution}
      onResize={noop}
      onSave={noop}
      onSelectRuntime={noop}
      saving={false}
      widgets={[instance]}
    />,
  );
  return root;
}
