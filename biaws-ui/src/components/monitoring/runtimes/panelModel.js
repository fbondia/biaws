export function selectedMonitoringTargets(targets = [], runtimeIds = []) {
  const selected = new Set(runtimeIds.map(String));
  return targets.filter((target) => selected.has(String(target.id)));
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
  const items = (healthDetails?.items || [])
    .map((application) => ({
      ...application,
      components: (application.components || [])
        .map((component) => ({
          ...component,
          deployments: (component.deployments || [])
            .map((deployment) => ({
              ...deployment,
              runtimes: (deployment.runtimes || []).filter(
                (runtime) => String(runtime.id) === String(runtimeId),
              ),
            }))
            .filter((deployment) => deployment.runtimes.length),
        }))
        .filter((component) => component.deployments.length),
    }))
    .filter((application) => application.components.length);
  return { kind: "health", items };
}
