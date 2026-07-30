function padMonth(value) {
  return String(value).padStart(2, "0");
}

export function monthKeysBetween(startDate, endDate) {
  const start = new Date(`${startDate || ""}T00:00:00Z`);
  const end = new Date(`${endDate || ""}T00:00:00Z`);

  if (
    Number.isNaN(start.getTime()) ||
    Number.isNaN(end.getTime()) ||
    start > end
  ) {
    return [];
  }

  const months = [];
  let cursor = new Date(
    Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1),
  );
  const limit = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), 1));

  while (cursor <= limit) {
    months.push(
      `${cursor.getUTCFullYear()}-${padMonth(cursor.getUTCMonth() + 1)}`,
    );
    cursor = new Date(
      Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1),
    );
  }

  return months;
}

export function formatMonth(monthKey) {
  const [year, month] = String(monthKey || "").split("-");
  if (!year || !month) return monthKey || "-";

  return `${month}/${year}`;
}

export function formatDate(dateValue) {
  if (!dateValue) return "-";

  const [year, month, day] = String(dateValue).split("-");
  if (!year || !month || !day) return dateValue;

  return `${day}/${month}/${year}`;
}

export function scheduleSortValue(dateValue) {
  if (!dateValue) return Number.MAX_SAFE_INTEGER;

  const value = new Date(`${dateValue}T00:00:00Z`).getTime();
  return Number.isNaN(value) ? Number.MAX_SAFE_INTEGER : value;
}
