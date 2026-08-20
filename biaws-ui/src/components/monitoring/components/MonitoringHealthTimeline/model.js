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

function eventSeriesIdentity(event, monitorNames) {
  if (event.monitorId || event.monitorName) {
    const identity = event.monitorId || event.monitorName;
    const sourceLabel = String(event.source || "").replace(/^[^:]+:/u, "");
    return {
      id: `monitor:${identity}`,
      label:
        event.monitorName ||
        monitorNames.get(String(event.monitorId)) ||
        sourceLabel ||
        `Monitor ${identity}`,
    };
  }
  if (event.origin === "manual") {
    return { id: "origin:manual", label: "Observações manuais" };
  }
  return {
    id: `origin:${event.origin || "passive"}`,
    label: event.origin === "active" ? "Monitor ativo" : "Sinais passivos",
  };
}

export function monitoringHealthStatusLabel(level) {
  return HEALTH_LABELS[Number(level)] || "Desconhecido";
}

export function monitoringHealthTimeline(events = [], monitors = []) {
  const monitorNames = new Map(
    monitors.map((monitor) => [String(monitor.id), monitor.name]),
  );
  const normalizedEvents = events
    .flatMap((event) => {
      const timestamp = new Date(event.observedAt).getTime();
      const level = HEALTH_LEVELS[String(event.status || "").toLowerCase()];
      if (!Number.isFinite(timestamp) || level === undefined) return [];
      return [
        { ...eventSeriesIdentity(event, monitorNames), level, timestamp },
      ];
    })
    .sort((left, right) => left.timestamp - right.timestamp);

  const identities = new Map();
  for (const event of normalizedEvents) {
    if (!identities.has(event.id)) identities.set(event.id, event.label);
  }
  const series = [...identities].map(([id, label], index) => ({
    color: SERIES_COLORS[index % SERIES_COLORS.length],
    id,
    key: `series${index}`,
    label,
  }));
  const keyById = new Map(series.map(({ id, key }) => [id, key]));
  const pointsByTimestamp = new Map();
  for (const event of normalizedEvents) {
    const point = pointsByTimestamp.get(event.timestamp) || {
      timestamp: event.timestamp,
    };
    point[keyById.get(event.id)] = event.level;
    pointsByTimestamp.set(event.timestamp, point);
  }

  return {
    points: [...pointsByTimestamp.values()],
    series,
    statusTicks: HEALTH_LABELS.map((_label, level) => level),
  };
}
