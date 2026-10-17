export const VIEW_ROUTES = {
  account: "/account",
  catalog: "/catalog",
  documents: "/documents",
  groups: "/groups",
  home: "/",
  issues: "/issues",
  "option-lists": "/option-lists",
  "monitoring-runtimes": "/operation/monitoring/runtimes",
  "monitoring-templates": "/operation/monitoring/templates",
  publications: "/operation/environment/publications",
  requests: "/requests",
  secrets: "/secrets",
  servers: "/servers",
  skills: "/skills",
  taxonomy: "/taxonomy",
  users: "/users",
  "workspace-admin": "/workspaces",
};
export const VIEW_ENTITIES = {
  catalog: "application",
  documents: "document",
  groups: "group",
  issues: "issue",
  requests: "demand",
  secrets: "secret",
  servers: "server",
  skills: "skill",
  users: "user",
  "workspace-admin": "workspace",
  "option-lists": "option-list",
  "monitoring-templates": "template",
  "monitoring-runtimes": "runtime",
  publications: "deployment",
};
const CHILDREN = {
  components: "component",
  repositories: "repository",
  integrations: "integration",
  deployments: "deployment",
  runtimes: "runtime",
  "topology-diagrams": "topology-diagram",
};
const ALIASES = { "/monitoring-templates": "monitoring-templates", "/operation/monitoring": "monitoring-runtimes" };
const DIRECT_CATALOG_CHILDREN = ["components", "repositories", "integrations", "deployments", "runtimes"];

export function readRoute(location = {}) {
  const path = `/${String(location.pathname || "")
    .split("/")
    .filter(Boolean)
    .join("/")}`;
  const workspaceId = new URLSearchParams(location.search || "").get("workspaceId") || "";
  const empty = { workspaceId, selections: {}, valid: false };
  try {
    const [, collection, encodedReference, ...extra] = path.split("/");
    if (DIRECT_CATALOG_CHILDREN.includes(collection)) {
      const reference = decodeURIComponent(encodedReference || "");
      return reference && reference.length <= 240 && !extra.length
        ? { ...empty, view: "catalog", selections: { [CHILDREN[collection]]: reference }, valid: true }
        : empty;
    }
    const base = Object.entries(VIEW_ROUTES).find(
      ([, prefix]) => path === prefix || (prefix !== "/" && path.startsWith(`${prefix}/`)),
    );
    if (!base) return ALIASES[path] ? { ...empty, view: ALIASES[path], valid: true } : empty;
    const [view, prefix] = base;
    const parts = path.slice(prefix.length).split("/").filter(Boolean).map(decodeURIComponent);
    if (parts.some((part) => !part || part.length > 240)) return { ...empty, view };
    const selections = {};
    if (view === "taxonomy" && parts.length === 2 && ["nodes", "tag-groups"].includes(parts[0])) {
      selections[parts[0] === "nodes" ? "taxonomy-node" : "tag-group"] = parts[1];
    } else if (parts.length) {
      if (!VIEW_ENTITIES[view]) return { ...empty, view };
      selections[VIEW_ENTITIES[view]] = parts[0];
      if (parts.length > 1) {
        if (view === "requests" && parts.length === 3 && parts[1] === "tasks") selections.task = parts[2];
        else if (view === "catalog" && parts.length === 3 && CHILDREN[parts[1]])
          selections[CHILDREN[parts[1]]] = parts[2];
        else return { ...empty, view };
      }
    }
    return { view, workspaceId, selections, valid: true };
  } catch {
    return empty;
  }
}

export function viewUrl(view, workspaceId = "") {
  const path = VIEW_ROUTES[view] || "/";
  return `${path}${workspaceId ? `?${new URLSearchParams({ workspaceId })}` : ""}`;
}

export function entityReference(value) {
  return String(typeof value === "string" ? value : value?.id || value?.skillId || value?._id || "");
}
export function matchesReference(value, reference) {
  return Boolean(
    reference &&
    [entityReference(value), value?.identifier, value?.key, value?.clientCode, value?.code].some(
      (candidate) => String(candidate || "") === reference,
    ),
  );
}

export function entityUrl(type, value, route, workspaceId = route.workspaceId) {
  const reference = entityReference(value);
  const view = route.view;
  const base = VIEW_ROUTES[view] || "/";
  let path = base;
  const encode = encodeURIComponent;
  if (view === "catalog" && type !== "application") {
    const applicationId = value?.applicationId || value?.entity?.applicationId || route.selections.application;
    const collection = Object.keys(CHILDREN).find((key) => CHILDREN[key] === type);
    if (!applicationId) {
      if (reference && DIRECT_CATALOG_CHILDREN.includes(collection)) path = `/${collection}/${encode(reference)}`;
      else if (reference) throw new Error("Aplicação necessária para abrir este recurso.");
    } else {
      path += `/${encode(applicationId)}`;
      if (reference) path += `/${collection}/${encode(reference)}`;
    }
  } else if (type === "task") {
    const demandId = value?.requestId || route.selections.demand;
    if (!demandId) throw new Error("Melhoria necessária para abrir esta tarefa.");
    path += `/${encode(demandId)}`;
    if (reference) path += `/tasks/${encode(reference)}`;
  } else if (view === "taxonomy") {
    if (reference) path += `/${type === "tag-group" ? "tag-groups" : "nodes"}/${encode(reference)}`;
  } else if (reference) path += `/${encode(reference)}`;
  return `${path}${workspaceId ? `?${new URLSearchParams({ workspaceId })}` : ""}`;
}
