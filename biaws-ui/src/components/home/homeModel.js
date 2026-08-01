export const HOME_WIDGET_SIZES = [
  { value: "small", label: "Pequeno" },
  { value: "medium", label: "Médio" },
  { value: "large", label: "Grande" },
];

export function createWidgetInstance(definition, config = {}) {
  return {
    id: crypto.randomUUID(),
    widgetId: definition.id,
    size: definition.defaultSize || "medium",
    config: { ...config },
  };
}

export function moveWidget(widgets, sourceId, targetId) {
  const sourceIndex = widgets.findIndex(({ id }) => id === sourceId);
  const targetIndex = widgets.findIndex(({ id }) => id === targetId);
  if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) {
    return widgets;
  }
  const next = [...widgets];
  const [source] = next.splice(sourceIndex, 1);
  next.splice(targetIndex, 0, source);
  return next;
}

export function updateWidgetInstance(widgets, instanceId, patch) {
  return widgets.map((instance) =>
    instance.id === instanceId ? { ...instance, ...patch } : instance,
  );
}

export function widgetTitle(definition, instance) {
  if (instance.widgetId !== "issues-period") return definition.label;
  return instance.config?.period === "month"
    ? "Chamados no mês"
    : "Chamados na semana";
}
