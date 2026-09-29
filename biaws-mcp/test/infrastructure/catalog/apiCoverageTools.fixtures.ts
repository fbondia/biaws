import { type ApiCall } from "../../helpers/types.js";
const readCases = [
  [
    "audit_events_list",
    { entityType: "demand", entityId: " demand/1 ", limit: 20 },
    "/api/audit/demand/demand%2F1",
    { limit: "20" },
  ],
  [
    "documents_list_revisions",
    { documentId: " doc/1 " },
    "/api/knowledge/documents/doc%2F1/revisions",
    {},
  ],
  [
    "documents_list_observations",
    { documentId: "doc-1" },
    "/api/knowledge/documents/doc-1/observations",
    {},
  ],
  [
    "monitoring_runtime_topology_get",
    {},
    "/api/monitoring/runtime-topology",
    {},
  ],
  [
    "monitoring_runtime_targets_list",
    {},
    "/api/monitoring/runtime-targets",
    {},
  ],
  [
    "monitoring_metadata_profiles_list",
    {},
    "/api/monitoring/metadata-profiles",
    {},
  ],
  [
    "applications_monitoring_health_get",
    { applicationId: " app/1 ", includeConfigured: true },
    "/api/monitoring/applications/app%2F1/health",
    { includeConfigured: "true" },
  ],
  [
    "runtime_monitoring_signals_list",
    {
      runtimeReference: "runtime/1",
      page: 2,
      limit: 10,
      status: "degraded",
      observedFrom: "2026-09-01",
      observedTo: "2026-09-28T10:00:00Z",
    },
    "/api/monitoring/runtimes/runtime%2F1/signals",
    {
      page: "2",
      limit: "10",
      status: "degraded",
      observedFrom: "2026-09-01",
      observedTo: "2026-09-28T10:00:00Z",
    },
  ],
] as const;

async function withApi(
  handler: ((call: ApiCall) => Record<string, unknown>) | null,
  operation: (calls: ApiCall[]) => Promise<void>,
) {
  const original = globalThis.fetch;
  const originalWorkspace = process.env.BIAWS_WORKSPACE_ID;
  process.env.BIAWS_WORKSPACE_ID = "workspace-test";
  const calls: ApiCall[] = [];
  globalThis.fetch = async (url, options = {}) => {
    const call = {
      url: new URL(url instanceof Request ? url.url : url),
      path: new URL(url instanceof Request ? url.url : url).pathname,
      method: options.method || "GET",
      body: options.body ? JSON.parse(String(options.body)) : {},
      headers: new Headers(options.headers),
    };
    calls.push(call);
    const payload = handler ? handler(call) : { items: [{ id: "result" }] };
    return new Response(JSON.stringify(payload), {
      status: payload.error ? 403 : 200,
      headers: { "Content-Type": "application/json" },
    });
  };
  try {
    await operation(calls);
  } finally {
    globalThis.fetch = original;
    if (originalWorkspace === undefined) delete process.env.BIAWS_WORKSPACE_ID;
    else process.env.BIAWS_WORKSPACE_ID = originalWorkspace;
  }
}
export { readCases, withApi };
