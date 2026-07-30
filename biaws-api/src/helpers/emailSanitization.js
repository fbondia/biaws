const DEFAULT_BODY_RULES = [
  ["mailto", "Links mailto", String.raw`<mailto:.*?@.*?>`, "giu"],
  [
    "public-classification",
    "Classificação pública",
    "Classificado como Público",
    "giu",
  ],
  [
    "removed-images",
    "Avisos de imagem removida",
    String.raw`(?:\[Imagem removida pelo remetente(?:\.[^\]]*)?\]\s*)+`,
    "giu",
  ],
  [
    "social-labelled-links",
    "Links rotulados de redes sociais",
    String.raw`\[(Facebook|Instagram|Twitter|LinkedIn.*?)\]<https?:\/\/[^>]+>`,
    "giu",
  ],
  [
    "social-links",
    "Links de redes sociais",
    String.raw`<https:\/\/(facebook|linkedin|twitter|instagram)\.com.*?>`,
    "giu",
  ],
  [
    "portuguese-confidentiality",
    "Confidencialidade em português",
    String.raw`Esta comunicação contém .*?delete o seu conteúdo\.`,
    "siu",
  ],
  [
    "portuguese-message",
    "Aviso de mensagem em português",
    String.raw`Esta mensagem.*?delete o seu conteúdo\.`,
    "siu",
  ],
  [
    "english-message",
    "Aviso de mensagem em inglês",
    String.raw`This message.*?deleting its contents`,
    "siu",
  ],
];

export const DEFAULT_EMAIL_SANITIZATION_CONFIG = Object.freeze({
  schemaVersion: 1,
  subjectPrefixes: ["FW", "FWD", "RE"],
  bodyRules: DEFAULT_BODY_RULES.map(([id, label, pattern, flags]) => ({
    id,
    label,
    pattern,
    flags,
    enabled: true,
  })),
  threadSeparators: [
    String.raw`De: .+\n(?:Enviada em: .+\n)?.+\n(?:Enviado: .+\n)?(?:Para: .+\n)?(?:Cc: .+\n)?Assunto: .+`,
    String.raw`From: .+\n(?:Sent: .+\n)?(?:To: .+\n)?(?:Cc: .+\n)?Subject: .+`,
  ],
  options: {
    collapseBlankLines: true,
    trimLineEndings: true,
    replaceCidReferences: true,
  },
});

function invalid(message) {
  const error = new Error(`Invalid EML sanitization configuration: ${message}`);
  error.statusCode = 422;
  return error;
}

function normalizedStringList(value, fallback, field) {
  const source = value === undefined ? fallback : value;
  if (!Array.isArray(source)) throw invalid(`${field} must be an array`);
  if (source.length > 100)
    throw invalid(`${field} must contain at most 100 items`);
  return [
    ...new Set(source.map((item) => String(item || "").trim()).filter(Boolean)),
  ];
}

function normalizedFlags(value) {
  const flags = String(value || "").trim();
  if (!/^[gimsu]*$/u.test(flags) || new Set(flags).size !== flags.length) {
    throw invalid(
      "rule flags may contain each of g, i, m, s and u at most once",
    );
  }
  return flags;
}

function normalizedBodyRules(value) {
  const source =
    value === undefined ? DEFAULT_EMAIL_SANITIZATION_CONFIG.bodyRules : value;
  if (!Array.isArray(source)) throw invalid("bodyRules must be an array");
  if (source.length > 100)
    throw invalid("bodyRules must contain at most 100 rules");

  return source.map((rule, index) => {
    const pattern = String(rule?.pattern || "");
    if (!pattern || pattern.length > 4000) {
      throw invalid(
        `bodyRules[${index}].pattern must contain between 1 and 4000 characters`,
      );
    }
    const flags = normalizedFlags(rule?.flags);
    try {
      new RegExp(pattern, flags);
    } catch (error) {
      throw invalid(
        `bodyRules[${index}] contains an invalid regular expression: ${error.message}`,
      );
    }
    return {
      id: String(rule?.id || `rule-${index + 1}`)
        .trim()
        .slice(0, 100),
      label: String(rule?.label || `Regra ${index + 1}`)
        .trim()
        .slice(0, 200),
      pattern,
      flags,
      enabled: rule?.enabled !== false,
    };
  });
}

export function normalizeEmailSanitizationConfig(value = {}) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw invalid("configuration must be an object");
  }
  const defaults = DEFAULT_EMAIL_SANITIZATION_CONFIG;
  const threadSeparators = normalizedStringList(
    value.threadSeparators,
    defaults.threadSeparators,
    "threadSeparators",
  );
  for (const [index, pattern] of threadSeparators.entries()) {
    if (pattern.length > 4000) {
      throw invalid(
        `threadSeparators[${index}] must contain at most 4000 characters`,
      );
    }
    try {
      new RegExp(pattern, "iu");
    } catch (error) {
      throw invalid(
        `threadSeparators[${index}] contains an invalid regular expression: ${error.message}`,
      );
    }
  }

  return {
    schemaVersion: 1,
    subjectPrefixes: normalizedStringList(
      value.subjectPrefixes,
      defaults.subjectPrefixes,
      "subjectPrefixes",
    ),
    bodyRules: normalizedBodyRules(value.bodyRules),
    threadSeparators,
    options: {
      collapseBlankLines: value.options?.collapseBlankLines !== false,
      trimLineEndings: value.options?.trimLineEndings !== false,
      replaceCidReferences: value.options?.replaceCidReferences !== false,
    },
  };
}

export function compileEmailSanitizationConfig(value) {
  const config = normalizeEmailSanitizationConfig(value);
  return {
    ...config,
    bodyRules: config.bodyRules.map((rule) => ({
      ...rule,
      regex: new RegExp(rule.pattern, rule.flags),
    })),
    threadSeparatorRegex: config.threadSeparators.length
      ? new RegExp(
          config.threadSeparators.map((pattern) => `(?:${pattern})`).join("|"),
          "giu",
        )
      : null,
  };
}
