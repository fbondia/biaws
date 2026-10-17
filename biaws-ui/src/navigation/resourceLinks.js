import { VIEW_ROUTES } from "./model.js";

const ENTITY_VIEWS = {
  issues: "issues",
  demands: "requests",
  documents: "documents",
  applications: "catalog",
  servers: "servers",
  secrets: "secrets",
  skills: "skills",
  users: "users",
  groups: "groups",
  "option-lists": "option-lists",
};
const CATALOG_CHILDREN = new Set([
  "components",
  "repositories",
  "integrations",
  "deployments",
  "runtimes",
  "topology-diagrams",
]);
const DIRECT_CHILDREN = new Set(["components", "repositories", "integrations", "deployments", "runtimes"]);

// Translate only resources with a navigable UI destination. Do not forward MCP
// query parameters, credentials or fragments into the application's routes.
export function resourceLinkHref(value) {
  try {
    const raw = /^biaws:\/\/workspaces\/([^?#\s<>]+)$/iu.exec(value);
    if (!raw) return null;
    const url = new URL(value);
    if (
      url.protocol !== "biaws:" ||
      url.hostname !== "workspaces" ||
      url.username ||
      url.password ||
      url.port ||
      url.search ||
      url.hash
    )
      return null;
    const segments = raw[1].split("/").map(decodeURIComponent);
    if (
      segments.some(
        (part) => !part || part.length > 240 || /[\u0000-\u001f\u007f]/u.test(part) || part === "." || part === "..",
      )
    )
      return null;
    const [workspaceId, ...parts] = segments;
    const path = resourcePath(parts);
    if (!path) return null;
    return `${path}?${new URLSearchParams({ workspaceId })}`;
  } catch {
    return null;
  }
}

function resourcePath(parts) {
  const encode = encodeURIComponent;
  const [collection, id, child, childId, nested, nestedId] = parts;
  if (!parts.length) return VIEW_ROUTES.home;
  if (Object.hasOwn(ENTITY_VIEWS, collection) && parts.length <= 2)
    return `${VIEW_ROUTES[ENTITY_VIEWS[collection]]}${id ? `/${encode(id)}` : ""}`;
  if (DIRECT_CHILDREN.has(collection) && parts.length === 2) return `/${collection}/${encode(id)}`;
  if (collection === "demands" && child === "tasks" && parts.length === 4)
    return `${VIEW_ROUTES.requests}/${encode(id)}/tasks/${encode(childId)}`;
  if (collection === "applications" && CATALOG_CHILDREN.has(child) && parts.length === 4)
    return `${VIEW_ROUTES.catalog}/${encode(id)}/${child}/${encode(childId)}`;
  if (collection === "applications" && child === "deployments" && nested === "runtimes" && parts.length === 6)
    return `${VIEW_ROUTES.catalog}/${encode(id)}/runtimes/${encode(nestedId)}`;
  if (collection === "applications" && child === "deployments" && nested === "publications" && parts.length === 5)
    return `${VIEW_ROUTES.publications}/${encode(childId)}`;
  if (collection === "monitoring" && id === "templates" && parts.length === 3)
    return `${VIEW_ROUTES["monitoring-templates"]}/${encode(child)}`;
  if (collection === "documents" && child === "content" && parts.length === 3)
    return `${VIEW_ROUTES.documents}/${encode(id)}`;
  if (collection === "taxonomy" && ["nodes", "tag-groups"].includes(id) && parts.length === 3)
    return `${VIEW_ROUTES.taxonomy}/${id}/${encode(child)}`;
  if (collection === "classification-catalog" && parts.length === 1) return VIEW_ROUTES.taxonomy;
  return null;
}
