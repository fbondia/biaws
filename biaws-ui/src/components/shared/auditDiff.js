export function formatAuditValue(value) {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Sim" : "Não";
  if (typeof value === "object") return JSON.stringify(value, null, 2);
  return String(value);
}

function numberedLines(type, lines, beforeStart, afterStart) {
  return lines.map((value, index) => ({
    type,
    value,
    beforeLine: type === "added" ? null : beforeStart + index,
    afterLine: type === "removed" ? null : afterStart + index,
  }));
}

export function buildAuditLineDiff(beforeValue, afterValue) {
  const before = formatAuditValue(beforeValue).split("\n");
  const after = formatAuditValue(afterValue).split("\n");

  // Audit values are bounded by the API. Avoid a quadratic matrix for an
  // unusually line-heavy value while still presenting a useful replacement.
  if (before.length * after.length > 40_000) {
    return [
      ...numberedLines("removed", before, 1, 1),
      ...numberedLines("added", after, 1, 1),
    ];
  }

  const lengths = Array.from({ length: before.length + 1 }, () =>
    Array(after.length + 1).fill(0),
  );
  for (let left = before.length - 1; left >= 0; left -= 1) {
    for (let right = after.length - 1; right >= 0; right -= 1) {
      lengths[left][right] =
        before[left] === after[right]
          ? lengths[left + 1][right + 1] + 1
          : Math.max(lengths[left + 1][right], lengths[left][right + 1]);
    }
  }

  const result = [];
  let left = 0;
  let right = 0;
  while (left < before.length || right < after.length) {
    if (
      left < before.length &&
      right < after.length &&
      before[left] === after[right]
    ) {
      result.push({
        type: "equal",
        value: before[left],
        beforeLine: left + 1,
        afterLine: right + 1,
      });
      left += 1;
      right += 1;
    } else if (
      right < after.length &&
      (left === before.length ||
        lengths[left][right + 1] > lengths[left + 1][right])
    ) {
      result.push({
        type: "added",
        value: after[right],
        beforeLine: null,
        afterLine: right + 1,
      });
      right += 1;
    } else {
      result.push({
        type: "removed",
        value: before[left],
        beforeLine: left + 1,
        afterLine: null,
      });
      left += 1;
    }
  }
  return result;
}
