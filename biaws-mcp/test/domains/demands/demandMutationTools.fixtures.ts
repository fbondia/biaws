import { type ApiCall } from "../../helpers/types.js";
const demandId = "507f1f77bcf86cd799439011";

const request = {
  id: demandId,
  clientCode: "BIAWS-1",
  title: "Existing",
  startDate: "2026-09-01",
  endDate: "2026-10-31",
  specification: { sections: [{ id: "original", content: "Keep" }] },
  checklist: [{ label: "Original", done: true }],
  notes: [{ id: "note/1", date: "2026-09-10", content: "Old" }],
};

async function withApi(
  operation: (calls: ApiCall[]) => Promise<void>,
  status = 200,
) {
  const originalFetch = globalThis.fetch;
  const calls: ApiCall[] = [];
  globalThis.fetch = async (url, options = {}) => {
    const call = {
      path: new URL(url instanceof Request ? url.url : url).pathname,
      search: new URL(url instanceof Request ? url.url : url).search,
      method: options.method || "GET",
      body: options.body ? JSON.parse(String(options.body)) : {},
    };
    calls.push(call);
    const reading = call.method === "GET";
    return new Response(
      JSON.stringify(
        reading
          ? { request, items: [request] }
          : status === 200
            ? { request }
            : { error: "Denied" },
      ),
      {
        status: reading ? 200 : status,
        headers: { "Content-Type": "application/json" },
      },
    );
  };
  try {
    await operation(calls);
  } finally {
    globalThis.fetch = originalFetch;
  }
}

const newTools = [
  "demands_update",
  "demands_update_specification",
  "demands_update_checklist",
  "demands_update_journeys",
  "demands_update_note",
  "demands_delete_note",
];
export { demandId, newTools, request, withApi };
