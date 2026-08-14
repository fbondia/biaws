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
