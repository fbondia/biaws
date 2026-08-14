export const HOME_WIDGET_SIZES = [
  { value: "small", label: "Pequeno", shortLabel: "P", columns: 3 },
  { value: "medium-1", label: "Médio 1", shortLabel: "M1", columns: 4 },
  { value: "medium-2", label: "Médio 2", shortLabel: "M2", columns: 6 },
  { value: "large", label: "Grande", shortLabel: "G", columns: 12 },
];

const DEPLOYMENT_ENVIRONMENT_LABELS = {
  development: "Desenvolvimento",
  test: "Teste",
  staging: "Homologação",
  production: "Produção",
  other: "Outro",
};

export function createWidgetInstance(definition, config = {}) {
  return {
    id: crypto.randomUUID(),
    widgetId: definition.id,
    size:
      definition.defaultSize === "medium"
        ? "medium-2"
        : definition.defaultSize || "medium-2",
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

export function mergeHomeMonitoringData(dashboard, payload) {
  if (!dashboard) return dashboard;
  return {
    ...dashboard,
    data: { ...dashboard.data, ...payload.data },
    monitoringGeneratedAt: payload.generatedAt,
  };
}

export function widgetTitle(definition, instance) {
  if (instance.widgetId !== "issues-period") return definition.label;
  return instance.config?.period === "month"
    ? "Chamados no mês"
    : "Chamados na semana";
}

export function widgetSubtitle(definition, instance) {
  const environment = instance.config?.environment;
  if (instance.widgetId !== "application-health" || !environment) {
    return definition.category;
  }
  return `${definition.category} · ${DEPLOYMENT_ENVIRONMENT_LABELS[environment] || environment}`;
}
