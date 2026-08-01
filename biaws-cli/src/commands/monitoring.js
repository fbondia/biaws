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

function printSignal(result) {
  const state = result.created ? "registrado" : "já recebido";
  console.log(
    `Sinal ${state}: runtime ${result.signal.runtimeId} está ${result.signal.status} (${result.signal.source}).`,
  );
}

export async function runMonitoringCommand(api, action, positional, options) {
  const runtimeReference = positional[0];
  if (!runtimeReference) {
    throw new Error("Informe o UUID ou caminho do runtime.");
  }

  if (action === "signal") {
    if (!options.status) throw new Error("Informe --status.");
    if (!options.source) throw new Error("Informe --source.");
    const result = await api.monitoring.signal(runtimeReference, {
      status: options.status,
      source: options.source,
      ...(options["signal-id"] ? { signalId: options["signal-id"] } : {}),
      ...(options["observed-at"] ? { observedAt: options["observed-at"] } : {}),
      ...(options.message ? { message: options.message } : {}),
      metadata: parseMetadata(options.metadata),
    });
    if (options.json) console.log(JSON.stringify(result, null, 2));
    else printSignal(result);
    return result;
  }

  if (action === "signals") {
    const result = await api.monitoring.listSignals(runtimeReference, options);
    if (options.json) console.log(JSON.stringify(result, null, 2));
    else if (!result.items.length) console.log("Nenhum sinal recebido.");
    else {
      for (const signal of result.items) {
        console.log(
          `${signal.observedAt}  ${signal.status.padEnd(11)}  ${signal.source}${signal.message ? `  ${signal.message}` : ""}`,
        );
      }
    }
    return result;
  }

  throw new Error(`Ação de monitoramento desconhecida: ${action || "(vazia)"}`);
}
