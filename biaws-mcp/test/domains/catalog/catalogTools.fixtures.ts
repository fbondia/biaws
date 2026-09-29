function jsonResponse(payload: unknown = { ok: true }, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
export { jsonResponse };
