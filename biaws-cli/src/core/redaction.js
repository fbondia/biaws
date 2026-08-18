const SECRET_KEY_PATTERN =
  /(?:api[-_]?key|authorization|cookie|credential|password|secret|token)/iu;

export function redactText(value, secrets = []) {
  let output = String(value ?? "");
  for (const secret of secrets) {
    const normalized = String(secret ?? "");
    if (normalized) output = output.split(normalized).join("[REDACTED]");
  }
  return output;
}

export function redactValue(value, secrets = [], seen = new WeakSet()) {
  if (typeof value === "string") return redactText(value, secrets);
  if (value === null || typeof value !== "object") return value;
  if (seen.has(value)) return "[CIRCULAR]";
  seen.add(value);
  if (Array.isArray(value)) {
    return value.map((item) => redactValue(item, secrets, seen));
  }
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [
      key,
      SECRET_KEY_PATTERN.test(key)
        ? "[REDACTED]"
        : redactValue(item, secrets, seen),
    ]),
  );
}
