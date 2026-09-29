function response(payload: unknown = {}) {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

function taxonomyPayload(taxonomy: unknown) {
  return {
    taxonomy: {
      schemaVersion: 1,
      source: { path: "taxonomy.json" },
      tagGroups: [{ id: "environment", label: "Environment", tags: [] }],
      taxonomy,
    },
  };
}
export { response, taxonomyPayload };
