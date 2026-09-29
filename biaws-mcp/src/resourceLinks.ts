import type { ResourceLink } from "@modelcontextprotocol/server";
import { apiEntitySchema, type ApiEntity } from "./apiContracts.js";
import { isRecord } from "./errors.js";

function link(uri: string, item: ApiEntity): ResourceLink {
  return {
    type: "resource_link",
    uri,
    name: item.title || item.name || item.identifier || item.id || uri,
    mimeType: "application/json",
  };
}
export function resourceLinksForTool(
  tool: string,
  value: unknown,
): ResourceLink[] {
  const workspaceId = String(process.env.BIAWS_WORKSPACE_ID || "").trim();
  if (!workspaceId) return [];
  if (!isRecord(value)) return [];
  const result = value;
  const W = `biaws://workspaces/${encodeURIComponent(workspaceId)}`;
  const encode = (value: unknown) => encodeURIComponent(String(value));
  const paths: Record<string, (item: ApiEntity) => string> = {
    template: (item) => `${W}/monitoring/templates/${encode(item.id)}`,
    issue: (item) => `${W}/issues/${encode(item.id)}`,
    request: (item) => `${W}/demands/${encode(item.id)}`,
    document: (item) => `${W}/documents/${encode(item.id)}`,
    application: (item) => `${W}/applications/${encode(item.id)}`,
    server: (item) => `${W}/servers/${encode(item.id)}`,
    secret: (item) => `${W}/secrets/${encode(item.id)}`,
    component: (item) => `${W}/components/${encode(item.id)}`,
    integration: (item) => `${W}/integrations/${encode(item.id)}`,
    repository: (item) => `${W}/repositories/${encode(item.id)}`,
    deployment: (item) => `${W}/deployments/${encode(item.id)}`,
    runtime: (item) => `${W}/runtimes/${encode(item.id)}`,
  };
  const links: ResourceLink[] = [];
  for (const [key, path] of Object.entries(paths)) {
    const item =
      result[key] === undefined
        ? undefined
        : apiEntitySchema.parse(result[key]);
    if (item?.id) links.push(link(path(item), item));
  }
  if (tool === "monitoring_templates_list") {
    for (const item of Array.isArray(result.items) ? result.items : []) {
      const entity = apiEntitySchema.parse(item);
      if (entity.id) links.push(link(paths.template(entity), entity));
    }
  }
  const domain = (
    {
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
    } as Record<string, string>
  )[tool.split("_")[0]];
  if (domain && /_(?:search|list|by_taxonomy)$/u.test(tool)) {
    if (Array.isArray(result.items))
      for (const value of result.items) {
        const item = apiEntitySchema.parse(value);
        if (item.id) links.push(link(paths[domain](item), item));
      }
  }
  if (tool === "knowledge_context_load" && Array.isArray(result.documents)) {
    for (const value of result.documents) {
      const item = apiEntitySchema.parse(value);
      if (item.id) links.push(link(paths.document(item), item));
    }
  }
  return links.filter((item) => !item.uri.includes("undefined"));
}
