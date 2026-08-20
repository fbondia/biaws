const HEALTH_LEVELS = {
  stopped: 0,
  unavailable: 1,
  degraded: 2,
  unknown: 3,
  healthy: 4,
};

const HEALTH_LABELS = [
  "Parado",
  "Indisponível",
  "Degradado",
  "Desconhecido",
  "Saudável",
];

const SERIES_COLORS = [
  "var(--palette-blue-37)",
  "var(--palette-green-23)",
  "var(--palette-orange-10)",
  "var(--palette-purple-08)",
  "var(--palette-red-13)",
  "var(--palette-blue-42)",
];

export function monitoringHealthStatusLabel(level) {
  return HEALTH_LABELS[Number(level)] || "Desconhecido";
}

export function monitoringHealthTimeline(summary = {}, monitors = []) {
  const compactSummary = summary || {};
  const monitorNames = new Map(
    monitors.map((monitor) => [String(monitor.id), monitor.name]),
  );
  const preparedSeries = (compactSummary.series || [])
    .map((item) => ({
      ...item,
      points: (item.points || []).flatMap((point) => {
        const timestamp = new Date(point.observedAt).getTime();
        const level = HEALTH_LEVELS[String(point.status || "").toLowerCase()];
        return Number.isFinite(timestamp) && level !== undefined
          ? [{ ...point, level, timestamp }]
          : [];
      }),
    }))
    .filter((item) => item.points.length);
  const series = preparedSeries.map((item, index) => ({
    color: SERIES_COLORS[index % SERIES_COLORS.length],
    id: item.id,
    key: `series${index}`,
    label:
      (item.monitorId && monitorNames.get(String(item.monitorId))) ||
      item.label,
  }));
  const pointsByTimestamp = new Map();
  preparedSeries.forEach((item, index) => {
    const key = `series${index}`;
    for (const entry of item.points) {
      const point = pointsByTimestamp.get(entry.timestamp) || {
        timestamp: entry.timestamp,
      };
      point[key] = entry.level;
      point[`${key}EventCount`] = entry.eventCount;
      pointsByTimestamp.set(entry.timestamp, point);
    }
  });

  const points = [...pointsByTimestamp.values()].sort(
    (left, right) => left.timestamp - right.timestamp,
  );
  return {
    meta: compactSummary.meta || null,
    points,
    series,
    statusTicks: HEALTH_LABELS.map((_label, level) => level),
  };
}

export function monitoringHealthSummaryCaption(meta) {
  if (!meta) return "Resumo temporal agregado do histórico de monitoramento.";
  const eventLabel = meta.eventCount === 1 ? "evento" : "eventos";
  const pointLabel = meta.pointCount === 1 ? "ponto" : "pontos";
  const summaryLabel = meta.eventCount === 1 ? "resumido" : "resumidos";
  return `${meta.eventCount} ${eventLabel} ${summaryLabel} em ${meta.pointCount} ${pointLabel}, com resolução ${meta.resolution}.`;
}
