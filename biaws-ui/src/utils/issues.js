export function compactParams(filters, page) {
  return Object.fromEntries(
    Object.entries({
      ...filters,
      page,
    }).filter(([, value]) => value !== ""),
  );
}

export function formatDate(value) {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

export function formatBytes(value) {
  const bytes = Number(value);
  if (!Number.isFinite(bytes) || bytes <= 0) return "-";

  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function issueDate(issue, dateField) {
  return dateField === "updatedAt" ? issue.updatedAt : issue.dates?.[dateField];
}

export function textPreview(value) {
  const text = String(value || "")
    .replace(/\s+/gu, " ")
    .trim();
  if (!text) return "-";
  return text.length > 180 ? `${text.slice(0, 180)}...` : text;
}

export function formatTaxonomyPath(path, maxLength = 56) {
  const labels = (Array.isArray(path) ? path : [])
    .map((label) => String(label || "").trim())
    .filter(Boolean);
  const fullPath = labels.join(" / ");

  if (fullPath.length <= maxLength || labels.length < 3) return fullPath;
  return `${labels[0]} / … / ${labels[labels.length - 1]}`;
}

export function statusClass(status) {
  const normalized = String(status || "").toLowerCase();
  if (normalized === "open") return "statusOpen";
  if (normalized === "closed") return "statusClosed";
  return "statusOther";
}

export function detailValue(value) {
  return value || "-";
}
