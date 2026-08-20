import {
  activateMonitoringTemplate,
  archiveMonitoringTemplate,
  archiveRuntimeActiveMonitor,
  createMonitoringTemplate,
  createMonitoringTemplateVersion,
  createRuntimeActiveMonitor,
  deactivateMonitoringTemplate,
  getMonitoringTemplate,
  getMonitoringTemplateContract,
  getMonitoringTemplateUsage,
  getRuntimeMonitoringHealthSummary,
  listMonitoringTemplates,
  listRuntimeActiveMonitors,
  listRuntimeMonitoringResults,
  previewMonitoringTemplate,
  updateRuntimeActiveMonitor,
  validateMonitoringTemplateSample,
} from "./service.js";

const ID = { type: "string", minLength: 1 };
const JSON_OBJECT = { type: "object", additionalProperties: true };
const JSON_VALUE = {};
const TEMPLATE_REF = {
  type: ["object", "null"],
  additionalProperties: false,
  required: ["id", "version"],
  properties: { id: ID, version: ID },
};
const TEMPLATE_FIELDS = {
  name: { type: "string" },
  description: { type: "string" },
  definition: JSON_OBJECT,
};
const ACTIVE_MONITOR_FIELDS = {
  name: { type: "string" },
  description: { type: "string" },
  provider: { type: "string", enum: ["rest", "shell"] },
  enabled: { type: "boolean" },
  intervalSeconds: { type: "integer", minimum: 10, maximum: 86_400 },
  timeoutSeconds: { type: "integer", minimum: 1, maximum: 300 },
  configuration: JSON_OBJECT,
  templateRef: TEMPLATE_REF,
};

function schema(properties = {}, required = []) {
  return {
    type: "object",
    ...(required.length ? { required } : {}),
    additionalProperties: false,
    properties,
  };
}

function definition(name, description, handler, inputSchema) {
  return { name, description, handler, inputSchema };
}

const TEMPLATE_VERSION_ID_SCHEMA = schema({ templateId: ID, version: ID }, [
  "templateId",
  "version",
]);

export const monitoringTools = [
  definition(
    "monitoring_templates_list",
    "Lista templates de monitoramento versionados do workspace configurado, com filtro de status e paginação.",
    listMonitoringTemplates,
    schema({
      status: { type: "string", enum: ["draft", "active", "inactive"] },
      page: { type: "integer", minimum: 1, default: 1 },
      limit: { type: "integer", minimum: 1, maximum: 100, default: 50 },
    }),
  ),
  definition(
    "monitoring_templates_get",
    "Obtém um template e suas versões no workspace configurado; version seleciona uma versão específica.",
    getMonitoringTemplate,
    schema({ templateId: ID, version: ID }, ["templateId"]),
  ),
  definition(
    "monitoring_templates_preview",
    "Testa uma definição de template com uma amostra JSON sanitizada sem persistir nem registrar observação.",
    previewMonitoringTemplate,
    schema({ definition: JSON_OBJECT, sample: JSON_VALUE }, ["definition"]),
  ),
  definition(
    "monitoring_templates_create",
    "Cria a primeira versão em rascunho de um template no workspace configurado.",
    createMonitoringTemplate,
    schema(TEMPLATE_FIELDS, ["name", "definition"]),
  ),
  definition(
    "monitoring_templates_create_version",
    "Cria uma nova versão em rascunho derivada do template informado, preservando as versões anteriores.",
    createMonitoringTemplateVersion,
    schema({ templateId: ID, ...TEMPLATE_FIELDS }, ["templateId"]),
  ),
  definition(
    "monitoring_templates_get_usage",
    "Retorna o uso de uma versão de template por monitores e observações antes de manutenção ou arquivamento.",
    getMonitoringTemplateUsage,
    TEMPLATE_VERSION_ID_SCHEMA,
  ),
  definition(
    "monitoring_templates_get_contract",
    "Obtém o contrato público de entrada, saída e apresentação de uma versão sem expor sua expressão.",
    getMonitoringTemplateContract,
    TEMPLATE_VERSION_ID_SCHEMA,
  ),
  definition(
    "monitoring_templates_validate",
    "Valida uma amostra JSON usando uma versão persistida, sem registrar observação.",
    validateMonitoringTemplateSample,
    schema({ templateId: ID, version: ID, sample: JSON_VALUE }, [
      "templateId",
      "version",
      "sample",
    ]),
  ),
  definition(
    "monitoring_templates_activate",
    "Ativa uma versão validada e inativa automaticamente outra versão ativa do mesmo template.",
    activateMonitoringTemplate,
    TEMPLATE_VERSION_ID_SCHEMA,
  ),
  definition(
    "monitoring_templates_deactivate",
    "Desativa explicitamente uma versão de template sem removê-la nem alterar o histórico.",
    deactivateMonitoringTemplate,
    TEMPLATE_VERSION_ID_SCHEMA,
  ),
  definition(
    "monitoring_templates_archive",
    "Arquiva uma versão de template identificada explicitamente; a API recusa versões ainda em uso.",
    archiveMonitoringTemplate,
    TEMPLATE_VERSION_ID_SCHEMA,
  ),
  definition(
    "runtime_monitoring_results_list",
    "Lista resultados históricos unificados de monitoramento de um runtime, com filtros por instante inicial, instante final e status.",
    listRuntimeMonitoringResults,
    schema(
      {
        runtimeReference: ID,
        observedFrom: {
          type: "string",
          description:
            "Data (YYYY-MM-DD) ou instante ISO 8601 inicial, inclusivo",
        },
        observedTo: {
          type: "string",
          description:
            "Data (YYYY-MM-DD, incluindo o dia inteiro) ou instante ISO 8601 final, inclusivo",
        },
        status: {
          type: "string",
          enum: ["unknown", "healthy", "degraded", "unavailable", "stopped"],
        },
        page: { type: "integer", minimum: 1, default: 1 },
        limit: { type: "integer", minimum: 1, maximum: 100, default: 50 },
      },
      ["runtimeReference"],
    ),
  ),
  definition(
    "runtime_monitoring_health_summary",
    "Resume a evolução temporal da saúde de um runtime em séries agregadas por monitor, preservando o pior estado de cada intervalo e limitando a quantidade de pontos.",
    getRuntimeMonitoringHealthSummary,
    schema(
      {
        runtimeReference: ID,
        observedFrom: {
          type: "string",
          description:
            "Data (YYYY-MM-DD) ou instante ISO 8601 inicial; o padrão cobre 30 dias antes do limite final",
        },
        observedTo: {
          type: "string",
          description:
            "Data (YYYY-MM-DD, incluindo o dia inteiro) ou instante ISO 8601 final; o padrão é o instante atual",
        },
        status: {
          type: "string",
          enum: ["unknown", "healthy", "degraded", "unavailable", "stopped"],
        },
        resolution: {
          type: "string",
          enum: ["auto", "1m", "5m", "15m", "1h", "6h", "1d", "7d", "30d"],
          default: "auto",
        },
        maxPoints: {
          type: "integer",
          minimum: 50,
          maximum: 1000,
          default: 400,
        },
      },
      ["runtimeReference"],
    ),
  ),
  definition(
    "runtime_active_monitors_list",
    "Lista os monitoramentos ativos configurados para um runtime acessível no workspace selecionado.",
    listRuntimeActiveMonitors,
    schema(
      {
        runtimeReference: ID,
        page: { type: "integer", minimum: 1, default: 1 },
        limit: { type: "integer", minimum: 1, maximum: 100, default: 50 },
      },
      ["runtimeReference"],
    ),
  ),
  definition(
    "runtime_active_monitors_create",
    "Cria um monitoramento REST ou Shell para um runtime; referências de template são aceitas somente para REST.",
    createRuntimeActiveMonitor,
    schema({ runtimeReference: ID, ...ACTIVE_MONITOR_FIELDS }, [
      "runtimeReference",
      "name",
      "provider",
      "configuration",
    ]),
  ),
  definition(
    "runtime_active_monitors_update",
    "Atualiza a configuração de um monitoramento ativo existente, preservando validação, auditoria e tenancy da API.",
    updateRuntimeActiveMonitor,
    schema(
      {
        runtimeReference: ID,
        monitorId: ID,
        ...ACTIVE_MONITOR_FIELDS,
      },
      ["runtimeReference", "monitorId"],
    ),
  ),
  definition(
    "runtime_active_monitors_archive",
    "Arquiva um monitoramento ativo identificado pelo runtime e monitorId, interrompendo futuras execuções.",
    archiveRuntimeActiveMonitor,
    schema({ runtimeReference: ID, monitorId: ID }, [
      "runtimeReference",
      "monitorId",
    ]),
  ),
];
