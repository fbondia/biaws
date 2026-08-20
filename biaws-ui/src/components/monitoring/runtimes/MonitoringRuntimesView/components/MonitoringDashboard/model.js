export function selectedMonitoringTargets(targets = [], runtimeIds = []) {
  const selected = new Set(runtimeIds.map(String));
  return targets.filter((target) => selected.has(String(target.id)));
}

export function selectedMonitoringWidgets(targets = [], widgets = []) {
  const byRuntimeId = new Map(
    targets.map((target) => [String(target.id), target]),
  );
  return widgets.flatMap((widget) => {
    const target = byRuntimeId.get(String(widget.runtimeId));
    return target ? [{ target, widget }] : [];
  });
}

export function moveMonitoringWidget(widgets, sourceId, targetId) {
  const sourceIndex = widgets.findIndex(
    ({ runtimeId }) => runtimeId === sourceId,
  );
  const targetIndex = widgets.findIndex(
    ({ runtimeId }) => runtimeId === targetId,
  );
  if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) {
    return widgets;
  }
  const next = [...widgets];
  const [source] = next.splice(sourceIndex, 1);
  next.splice(targetIndex, 0, source);
  return next;
}

export function groupMonitoringTargets(targets = []) {
  const groups = new Map();
  for (const target of targets) {
    const application = target.application || {
      id: target.applicationId,
      name: "Aplicação não encontrada",
    };
    if (!groups.has(application.id)) {
      groups.set(application.id, { application, targets: [] });
    }
    groups.get(application.id).targets.push(target);
  }
  return [...groups.values()];
}

export function runtimeHealthData(healthDetails, runtimeId) {
  const items = [];
  for (const application of healthDetails?.items || []) {
    const components = [];
    for (const component of application.components || []) {
      const deployments = [];
      for (const deployment of component.deployments || []) {
        const runtimes = (deployment.runtimes || []).filter(
          (runtime) => String(runtime.id) === String(runtimeId),
        );
        if (runtimes.length) deployments.push({ ...deployment, runtimes });
      }
      if (deployments.length) components.push({ ...component, deployments });
    }
    if (components.length) items.push({ ...application, components });
  }
  return { kind: "health", items };
}
