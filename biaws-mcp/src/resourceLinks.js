function link(uri, item, mimeType = "application/json") {
  return {
    type: "resource_link",
    uri,
    name: item.title || item.name || item.identifier || item.id,
    mimeType,
  };
}

export function resourceLinksForTool(tool, result) {
  const workspaceId = String(process.env.BIAWS_WORKSPACE_ID || "").trim();
  if (!workspaceId) return [];
  const W = `biaws://workspaces/${encodeURIComponent(workspaceId)}`;
  const encode = encodeURIComponent;
  const paths = {
    issue: (item) => `${W}/issues/${encode(item.id)}`,
    request: (item) => `${W}/demands/${encode(item.id)}`,
    document: (item) => `${W}/documents/${encode(item.id)}`,
    application: (item) => `${W}/applications/${encode(item.id)}`,
    server: (item) => `${W}/servers/${encode(item.id)}`,
    secret: (item) => `${W}/secrets/${encode(item.id)}`,
    component: (item) =>
      `${W}/applications/${encode(item.applicationId)}/components/${encode(item.id)}`,
    integration: (item) =>
      `${W}/applications/${encode(item.applicationId)}/integrations/${encode(item.id)}`,
    repository: (item) =>
      `${W}/applications/${encode(item.applicationId)}/repositories/${encode(item.id)}`,
    deployment: (item) =>
      `${W}/applications/${encode(item.applicationId)}/deployments/${encode(item.id)}`,
    runtime: (item) =>
      `${W}/applications/${encode(item.applicationId)}/deployments/${encode(item.deploymentId)}/runtimes/${encode(item.id)}`,
  };
  const links = [];
  for (const [key, path] of Object.entries(paths)) {
    if (result?.[key]?.id) links.push(link(path(result[key]), result[key]));
  }
  const domain = {
    issues: "issue",
    demands: "request",
    documents: "document",
    applications: "application",
    components: "component",
    integrations: "integration",
    repositories: "repository",
    servers: "server",
    deployments: "deployment",
    runtimes: "runtime",
    secrets: "secret",
  }[tool?.split("_")[0]];
  // Only link collections whose items are entities, rather than summaries or history.
  if (domain && /_(?:search|list|by_taxonomy)$/u.test(tool)) {
    for (const item of result?.items || [])
      if (item.id) links.push(link(paths[domain](item), item));
  }
  if (tool === "knowledge_context_load") {
    for (const item of result?.documents || [])
      if (item?.id) links.push(link(paths.document(item), item));
  }
  return links.filter((item) => !item.uri.includes("undefined"));
}
