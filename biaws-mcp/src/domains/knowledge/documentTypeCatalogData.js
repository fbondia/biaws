export const DOCUMENT_TYPE_CATALOG = Object.freeze({
  "business-rule": Object.freeze({
    type: "business-rule",
    label: "Regra de negócio",
    description: "Condições e comportamentos esperados do domínio.",
    defaultStatus: "draft",
    statuses: Object.freeze(["draft", "active", "retired", "archived"]),
    currentStatuses: Object.freeze(["active"]),
    applicationRequired: true,
    details: Object.freeze({
      ruleCode: Object.freeze({ type: "string", maxLength: 80 }),
      effectiveFrom: Object.freeze({ type: "date" }),
    }),
  }),
  "architecture-decision": Object.freeze({
    type: "architecture-decision",
    label: "Decisão arquitetural",
    description: "Escolhas técnicas, contexto, alternativas e consequências.",
    defaultStatus: "proposed",
    statuses: Object.freeze([
      "proposed",
      "accepted",
      "rejected",
      "superseded",
      "archived",
    ]),
    currentStatuses: Object.freeze(["accepted"]),
    applicationRequired: true,
    details: Object.freeze({
      decidedAt: Object.freeze({ type: "date" }),
    }),
  }),
  guideline: Object.freeze({
    type: "guideline",
    label: "Guideline",
    description: "Diretrizes e padrões de desenvolvimento.",
    defaultStatus: "draft",
    statuses: Object.freeze(["draft", "published", "deprecated", "archived"]),
    currentStatuses: Object.freeze(["published"]),
    applicationRequired: false,
    details: Object.freeze({
      scope: Object.freeze({
        type: "string",
        enum: Object.freeze(["workspace", "application", "component"]),
        default: "workspace",
      }),
      enforcement: Object.freeze({
        type: "string",
        enum: Object.freeze(["required", "recommended", "informative"]),
        default: "recommended",
      }),
    }),
  }),
  feature: Object.freeze({
    type: "feature",
    label: "Feature",
    description: "Descrição funcional e técnica aprofundada de uma capacidade.",
    defaultStatus: "draft",
    statuses: Object.freeze(["draft", "published", "deprecated", "archived"]),
    currentStatuses: Object.freeze(["published"]),
    applicationRequired: true,
    details: Object.freeze({
      maturity: Object.freeze({
        type: "string",
        enum: Object.freeze(["planned", "beta", "stable", "retired"]),
        default: "stable",
      }),
    }),
  }),
  "technical-reference": Object.freeze({
    type: "technical-reference",
    label: "Referência técnica",
    description: "Arquitetura atual, contratos, schemas e mecanismos.",
    defaultStatus: "draft",
    statuses: Object.freeze(["draft", "published", "deprecated", "archived"]),
    currentStatuses: Object.freeze(["published"]),
    applicationRequired: false,
    details: Object.freeze({
      referenceKind: Object.freeze({
        type: "string",
        enum: Object.freeze([
          "architecture",
          "contract",
          "schema",
          "protocol",
          "mechanism",
        ]),
        default: "architecture",
      }),
    }),
  }),
  procedure: Object.freeze({
    type: "procedure",
    label: "Procedimento",
    description: "Instruções operacionais reutilizáveis.",
    defaultStatus: "draft",
    statuses: Object.freeze(["draft", "published", "deprecated", "archived"]),
    currentStatuses: Object.freeze(["published"]),
    applicationRequired: false,
    details: Object.freeze({}),
  }),
});

export const DOCUMENT_TYPES = Object.freeze(Object.keys(DOCUMENT_TYPE_CATALOG));
