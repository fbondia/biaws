const demands = Array.from({ length: 102 }, (_, index) => ({
  id: `demand-${index + 1}`,
  clientCode: `BIAWS-${index + 1}`,
  title: index >= 98 ? "Entrega alvo" : "Outra entrega",
  description: "",
  status: "Andamento",
  journeys: [{ month: "2026-09", plannedJourneys: 1, executedJourneys: 0 }],
  estimatedDeliveryDate: "2026-09-20",
  specification: { sections: [] },
}));

async function withApi(
  operation: (calls: URLSearchParams[]) => Promise<void>,
  handler?: (page: number, limit: number) => Record<string, unknown>,
) {
  const original = globalThis.fetch;
  const calls: URLSearchParams[] = [];
  globalThis.fetch = async (url) => {
    const query = new URL(url instanceof Request ? url.url : url).searchParams;
    calls.push(query);
    const page = Number(query.get("page") || 1);
    const limit = Number(query.get("limit") || 25);
    const payload = handler
      ? handler(page, limit)
      : {
          meta: {
            page,
            limit,
            total: demands.length,
            totalPages: Math.ceil(demands.length / limit),
          },
          items: demands.slice((page - 1) * limit, page * limit),
        };
    return new Response(JSON.stringify(payload), {
      status: payload.error ? 403 : 200,
      headers: { "Content-Type": "application/json" },
    });
  };
  try {
    await operation(calls);
  } finally {
    globalThis.fetch = original;
  }
}
export { demands, withApi };
