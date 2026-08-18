import { CliError } from "../core/errors.js";

const SCHEMA_VERSION = "biaws.read.v1";

function queryString(parameters = {}) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(parameters)) {
    if (value === undefined || value === null || value === "") continue;
    query.set(key, String(value));
  }
  return query.size ? `?${query}` : "";
}

function pagination(payload = {}) {
  const meta = payload.meta || {};
  return {
    page: meta.page ?? null,
    limit: meta.limit ?? null,
    total: meta.total ?? meta.count ?? null,
    returned: Array.isArray(payload.items) ? payload.items.length : null,
    truncated: Boolean(meta.truncated),
  };
}

export function readEnvelope(resource, operation, payload, scope = {}) {
  const data = operation === "list" ? payload.items || [] : payload;
  return {
    schemaVersion: SCHEMA_VERSION,
    resource,
    operation,
    scope: {
      workspaceId: scope.workspaceId || null,
      applicationId: scope.applicationId || null,
      requestId: scope.requestId || null,
    },
    pagination: operation === "list" ? pagination(payload) : null,
    data,
  };
}

export function table(items, columns) {
  if (!items.length) return "Nenhum resultado.";
  const rows = [columns.map(([label]) => label)];
  for (const item of items) {
    rows.push(columns.map(([, read]) => String(read(item) ?? "")));
  }
  const widths = rows[0].map((_, index) =>
    Math.max(...rows.map((row) => row[index].length)),
  );
  return rows
    .map((row) =>
      row
        .map((cell, index) => cell.padEnd(widths[index]))
        .join("  ")
        .trimEnd(),
    )
    .join("\n");
}

export function asCliError(error, resource) {
  if (error instanceof CliError) return error;
  const status = error?.statusCode;
  const exitCode =
    status === 404 ? 4 : status === 403 ? 3 : status === 401 ? 2 : 1;
  const code =
    status === 404
      ? "RESOURCE_NOT_FOUND"
      : status === 403
        ? "PERMISSION_DENIED"
        : error?.code || "API_READ_FAILED";
  return new CliError(`${resource}: ${error.message}`, {
    cause: error,
    code,
    exitCode,
  });
}

export class DomainReadService {
  constructor(api) {
    this.api = api;
  }
  workspaces() {
    return this.api.request("/catalog/workspaces");
  }
  workspace(id) {
    return this.api.request(`/catalog/workspaces/${encodeURIComponent(id)}`);
  }
  applications(workspaceId, filters) {
    return this.api.request(
      `/catalog/workspaces/${encodeURIComponent(workspaceId)}/applications${queryString(filters)}`,
    );
  }
  application(id) {
    return this.api.request(`/catalog/applications/${encodeURIComponent(id)}`);
  }
  demands(filters) {
    return this.api.request(`/requests${queryString(filters)}`);
  }
  async demand(id, filters = {}) {
    try {
      return await this.api.request(
        `/requests/${encodeURIComponent(id)}${queryString(filters)}`,
      );
    } catch (error) {
      if (error?.statusCode !== 404) throw error;
      const payload = await this.demands({ ...filters, code: id, limit: 2 });
      const matches = (payload.items || []).filter(
        (item) => String(item.clientCode || "") === String(id),
      );
      if (matches.length === 1) return { request: matches[0] };
      if (matches.length > 1) {
        throw new CliError(`Código de melhoria ambíguo: ${id}.`, {
          code: "AMBIGUOUS_DEMAND_CODE",
          exitCode: 2,
        });
      }
      throw error;
    }
  }
  issues(filters) {
    return this.api.request(`/issues${queryString(filters)}`);
  }
  issue(id) {
    return this.api.request(`/issues/${encodeURIComponent(id)}`);
  }
}
