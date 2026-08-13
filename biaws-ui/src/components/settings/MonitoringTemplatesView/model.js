export const DEFAULT_TEMPLATE_DEFINITION = Object.freeze({
  rules: [
    {
      label: "Resposta saudável",
      match: "all",
      conditions: [
        { path: "evidence.status_code", operator: "equals", value: 200 },
      ],
      result: {
        status: "healthy",
        message: "Resposta HTTP {{evidence.status_code}}",
        metadata: {},
      },
    },
  ],
  defaultResult: {
    status: "unavailable",
    message: "A evidência não correspondeu às regras esperadas.",
    metadata: {},
  },
});

export const DEFAULT_PREVIEW_SAMPLE = Object.freeze({
  context: { origin: "active", provider: "rest" },
  evidence: { status_code: 200, duration_ms: 35 },
  metadata: {},
});

export function monitoringTemplateDraft(template) {
  return {
    id: template?.id || "",
    name: template?.name || "",
    description: template?.description || "",
    definitionText: JSON.stringify(
      template?.definition || DEFAULT_TEMPLATE_DEFINITION,
      null,
      2,
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

export function monitoringTemplatePayload(draft) {
  const name = String(draft?.name || "").trim();
  if (!name) throw new Error("Informe o nome do template.");
  return {
    name,
    description: String(draft.description || "").trim(),
    definition: parseJson(draft.definitionText, "A definição"),
  };
}

export function monitoringTemplatePreviewPayload(draft, sampleText) {
  return {
    definition: parseJson(draft.definitionText, "A definição"),
    sample: parseJson(sampleText, "A amostra"),
  };
}

export function templateStatusLabel(status) {
  return (
    { active: "Ativo", draft: "Rascunho", inactive: "Inativo" }[status] ||
    status
  );
}
