export function buildServerApplicationGroups({
  applications = [],
  components = [],
  deployments = [],
  runtimes = [],
}) {
  const applicationsById = new Map(
    applications.map((application) => [application.id, application]),
  );
  const componentsById = new Map(
    components.map((component) => [component.id, component]),
  );
  const runtimesByDeployment = runtimes.reduce((groups, runtime) => {
    const current = groups.get(runtime.deploymentId) || [];
    current.push(runtime);
    groups.set(runtime.deploymentId, current);
    return groups;
  }, new Map());
  const grouped = new Map();

  deployments.forEach((deployment) => {
    const application = applicationsById.get(deployment.applicationId);
    const component = componentsById.get(deployment.componentId);
    if (!application || !component) return;

    const applicationGroup = grouped.get(application.id) || {
      id: application.id,
      name: application.name,
      components: new Map(),
    };
    const componentGroup = applicationGroup.components.get(component.id) || {
      id: component.id,
      name: component.name,
      environments: new Set(),
      deploymentCount: 0,
      runtimeCount: 0,
    };
    componentGroup.environments.add(deployment.environment);
    componentGroup.deploymentCount += 1;
    componentGroup.runtimeCount +=
      runtimesByDeployment.get(deployment.id)?.length || 0;
    applicationGroup.components.set(component.id, componentGroup);
    grouped.set(application.id, applicationGroup);
  });

  return [...grouped.values()]
    .map((application) => ({
      ...application,
      components: [...application.components.values()]
        .map((component) => ({
          ...component,
          environments: [...component.environments].sort(),
        }))
        .sort((left, right) => left.name.localeCompare(right.name, "pt-BR")),
    }))
    .sort((left, right) => left.name.localeCompare(right.name, "pt-BR"));
}
