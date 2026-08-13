import {
  EMPTY_ACTIVE_MONITOR_DRAFT,
  EMPTY_OBSERVATION_DRAFT,
} from "../../catalog/CatalogEntityDialog/constants.js";

const text = (value) => String(value ?? "").trim();

function parseObject(value, label) {
  let parsed;
  try {
    parsed = JSON.parse(value || "{}");
  } catch {
    throw new Error(`${label} deve conter JSON válido.`);
  }
  if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") {
    throw new Error(`${label} deve conter um objeto JSON.`);
  }
  return parsed;
}

function parseArray(value, label) {
  let parsed;
  try {
    parsed = JSON.parse(value || "[]");
  } catch {
    throw new Error(`${label} deve conter JSON válido.`);
  }
  if (!Array.isArray(parsed))
    throw new Error(`${label} deve conter uma lista.`);
  return parsed;
}

function parseLines(value) {
  return String(value || "")
    .split("\n")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export function activeMonitorDraft(monitor) {
  if (!monitor) return { ...EMPTY_ACTIVE_MONITOR_DRAFT };
  const configuration = monitor.configuration || {};
  return {
    ...EMPTY_ACTIVE_MONITOR_DRAFT,
    id: monitor.id,
    name: monitor.name || "",
    description: monitor.description || "",
    provider: monitor.provider || "rest",
    enabled: monitor.enabled !== false,
    intervalSeconds: monitor.intervalSeconds ?? 60,
    timeoutSeconds: monitor.timeoutSeconds ?? 10,
    restMethod: configuration.method || "GET",
    restUrl: configuration.url || "",
    restHeadersText: JSON.stringify(configuration.headers || {}, null, 2),
    restHeaderRefsText: JSON.stringify(configuration.headerRefs || [], null, 2),
    restBody: configuration.body || "",
    restExpectedStatusesText: (configuration.expectedStatuses || []).join(", "),
    restFollowRedirects: configuration.followRedirects === true,
    shellScriptId: configuration.scriptId || "",
    shellArgumentsText: (configuration.arguments || []).join("\n"),
    shellEnvironmentText: JSON.stringify(
      configuration.environment || {},
      null,
      2,
    ),
    shellFailureStatus: configuration.failureStatus || "unavailable",
    shellCaptureOutput: configuration.captureOutput || "none",
    templateId: monitor.templateRef?.id || "",
    templateVersion: monitor.templateRef?.version || "",
  };
}

export function activeMonitorPayload(draft) {
  const name = text(draft.name);
  if (!name) throw new Error("Informe o nome do monitoramento.");
  const intervalSeconds = Number(draft.intervalSeconds);
  const timeoutSeconds = Number(draft.timeoutSeconds);
  if (
    !Number.isInteger(intervalSeconds) ||
    intervalSeconds < 10 ||
    intervalSeconds > 86_400
  ) {
    throw new Error("O intervalo deve estar entre 10 e 86400 segundos.");
  }
  if (
    !Number.isInteger(timeoutSeconds) ||
    timeoutSeconds < 1 ||
    timeoutSeconds > Math.min(300, intervalSeconds)
  ) {
    throw new Error(
      "O timeout deve ser inteiro, positivo e não superar o intervalo ou 300 segundos.",
    );
  }
  let configuration;
  if (draft.provider === "rest") {
    const url = text(draft.restUrl);
    let parsedUrl;
    try {
      parsedUrl = new URL(url);
    } catch {
      throw new Error("Informe uma URL REST absoluta válida.");
    }
    if (
      !["http:", "https:"].includes(parsedUrl.protocol) ||
      parsedUrl.username ||
      parsedUrl.password
    ) {
      throw new Error(
        "A URL REST deve usar HTTP(S) e não pode conter credenciais.",
      );
    }
    const method = text(draft.restMethod).toUpperCase();
    if (["GET", "HEAD"].includes(method) && text(draft.restBody)) {
      throw new Error(`${method} não pode enviar corpo.`);
    }
    const expectedStatuses = String(draft.restExpectedStatusesText || "")
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean)
      .map(Number);
    if (
      expectedStatuses.some(
        (status) => !Number.isInteger(status) || status < 100 || status > 599,
      )
    ) {
      throw new Error(
        "Status HTTP esperado deve conter códigos entre 100 e 599.",
      );
    }
    configuration = {
      method,
      url: parsedUrl.toString(),
      headers: parseObject(draft.restHeadersText, "Headers"),
      headerRefs: parseArray(
        draft.restHeaderRefsText,
        "Referências de headers",
      ),
      body: String(draft.restBody || ""),
      followRedirects: draft.restFollowRedirects === true,
      expectedStatuses: [...new Set(expectedStatuses)],
    };
  } else if (draft.provider === "shell") {
    const scriptId = text(draft.shellScriptId);
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/u.test(scriptId)) {
      throw new Error("Informe um identificador de script permitido válido.");
    }
    const failureStatus = draft.shellFailureStatus || "unavailable";
    if (!["unknown", "degraded", "unavailable"].includes(failureStatus)) {
      throw new Error("Estado de falha Shell inválido.");
    }
    const captureOutput = draft.shellCaptureOutput || "none";
    if (!["none", "stdout", "stderr", "both"].includes(captureOutput)) {
      throw new Error("Modo de captura Shell inválido.");
    }
    configuration = {
      scriptId,
      arguments: parseLines(draft.shellArgumentsText),
      environment: parseObject(draft.shellEnvironmentText, "Ambiente"),
      failureStatus,
      captureOutput,
    };
  } else {
    throw new Error("Provider de monitoramento inválido.");
  }
  const templateId = text(draft.templateId);
  const templateVersion = text(draft.templateVersion);
  if (
    draft.provider !== "shell" &&
    Boolean(templateId) !== Boolean(templateVersion)
  ) {
    throw new Error("Informe o identificador e a versão do template juntos.");
  }
  return {
    name,
    description: text(draft.description),
    provider: draft.provider,
    enabled: draft.enabled === true,
    intervalSeconds,
    timeoutSeconds,
    configuration,
    templateRef:
      draft.provider === "shell"
        ? null
        : templateId
          ? { id: templateId, version: templateVersion }
          : null,
  };
}

export function newObservationDraft(now = new Date()) {
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return {
    ...EMPTY_OBSERVATION_DRAFT,
    observedAt: local.toISOString().slice(0, 16),
  };
}

export function monitoringOriginLabel(origin) {
  return (
    {
      active: "Ativo",
      manual: "Manual",
      passive: "Passivo",
      external: "Passivo",
    }[origin] || "Passivo"
  );
}

export function mergeMonitoringEvents(current = [], incoming = []) {
  const events = new Map();
  for (const event of [...current, ...incoming]) events.set(event.id, event);
  return [...events.values()].sort(
    (left, right) =>
      new Date(right.observedAt).getTime() -
      new Date(left.observedAt).getTime(),
  );
}

export function selectableMonitoringTemplates(
  templates = [],
  currentReference = {},
) {
  const currentId = String(currentReference.id || "");
  const currentVersion = String(currentReference.version || "");
  const items = templates
    .map((template) => {
      const versions = (template.versions || []).filter(
        (version) =>
          version.status === "active" ||
          (template.id === currentId &&
            String(version.version) === currentVersion),
      );
      if (
        template.id === currentId &&
        currentVersion &&
        !versions.some(({ version }) => String(version) === currentVersion)
      ) {
        versions.push({ status: "current", version: currentVersion });
      }
      return { ...template, versions };
    })
    .filter(({ versions }) => versions.length);

  if (currentId && !items.some(({ id }) => id === currentId)) {
    items.push({
      id: currentId,
      name: currentId,
      versions: [{ status: "current", version: currentVersion }],
    });
  }
  return items;
}

export function monitoringCliExample({ runtimeReference, workspaceId } = {}) {
  if (!runtimeReference || !workspaceId) return "";
  return [
    "biaws monitoring signal " + runtimeReference + " \\",
    "  --workspace " + workspaceId + " \\",
    "  --status healthy --source external-monitor \\",
    "  --signal-id example:check:1 --metadata '{\"latency_ms\":35}'",
  ].join("\n");
}
