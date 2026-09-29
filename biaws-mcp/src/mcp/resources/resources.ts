import { scalarText } from "../../runtime/text.js";
import type { ReadResourceResult } from "@modelcontextprotocol/server";
import { apiEntitySchema, requireEntity, type ApiEntity, type ApiPayload } from "../../api/apiContracts.js";
import { BiawsError } from "../../runtime/errors.js";
import { fetchBinary, fetchJson } from "../../api/httpClient.js";
import type { ResourceDefinition } from "./resourceCatalog.js";
import { RESOURCE_CATALOG } from "./resourceCatalog.js";

const MAX_RESOURCE_BYTES = 10 * 1024 * 1024;

function resourceError(code: string, message: string, statusCode = 422) {
  return Object.assign(new BiawsError(message), {
    code,
    statusCode,
    retryable: false,
  });
}

function configuredWorkspace() {
  return String(process.env.BIAWS_WORKSPACE_ID || "").trim();
}

function replaceVariables(template: string, values: Record<string, string>) {
  return template.replaceAll(/\{(\w+)\}/gu, (_: string, name: string) => encodeURIComponent(values[name]));
}

function publicTemplate(definition: ResourceDefinition) {
  return {
    uriTemplate: definition.uriTemplate,
    name: definition.uriTemplate.replace("biaws://", ""),
    description: definition.description,
    mimeType: definition.mimeType,
  };
}

export function listResourceTemplates() {
  return { resourceTemplates: RESOURCE_CATALOG.map(publicTemplate) };
}

export function listResources({ cursor }: { cursor?: string } = {}) {
  if (cursor !== undefined) throw resourceError("INVALID_CURSOR", "The resource index has a single page");
  const workspaceId = configuredWorkspace();
  const resources = RESOURCE_CATALOG.filter(({ uriTemplate }) => {
    const names = [...uriTemplate.matchAll(/\{(\w+)\}/gu)].map((match) => match[1]);
    return !names.length || (workspaceId && names.every((name) => name === "workspaceId"));
  }).map((definition) => ({
    uri: replaceVariables(definition.uriTemplate, { workspaceId }),
    name: publicTemplate(definition).name,
    mimeType: definition.mimeType,
    description: definition.description,
  }));
  return { resources };
}

function templateValues(definition: ResourceDefinition, base: string) {
  const names: string[] = [];
  const pattern = definition.uriTemplate
    .split(/(\{\w+\})/u)
    .map((part) => {
      const match = /^\{(\w+)\}$/u.exec(part);
      if (match) {
        names.push(match[1]);
        return "([^/]+)";
      }
      return part.replaceAll(/[.*+?^${}()|[\]\\]/gu, String.raw`\$&`);
    })
    .join("");
  const match = new RegExp(`^${pattern}$`, "u").exec(base);
  if (!match) return null;
  let values;
  try {
    values = Object.fromEntries(names.map((name, index) => [name, decodeURIComponent(match[index + 1])]));
  } catch {
    throw resourceError("INVALID_RESOURCE_URI", "Invalid URI encoding");
  }
  if (
    Object.entries(values).some(
      ([name, value]) =>
        !value ||
        /[\\\u0000-\u001f]/u.test(value) ||
        (value.includes("/") &&
          (name !== "templateId" || value.split("/").some((part) => !part || part === "." || part === ".."))) ||
        value === "." ||
        value === "..",
    )
  ) {
    throw resourceError("INVALID_RESOURCE_URI", "Invalid resource reference");
  }
  return values;
}

function resourceParams(url: URL) {
  const params: Record<string, number> = {};
  for (const [name, value] of url.searchParams) {
    if (
      !["page", "limit"].includes(name) ||
      !/^[1-9]\d*$/u.test(value) ||
      !Number.isSafeInteger(Number(value)) ||
      (name === "limit" && Number(value) > 100) ||
      Object.hasOwn(params, name)
    ) {
      throw resourceError("INVALID_RESOURCE_URI", "Only a positive integer page and limit (1–100) are supported");
    }
    params[name] = Number(value);
  }
  return params;
}

function matchResource(uri: unknown) {
  if (typeof uri !== "string" || uri.split(/[/?#]/u).some((segment) => /^(?:\.|%2e){1,2}$/iu.test(segment))) {
    throw resourceError("INVALID_RESOURCE_URI", "Invalid resource URI path");
  }
  let url;
  try {
    url = new URL(uri);
  } catch {
    throw resourceError("INVALID_RESOURCE_URI", "A valid BIAWS resource URI is required");
  }
  if (
    url.protocol !== "biaws:" ||
    url.hostname !== "workspaces" ||
    url.hash ||
    url.username ||
    url.password ||
    url.port
  ) {
    throw resourceError("INVALID_RESOURCE_URI", "Unsupported BIAWS resource URI");
  }
  const base = `biaws://workspaces${url.pathname}`;
  for (const definition of RESOURCE_CATALOG) {
    const values = templateValues(definition, base);
    if (!values) continue;
    const params = resourceParams(url);
    if (values.workspaceId && (!configuredWorkspace() || values.workspaceId !== configuredWorkspace())) {
      throw resourceError("WORKSPACE_NOT_FOUND", "Resource workspace does not match the configured workspace", 404);
    }
    return { definition, values, params };
  }
  throw resourceError("RESOURCE_NOT_FOUND", "Unknown BIAWS resource", 404);
}

function requireItem(item: ApiEntity | undefined) {
  if (!item) throw resourceError("RESOURCE_NOT_FOUND", "Resource not found", 404);
  return requireEntity(item);
}

async function resolveHierarchy(values: Record<string, string>) {
  if (values.serverId) {
    const server = requireItem((await fetchJson(`/api/catalog/servers/${encodeURIComponent(values.serverId)}`)).server);
    values.serverId = server.id;
  }
  if (!values.applicationId) return;
  const application = requireItem(
    (await fetchJson(`/api/catalog/applications/${encodeURIComponent(values.applicationId)}`)).application,
  );
  values.applicationId = application.id;
  if (values.deploymentId) {
    const deployment = requireItem(
      (
        await fetchJson(`/api/catalog/deployments/${encodeURIComponent(values.deploymentId)}`, {
          applicationId: application.id,
        })
      ).deployment,
    );
    if (deployment.applicationId !== application.id)
      throw resourceError("RESOURCE_NOT_FOUND", "Deployment does not belong to the resource application", 404);
    values.deploymentId = deployment.id;
  }
  if (values.runtimeId) {
    const runtime = requireItem(
      (
        await fetchJson(`/api/catalog/runtimes/${encodeURIComponent(values.runtimeId)}`, {
          applicationId: application.id,
          deploymentId: values.deploymentId,
        })
      ).runtime,
    );
    if (runtime.applicationId !== application.id || runtime.deploymentId !== values.deploymentId)
      throw resourceError("RESOURCE_NOT_FOUND", "Runtime does not belong to the resource deployment", 404);
    values.runtimeId = runtime.id;
  }
}

function canonicalContext(values: Record<string, string>, payload: ApiPayload) {
  const context = payload.context;
  if (context) {
    for (const name of ["issueId", "demandId", "documentId"])
      if (values[name]) values[name] = requireEntity(context).id;
    if (values.taskId && context.taskId) values.taskId = scalarText(context.taskId);
  }
}

function canonicalValues(values: Record<string, string>, payload: ApiPayload) {
  canonicalContext(values, payload);
  for (const [name, key] of Object.entries({
    workspaceId: "workspace",
    issueId: "issue",
    demandId: "request",
    documentId: "document",
    applicationId: "application",
    componentId: "component",
    integrationId: "integration",
    repositoryId: "repository",
    serverId: "server",
    deploymentId: "deployment",
    runtimeId: "runtime",
    secretId: "secret",
    diagramId: "diagram",
    templateId: "template",
  })) {
    if (values[name] && payload[key]) values[name] = requireItem(apiEntitySchema.parse(payload[key])).id;
  }
  if (values.runtimeId && typeof payload.meta?.runtimeId === "string") values.runtimeId = payload.meta.runtimeId;
  if (values.fileId && payload.value?.id) values.fileId = payload.value.id;
  return values;
}

function resourceLink(uri: string, name: string, mimeType = "application/json") {
  return { type: "resource_link" as const, uri, name, mimeType };
}

function childLinks(payload: ApiPayload, definition: ResourceDefinition, values: Record<string, string>) {
  const links = [];
  for (const child of RESOURCE_CATALOG) {
    if (!child.uriTemplate.startsWith(definition.uriTemplate + "/")) continue;
    const remainder = child.uriTemplate.slice(definition.uriTemplate.length + 1);
    if (remainder.includes("/") || remainder.includes("{")) continue;
    links.push(resourceLink(replaceVariables(child.uriTemplate, values), remainder, child.mimeType));
  }
  const childTemplate = RESOURCE_CATALOG.find(
    (child) =>
      child.uriTemplate.startsWith(definition.uriTemplate + "/") &&
      /^\{\w+\}$/u.test(child.uriTemplate.slice(definition.uriTemplate.length + 1)),
  );
  if (childTemplate) links.push(...collectionItemLinks(payload, childTemplate, values));
  return links;
}

function collectionItemLinks(payload: ApiPayload, childTemplate: ResourceDefinition, values: Record<string, string>) {
  const links = [];
  const items =
    payload.items || payload.comments || (payload.resource ? apiEntitySchema.parse(payload.resource).items : undefined);
  if (Array.isArray(items)) {
    const variable = /\{(\w+)\}$/u.exec(childTemplate.uriTemplate)?.[1] || "id";
    for (const item of items) {
      const id = variable === "revision" ? item.revision : item.id || item._id;
      if (id !== undefined && id !== null)
        links.push(
          resourceLink(
            replaceVariables(childTemplate.uriTemplate, {
              ...values,
              [variable]: scalarText(id),
            }),
            item.title || item.name || scalarText(item.filename || id),
            childTemplate.mimeType,
          ),
        );
    }
  }
  return links;
}

function addLinks(
  payload: ApiPayload,
  definition: ResourceDefinition,
  values: Record<string, string>,
  params: Record<string, number> = {},
) {
  const baseUri = replaceVariables(definition.uriTemplate, values);
  const search = new URLSearchParams(Object.entries(params).map(([key, value]) => [key, String(value)])).toString();
  const uri = baseUri + (search ? `?${search}` : "");
  const links = childLinks(payload, definition, values);
  links.push(...relatedLinks(payload, definition, values), ...paginationLinks(payload, baseUri));
  return { ...payload, uri, links };
}

function serverRuntimeLinks(payload: ApiPayload, definition: ResourceDefinition, values: Record<string, string>) {
  const links = [];
  if (definition.uriTemplate.endsWith("/servers/{serverId}/runtimes")) {
    for (const item of payload.items || []) {
      if (item.id && item.applicationId && item.deploymentId)
        links.push(
          resourceLink(
            `biaws://workspaces/${encodeURIComponent(values.workspaceId)}/applications/${encodeURIComponent(item.applicationId)}/deployments/${encodeURIComponent(item.deploymentId)}/runtimes/${encodeURIComponent(item.id)}`,
            item.name || item.id,
          ),
        );
    }
  }
  return links;
}

function serverDeploymentLinks(payload: ApiPayload, definition: ResourceDefinition, values: Record<string, string>) {
  const links = [];
  if (definition.uriTemplate.endsWith("/servers/{serverId}/deployments")) {
    for (const item of payload.items || []) {
      if (item.id && item.applicationId)
        links.push(
          resourceLink(
            `biaws://workspaces/${encodeURIComponent(values.workspaceId)}/applications/${encodeURIComponent(item.applicationId)}/deployments/${encodeURIComponent(item.id)}`,
            item.name || item.id,
          ),
        );
    }
  }
  return links;
}

function documentReferenceLinks(payload: ApiPayload, definition: ResourceDefinition, values: Record<string, string>) {
  const links = [];
  if (definition.uriTemplate.endsWith("/documents/{documentId}/references")) {
    for (const item of payload.items || [])
      if (item.targetDocumentId)
        links.push(
          resourceLink(
            `biaws://workspaces/${encodeURIComponent(values.workspaceId)}/documents/${encodeURIComponent(item.targetDocumentId)}`,
            item.targetDocumentId,
          ),
        );
  }
  return links;
}

function relatedLinks(payload: ApiPayload, definition: ResourceDefinition, values: Record<string, string>) {
  const links = [];
  links.push(
    ...serverRuntimeLinks(payload, definition, values),
    ...serverDeploymentLinks(payload, definition, values),
    ...documentReferenceLinks(payload, definition, values),
  );
  if (payload.issue?.applicationId) {
    links.push(
      resourceLink(
        `biaws://workspaces/${encodeURIComponent(values.workspaceId)}/applications/${encodeURIComponent(payload.issue.applicationId)}/classification-catalog`,
        "Catálogo de classificação da aplicação",
      ),
    );
  }
  return links;
}

function paginationLinks(payload: ApiPayload, baseUri: string) {
  const links = [];
  if (payload.meta?.page && payload.meta?.limit) {
    const { page, limit, total } = payload.meta;
    const totalPages = payload.meta.totalPages || Math.ceil((total || 0) / limit);
    const pageUri = (value: number) => `${baseUri}?page=${value}&limit=${limit}`;
    if (page < totalPages) links.push(resourceLink(pageUri(page + 1), "Página seguinte"));
    if (page > 1) links.push(resourceLink(pageUri(page - 1), "Página anterior"));
  }
  return links;
}

export async function readResource({ uri }: { uri?: string } = {}): Promise<ReadResourceResult> {
  const { definition, values, params } = matchResource(uri);
  const directAncestor = /\/(?:applications\/\{applicationId\}|servers\/\{serverId\})$/u.test(definition.uriTemplate);
  if (!directAncestor) await resolveHierarchy(values);
  const endpoint = new URL(replaceVariables(definition.path, values), "http://resource.invalid");
  const query = {
    ...params,
    ...Object.fromEntries(endpoint.searchParams),
    ...(!directAncestor && values.applicationId ? { applicationId: values.applicationId } : {}),
  };
  if (definition.mimeType !== "application/json") {
    if (definition.path.includes("/attachments/")) {
      const metadata = await fetchJson(endpoint.pathname + "/metadata", query);
      canonicalValues(values, metadata);
    }
    if (definition.mimeType === "text/markdown") {
      const document = requireItem((await fetchJson(endpoint.pathname.replace(/\/content$/u, ""), query)).document);
      values.documentId = document.id;
    }
    const { content, headers } = await fetchBinary(endpoint.pathname, query, {
      maxBytes: MAX_RESOURCE_BYTES,
    });
    const mimeType = headers.get("content-type")?.split(";")[0] || definition.mimeType;
    const entry = {
      uri: replaceVariables(definition.uriTemplate, values),
      mimeType,
    };
    return {
      contents: [
        {
          ...entry,
          ...(mimeType.startsWith("text/") ? { text: content.toString("utf8") } : { blob: content.toString("base64") }),
        },
      ],
    };
  }
  let payload = await fetchJson(endpoint.pathname, query);
  canonicalValues(values, payload);
  // Preserve the API's aggregate endpoints while keeping item resources small.
  if (definition.uriTemplate.endsWith("/issues/{issueId}")) {
    const { attachments, ...issue } = requireItem(payload.issue);
    payload = { issue };
  } else if (definition.uriTemplate.endsWith("/demands/{demandId}")) {
    const { notes, tasks, journeys, checklist, specification, attachments, ...request } = requireItem(payload.request);
    payload = { request };
  }
  if (definition.uriTemplate.endsWith("/tasks/{taskId}") && payload.value) {
    const { notes, ...task } = payload.value;
    payload = { ...payload, value: task };
  }
  const linkedPayload = addLinks(payload, definition, values, params);
  return {
    contents: [
      {
        uri: linkedPayload.uri,
        mimeType: "application/json",
        text: JSON.stringify(linkedPayload, null, 2),
      },
    ],
  };
}
