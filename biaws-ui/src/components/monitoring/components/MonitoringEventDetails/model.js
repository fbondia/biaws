const NUMBER_FORMAT = new Intl.NumberFormat("pt-BR", {
  maximumFractionDigits: 2,
});
const COMPACT_NUMBER_FORMAT = new Intl.NumberFormat("pt-BR", {
  maximumFractionDigits: 1,
  notation: "compact",
});
const BYTE_FORMAT = new Intl.NumberFormat("pt-BR", {
  maximumFractionDigits: 1,
});

function statusText(value) {
  if (value === true) return "Operacional";
  if (value === false) return "Indisponível";
  return String(value ?? "—").replaceAll("_", " ");
}

export function monitoringStatusTone(value) {
  const normalized =
    typeof value === "string" ? value.trim().toUpperCase() : value;
  if (normalized === true || normalized === "UP") return "healthy";
  if (
    normalized === false ||
    ["DOWN", "OUT_OF_SERVICE", "UNAVAILABLE"].includes(normalized)
  ) {
    return "unavailable";
  }
  return "unknown";
}

function formatBytes(value) {
  const units = ["B", "KiB", "MiB", "GiB", "TiB"];
  let scaled = Number(value);
  let index = 0;
  while (Math.abs(scaled) >= 1024 && index < units.length - 1) {
    scaled /= 1024;
    index += 1;
  }
  return `${BYTE_FORMAT.format(scaled)} ${units[index]}`;
}

function formatFileCount(value) {
  const count = Number(value);
  return `${NUMBER_FORMAT.format(count)} ${count === 1 ? "arquivo" : "arquivos"}`;
}

function formatDate(value) {
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime())
    ? null
    : date.toLocaleDateString("pt-BR", { timeZone: "UTC" });
}

export function formatMonitoringValue(value, format) {
  if (value === undefined || value === null) return "—";
  if (format === "status") return statusText(value);
  if (format === "percent" && Number.isFinite(Number(value))) {
    return `${NUMBER_FORMAT.format(Number(value))}%`;
  }
  if (format === "bytes" && Number.isFinite(Number(value))) {
    return formatBytes(value);
  }
  if (format === "files" && Number.isFinite(Number(value))) {
    return formatFileCount(value);
  }
  if (format === "date") {
    const formatted = formatDate(value);
    if (formatted) return formatted;
  }
  if (typeof value === "number") return NUMBER_FORMAT.format(value);
  return String(value);
}

export function compactMonitoringValue(value, format) {
  if (format === "bytes") return formatMonitoringValue(value, format);
  if (Number.isFinite(Number(value))) {
    return COMPACT_NUMBER_FORMAT.format(Number(value));
  }
  return formatMonitoringValue(value, format);
}

export function monitoringPresentationFields(event) {
  const metadata = event?.metadata || {};
  const fields = event?.metadataPresentation?.fields || [];
  return fields
    .filter(({ key }) => Object.hasOwn(metadata, key))
    .map((field) => ({ ...field, value: metadata[field.key] }));
}

export function monitoringPresentationSeries(event) {
  const metadata = event?.metadata || {};
  const series = event?.metadataPresentation?.series || [];
  return series.flatMap((definition) => {
    const xValues = metadata[definition.xKey];
    const yValues = metadata[definition.yKey];
    if (
      !Array.isArray(xValues) ||
      !Array.isArray(yValues) ||
      xValues.length !== yValues.length ||
      !xValues.length
    ) {
      return [];
    }
    return [
      {
        ...definition,
        yFormat: definition.yFormatKey
          ? metadata[definition.yFormatKey]
          : definition.yFormat,
        data: xValues.map((x, index) => ({ x, y: yValues[index] })),
      },
    ];
  });
}
