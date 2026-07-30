const MATCH_FLAGS = "iu";

export const DEFAULT_ISSUE_TYPE_DETECTION = Object.freeze({
  incident: Object.freeze({
    enabled: true,
    subjectPatterns: Object.freeze([
      String.raw`\b(?<code>INC\d{5,})\b`,
      String.raw`\b(?:erro|incidente)\b`,
    ]),
  }),
  request: Object.freeze({
    enabled: true,
    subjectPatterns: Object.freeze([String.raw`\b(?<code>REQ\d{5,})\b`]),
  }),
});

function configuredDetection(item) {
  return item?.metadata?.emlImport || DEFAULT_ISSUE_TYPE_DETECTION[item?.value];
}

function normalizedCode(match) {
  return String(match?.groups?.code || "")
    .trim()
    .toUpperCase();
}

export function detectIssueTypeFromSubject(subject, items = []) {
  let firstMatch = null;
  const candidates = items.length
    ? items
    : Object.entries(DEFAULT_ISSUE_TYPE_DETECTION).map(
        ([value, emlImport], index) => ({
          value,
          active: true,
          order: (index + 1) * 10,
          metadata: { emlImport },
        }),
      );

  for (const item of [...candidates].sort(
    (left, right) => Number(left.order) - Number(right.order),
  )) {
    if (item.active === false) continue;
    const detection = configuredDetection(item);
    if (!detection || detection.enabled === false) continue;

    for (const pattern of detection.subjectPatterns || []) {
      const match = new RegExp(pattern, MATCH_FLAGS).exec(
        String(subject || ""),
      );
      if (!match) continue;
      const result = { type: item.value, code: normalizedCode(match) };
      if (result.code) return result;
      firstMatch ||= result;
    }
  }

  return firstMatch || { type: "", code: "" };
}
