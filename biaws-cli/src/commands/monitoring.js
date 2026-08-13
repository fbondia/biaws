function parseMetadata(value) {
  if (!value) return {};
  let metadata;
  try {
    metadata = JSON.parse(value);
  } catch {
    throw new Error("--metadata deve conter um objeto JSON válido.");
  }
  if (!metadata || Array.isArray(metadata) || typeof metadata !== "object") {
    throw new Error("--metadata deve conter um objeto JSON.");
  }
  return metadata;
}

function parsePayload(value) {
  if (!value) return undefined;
  try {
    return JSON.parse(value);
  } catch {
    throw new Error("--payload deve conter JSON válido.");
  }
}

function printSignal(result) {
  const state = result.created ? "registrado" : "já recebido";
  console.log(
    `Sinal ${state}: runtime ${result.signal.runtimeId} está ${result.signal.status} (${result.signal.source}).`,
  );
}

function buildSignalPayload(options) {
  if (!options.source) throw new Error("Informe --source.");
  const templateId = options.template;
  const templateVersion = options["template-version"];
  if (Boolean(templateId) !== Boolean(templateVersion)) {
    throw new Error("Informe --template e --template-version juntos.");
  }
  if (!templateId && !options.status) throw new Error("Informe --status.");
  if (templateId && !options.payload) {
    throw new Error("Informe --payload ao usar um template.");
  }
  return {
    ...(options.status ? { status: options.status } : {}),
    source: options.source,
    ...(options["signal-id"] ? { signalId: options["signal-id"] } : {}),
    ...(options["observed-at"] ? { observedAt: options["observed-at"] } : {}),
    ...(options.message ? { message: options.message } : {}),
    ...(options["metadata-profile"]
      ? { metadataProfile: options["metadata-profile"] }
      : {}),
    ...(templateId
      ? { templateRef: { id: templateId, version: templateVersion } }
      : {}),
    metadata: parseMetadata(options.metadata),
    ...(options.payload ? { payload: parsePayload(options.payload) } : {}),
  };
}

function requiredTemplate(options) {
  const templateId = options.template;
  const version = options["template-version"] || options.version;
  if (!templateId) throw new Error("Informe --template.");
  if (!version) throw new Error("Informe --template-version.");
  return { templateId, version };
}

async function describeTemplate(api, _positional, options) {
  const { templateId, version } = requiredTemplate(options);
  const result = await api.monitoring.describeTemplate(templateId, version);
  if (options.json) console.log(JSON.stringify(result, null, 2));
  else {
    const contract = result.contract;
    console.log(
      `${contract.name} v${contract.templateRef.version} (${contract.status})`,
    );
    console.log(`Entrada: ${contract.input.mediaType}`);
    console.log(`Transformação: ${contract.transformation.language}`);
    console.log(`Amostra: ${JSON.stringify(contract.input.sample)}`);
    if (contract.output)
      console.log(`Saída: ${JSON.stringify(contract.output)}`);
  }
  return result;
}

async function validateTemplate(api, _positional, options) {
  const { templateId, version } = requiredTemplate(options);
  if (!options.payload) throw new Error("Informe --payload.");
  const result = await api.monitoring.validateTemplate(
    templateId,
    version,
    parsePayload(options.payload),
  );
  if (options.json) console.log(JSON.stringify(result, null, 2));
  else {
    const validation = result.validation;
    console.log(
      `Payload válido: ${validation.result.status}${validation.result.message ? ` — ${validation.result.message}` : ""}`,
    );
  }
  return result;
}

async function sendSignal(api, runtimeReference, options) {
  const result = await api.monitoring.signal(
    runtimeReference,
    buildSignalPayload(options),
  );
  if (options.json) console.log(JSON.stringify(result, null, 2));
  else printSignal(result);
  return result;
}

function printSignals(result) {
  if (!result.items.length) {
    console.log("Nenhum sinal recebido.");
    return;
  }
  for (const signal of result.items) {
    console.log(
      `${signal.observedAt}  ${signal.status.padEnd(11)}  ${signal.source}${signal.message ? `  ${signal.message}` : ""}`,
    );
  }
}

async function listSignals(api, runtimeReference, options) {
  const result = await api.monitoring.listSignals(runtimeReference, options);
  if (options.json) console.log(JSON.stringify(result, null, 2));
  else printSignals(result);
  return result;
}

const MONITORING_ACTIONS = {
  describe: describeTemplate,
  signal: sendSignal,
  signals: listSignals,
  validate: validateTemplate,
};

export async function runMonitoringCommand(api, action, positional, options) {
  const handler = MONITORING_ACTIONS[action];
  if (!handler)
    throw new Error(
      `Ação de monitoramento desconhecida: ${action || "(vazia)"}`,
    );
  if (["describe", "validate"].includes(action)) {
    return handler(api, positional, options);
  }
  const runtimeReference = positional[0];
  if (!runtimeReference)
    throw new Error("Informe o UUID ou caminho do runtime.");
  return handler(api, runtimeReference, options);
}
