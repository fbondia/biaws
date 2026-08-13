export const DEFAULT_TEMPLATE_DEFINITION = Object.freeze({
  schemaVersion: "1",
  input: {
    mediaType: "application/json",
    sample: { statusCode: 200, durationMs: 35 },
  },
  transformation: {
    language: "jsonata",
    expression:
      '{"status": statusCode = 200 ? "healthy" : "unavailable", "message": "HTTP " & $string(statusCode), "metadata": {"duration_ms": durationMs}}',
  },
  output: {
    status: {
      type: "string",
      required: true,
      enum: ["healthy", "degraded", "unavailable", "unknown"],
    },
    message: { type: "string", required: false, maxLength: 2000 },
    metadata: {
      type: "object",
      required: true,
      additionalProperties: false,
      fields: [
        {
          key: "duration_ms",
          type: "number",
          required: false,
          minimum: 0,
        },
      ],
    },
  },
  presentation: {
    label: "Resultado do monitoramento",
    fields: [
      {
        key: "duration_ms",
        label: "Duração",
        format: "number",
        visualization: "value",
      },
    ],
    series: [],
  },
});

export const DEFAULT_PREVIEW_SAMPLE = DEFAULT_TEMPLATE_DEFINITION.input.sample;

export function monitoringTemplateDraft(template) {
  const definition =
    template?.definition?.schemaVersion === "1"
      ? template.definition
      : DEFAULT_TEMPLATE_DEFINITION;
  return {
    id: template?.id || "",
    name: template?.name || "",
    description: template?.description || "",
    inputSampleText: JSON.stringify(definition.input.sample, null, 2),
    expression: definition.transformation.expression,
    outputText: JSON.stringify(definition.output, null, 2),
    presentationText: JSON.stringify(definition.presentation, null, 2),
    migratedFromLegacy: Boolean(
      template?.definition && template.definition.schemaVersion !== "1",
    ),
  };
}

function parseJson(text, label) {
  try {
    const value = JSON.parse(text);
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new Error(`${label} deve ser um objeto JSON.`);
    }
    return value;
  } catch (error) {
    if (error.message.startsWith(label)) throw error;
    throw new Error(`${label} contém JSON inválido.`);
  }
}

function parseJsonValue(text, label) {
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`${label} contém JSON inválido.`);
  }
}

export function monitoringTemplatePayload(draft) {
  const name = String(draft?.name || "").trim();
  if (!name) throw new Error("Informe o nome do template.");
  return {
    name,
    description: String(draft.description || "").trim(),
    definition: monitoringTemplateDefinition(draft),
  };
}

function monitoringTemplateDefinition(draft) {
  return {
    schemaVersion: "1",
    input: {
      mediaType: "application/json",
      sample: parseJsonValue(draft.inputSampleText, "A amostra de entrada"),
    },
    transformation: {
      language: "jsonata",
      expression: String(draft.expression || "").trim(),
    },
    output: parseJson(draft.outputText, "O contrato de saída"),
    presentation: parseJson(draft.presentationText, "A apresentação"),
  };
}

export function monitoringTemplatePreviewPayload(draft, sampleText) {
  return {
    definition: monitoringTemplateDefinition(draft),
    sample: parseJsonValue(sampleText, "A amostra"),
  };
}

export function templateStatusLabel(status) {
  return (
    { active: "Ativo", draft: "Rascunho", inactive: "Inativo" }[status] ||
    status
  );
}
