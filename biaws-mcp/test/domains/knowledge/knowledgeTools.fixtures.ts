const { DOCUMENT_TYPE_CATALOG: SHARED_DOCUMENT_TYPE_CATALOG } = await import(
  new URL("../../../../../shared/documentTypes.js", import.meta.url).href
);

function jsonResponse(payload: unknown = { ok: true }, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
export { SHARED_DOCUMENT_TYPE_CATALOG, jsonResponse };
