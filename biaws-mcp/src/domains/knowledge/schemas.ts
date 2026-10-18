import type { ToolDefinition } from "../../mcp/tools/contracts.js";
const catalogDetailsSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    items: {
      type: "array",
      maxItems: 500,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "description"],
        properties: {
          id: { type: "string", minLength: 1, maxLength: 80 },
          title: { type: "string", minLength: 1, maxLength: 240 },
          description: { type: "string", minLength: 1 },
        },
      },
    },
  },
} as const;

export const knowledgeTools = [
  {
    name: "knowledge_context_load",
    description: "Carrega documentos vigentes aplicáveis a uma aplicação ou componente, com Markdown opcional.",
    inputSchema: {
      type: "object",
      required: ["applicationId"],
      additionalProperties: false,
      properties: {
        applicationId: {
          type: "string",
          minLength: 1,
        },
        componentId: {
          type: "string",
          minLength: 1,
        },
        includeMarkdown: {
          type: "boolean",
          default: true,
        },
        limit: {
          type: "integer",
          minimum: 1,
          maximum: 100,
          default: 50,
        },
      },
    },
  },
  {
    name: "document_types_list",
    description: "Lista o contrato oficial de cada tipo de documento: contexto exigido, estados e campos details.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: {},
    },
  },
  {
    name: "documents_search",
    description: "Busca documentos por tipo, aplicação, componente, coleção, estado ou texto.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        search: {
          type: "string",
        },
        documentType: {
          type: "string",
          enum: [
            "business-rule",
            "architecture-decision",
            "guideline",
            "feature",
            "technical-reference",
            "procedure",
            "free-text",
            "catalog",
          ],
          description: "Tipo imutável do documento. Consulte document_types_list para o contrato completo.",
        },
        applicationId: {
          type: "string",
          minLength: 1,
        },
        componentId: {
          type: "string",
          minLength: 1,
        },
        collectionId: {
          type: "string",
          minLength: 1,
        },
        status: {
          type: "string",
          enum: [
            "draft",
            "active",
            "retired",
            "archived",
            "proposed",
            "accepted",
            "rejected",
            "superseded",
            "published",
            "deprecated",
          ],
        },
        currentOnly: {
          type: "boolean",
        },
        includeWorkspace: {
          type: "boolean",
        },
        includeArchived: {
          type: "boolean",
        },
        page: {
          type: "integer",
          minimum: 1,
        },
        limit: {
          type: "integer",
          minimum: 1,
          maximum: 100,
        },
      },
    },
  },

  {
    name: "documents_create",
    description:
      "Cria um documento usando o contrato discriminado pelo documentType. O workspace vem da configuração do MCP; applicationId e details seguem as regras de cada tipo.",
    inputSchema: {
      type: "object",
      required: ["documentType", "title"],
      additionalProperties: false,
      properties: {
        identifier: {
          type: "string",
          pattern: "^[a-z0-9]+(?:-[a-z0-9]+)*$",
          maxLength: 80,
          description: "Identificador opcional e único no workspace, usando minúsculas, números e hífens simples.",
        },
        documentType: {
          type: "string",
          enum: [
            "business-rule",
            "architecture-decision",
            "guideline",
            "feature",
            "technical-reference",
            "procedure",
            "free-text",
            "catalog",
          ],
          description: "Tipo imutável do documento. Consulte document_types_list para o contrato completo.",
        },
        title: {
          type: "string",
          minLength: 1,
          maxLength: 240,
        },
        summary: {
          type: "string",
          minLength: 1,
          maxLength: 500,
        },
        markdown: {
          type: "string",
          description: "Conteúdo Markdown; opcional para catálogos, cujos elementos ficam em details.items.",
        },
        applicationId: {
          type: "string",
          minLength: 1,
          description:
            "Obrigatório para regras, decisões, features e documentos cujo escopo seja aplicação ou componente; omita no escopo do workspace.",
        },
        affectedComponentIds: {
          type: "array",
          maxItems: 100,
          items: {
            type: "string",
            minLength: 1,
          },
          description: "Componentes ativos da applicationId. Não pode ser informado sem aplicação.",
        },
        collectionId: {
          type: "string",
        },
        status: {
          type: "string",
          enum: [
            "draft",
            "active",
            "retired",
            "archived",
            "proposed",
            "accepted",
            "rejected",
            "superseded",
            "published",
            "deprecated",
          ],
          description: "Estado válido para o documentType; quando omitido, usa o estado inicial do tipo.",
        },
        details: {
          type: "object",
          description: "Metadados específicos do documentType, validados pelo ramo correspondente do schema.",
        },
        classification: {
          type: "object",
          description: "Taxonomias e tags aplicáveis ao contexto do documento.",
          additionalProperties: false,
          properties: {
            primaryTaxonomyId: {
              type: "string",
            },
            secondaryTaxonomyIds: {
              type: "array",
              items: {
                type: "string",
                minLength: 1,
              },
            },
            tags: {
              type: "object",
              additionalProperties: {
                type: "array",
                items: {
                  type: "string",
                  minLength: 1,
                },
              },
            },
          },
        },
        source: {
          type: "object",
          description: "Origem canônica. Em mode=repository, repositoryId e path são obrigatórios.",
          additionalProperties: false,
          properties: {
            mode: {
              type: "string",
              enum: ["native", "repository"],
            },
            repositoryId: {
              type: "string",
              maxLength: 160,
            },
            path: {
              type: "string",
              maxLength: 500,
            },
          },
          oneOf: [
            {
              properties: {
                mode: {
                  const: "native",
                },
              },
              required: ["mode"],
            },
            {
              properties: {
                mode: {
                  const: "repository",
                },
              },
              required: ["mode", "repositoryId", "path"],
            },
          ],
        },
        references: {
          type: "array",
          maxItems: 100,
          description: "Relações com outros documentos do mesmo workspace.",
          items: {
            type: "object",
            required: ["targetDocumentId"],
            additionalProperties: false,
            properties: {
              targetDocumentId: {
                type: "string",
                minLength: 1,
              },
              relationship: {
                type: "string",
                maxLength: 80,
                description: "Tipo da relação; usa related quando omitido.",
              },
            },
          },
        },
        definedAt: {
          type: "string",
          pattern: String.raw`^\d{4}-\d{2}-\d{2}$`,
          description: "Data no formato YYYY-MM-DD.",
        },
        lastReviewedAt: {
          type: "string",
          description: "YYYY-MM-DD ou vazio.",
        },
        nextReviewAt: {
          type: "string",
          description: "YYYY-MM-DD ou vazio.",
        },
        changeSummary: {
          type: "string",
        },
      },
      oneOf: [
        {
          description: "Regra de negócio: Condições e comportamentos esperados do domínio.",
          properties: {
            markdown: { type: "string", minLength: 1 },
            documentType: {
              const: "business-rule",
            },
            status: {
              type: "string",
              enum: ["draft", "active", "retired", "archived"],
            },
            details: {
              type: "object",
              additionalProperties: false,
              properties: {
                ruleCode: {
                  type: "string",
                  maxLength: 80,
                },
                effectiveFrom: {
                  type: "string",
                  pattern: String.raw`^\d{4}-\d{2}-\d{2}$`,
                  description: "Data no formato YYYY-MM-DD.",
                },
              },
            },
          },
          required: ["summary", "markdown", "documentType", "applicationId"],
        },
        {
          description: "Decisão arquitetural: Escolhas técnicas, contexto, alternativas e consequências.",
          properties: {
            markdown: { type: "string", minLength: 1 },
            documentType: {
              const: "architecture-decision",
            },
            status: {
              type: "string",
              enum: ["proposed", "accepted", "rejected", "superseded", "archived"],
            },
            details: {
              type: "object",
              additionalProperties: false,
              properties: {
                decidedAt: {
                  type: "string",
                  pattern: String.raw`^\d{4}-\d{2}-\d{2}$`,
                  description: "Data no formato YYYY-MM-DD.",
                },
              },
            },
          },
          required: ["summary", "markdown", "documentType", "applicationId"],
        },
        {
          description: "Feature: Descrição funcional e técnica aprofundada de uma capacidade.",
          properties: {
            markdown: { type: "string", minLength: 1 },
            documentType: {
              const: "feature",
            },
            status: {
              type: "string",
              enum: ["draft", "published", "deprecated", "archived"],
            },
            details: {
              type: "object",
              additionalProperties: false,
              properties: {
                maturity: {
                  type: "string",
                  enum: ["planned", "beta", "stable", "retired"],
                  default: "stable",
                },
              },
            },
          },
          required: ["summary", "markdown", "documentType", "applicationId"],
        },
        {
          description: "Referência técnica geral do workspace; applicationId e componentes devem ser omitidos.",
          properties: {
            markdown: { type: "string", minLength: 1 },
            documentType: {
              const: "technical-reference",
            },
            status: {
              type: "string",
              enum: ["draft", "published", "deprecated", "archived"],
            },
            details: {
              type: "object",
              additionalProperties: false,
              properties: {
                referenceKind: {
                  type: "string",
                  enum: ["architecture", "contract", "schema", "protocol", "mechanism"],
                  default: "architecture",
                },
              },
            },
            applicationId: {
              const: null,
            },
            affectedComponentIds: {
              type: "array",
              maxItems: 0,
            },
          },
          required: ["summary", "markdown", "documentType"],
        },
        {
          description: "Referência técnica vinculada a uma aplicação e, opcionalmente, a seus componentes.",
          properties: {
            markdown: { type: "string", minLength: 1 },
            documentType: {
              const: "technical-reference",
            },
            status: {
              type: "string",
              enum: ["draft", "published", "deprecated", "archived"],
            },
            details: {
              type: "object",
              additionalProperties: false,
              properties: {
                referenceKind: {
                  type: "string",
                  enum: ["architecture", "contract", "schema", "protocol", "mechanism"],
                  default: "architecture",
                },
              },
            },
          },
          required: ["summary", "markdown", "documentType", "applicationId"],
        },
        {
          description: "Procedimento geral do workspace; applicationId e componentes devem ser omitidos.",
          properties: {
            markdown: { type: "string", minLength: 1 },
            documentType: {
              const: "procedure",
            },
            status: {
              type: "string",
              enum: ["draft", "published", "deprecated", "archived"],
            },
            details: {
              type: "object",
              additionalProperties: false,
              properties: {},
            },
            applicationId: {
              const: null,
            },
            affectedComponentIds: {
              type: "array",
              maxItems: 0,
            },
          },
          required: ["summary", "markdown", "documentType"],
        },
        {
          description: "Procedimento vinculada a uma aplicação e, opcionalmente, a seus componentes.",
          properties: {
            markdown: { type: "string", minLength: 1 },
            documentType: {
              const: "procedure",
            },
            status: {
              type: "string",
              enum: ["draft", "published", "deprecated", "archived"],
            },
            details: {
              type: "object",
              additionalProperties: false,
              properties: {},
            },
          },
          required: ["summary", "markdown", "documentType", "applicationId"],
        },
        {
          description: "Guideline geral do workspace; applicationId deve ser omitido.",
          properties: {
            markdown: { type: "string", minLength: 1 },
            documentType: {
              const: "guideline",
            },
            status: {
              type: "string",
              enum: ["draft", "published", "deprecated", "archived"],
            },
            details: {
              type: "object",
              additionalProperties: false,
              properties: {
                scope: {
                  const: "workspace",
                },
                enforcement: {
                  type: "string",
                  enum: ["required", "recommended", "informative"],
                  default: "recommended",
                },
              },
              required: ["scope"],
            },
            applicationId: {
              const: null,
            },
            affectedComponentIds: {
              type: "array",
              maxItems: 0,
            },
          },
          required: ["summary", "markdown", "documentType", "details"],
        },
        {
          description: "Guideline vinculada a uma aplicação.",
          properties: {
            markdown: { type: "string", minLength: 1 },
            documentType: {
              const: "guideline",
            },
            status: {
              type: "string",
              enum: ["draft", "published", "deprecated", "archived"],
            },
            details: {
              type: "object",
              additionalProperties: false,
              properties: {
                scope: {
                  const: "application",
                },
                enforcement: {
                  type: "string",
                  enum: ["required", "recommended", "informative"],
                  default: "recommended",
                },
              },
              required: ["scope"],
            },
          },
          required: ["summary", "markdown", "documentType", "details", "applicationId"],
        },
        {
          description: "Guideline vinculada a ao menos um componente da aplicação.",
          properties: {
            markdown: { type: "string", minLength: 1 },
            documentType: {
              const: "guideline",
            },
            status: {
              type: "string",
              enum: ["draft", "published", "deprecated", "archived"],
            },
            details: {
              type: "object",
              additionalProperties: false,
              properties: {
                scope: {
                  const: "component",
                },
                enforcement: {
                  type: "string",
                  enum: ["required", "recommended", "informative"],
                  default: "recommended",
                },
              },
              required: ["scope"],
            },
            affectedComponentIds: {
              type: "array",
              minItems: 1,
              maxItems: 100,
              items: {
                type: "string",
                minLength: 1,
              },
            },
          },
          required: ["summary", "markdown", "documentType", "details", "applicationId", "affectedComponentIds"],
        },
        {
          description: "Texto Markdown livre.",
          properties: {
            documentType: { const: "free-text" },
            status: { type: "string", enum: ["draft", "published", "deprecated", "archived"] },
            markdown: { type: "string", minLength: 1 },
            details: { type: "object", additionalProperties: false, properties: {} },
            applicationId: { const: null },
            affectedComponentIds: { type: "array", maxItems: 0 },
          },
          required: ["documentType", "markdown"],
        },
        {
          description: "Texto Markdown livre.",
          properties: {
            documentType: { const: "free-text" },
            status: { type: "string", enum: ["draft", "published", "deprecated", "archived"] },
            markdown: { type: "string", minLength: 1 },
            details: { type: "object", additionalProperties: false, properties: {} },
          },
          required: ["documentType", "markdown", "applicationId"],
        },
        {
          description: "Catálogo com elementos expansíveis.",
          properties: {
            documentType: { const: "catalog" },
            status: { type: "string", enum: ["draft", "published", "deprecated", "archived"] },
            markdown: { type: "string" },
            details: catalogDetailsSchema,
            applicationId: { const: null },
            affectedComponentIds: { type: "array", maxItems: 0 },
          },
          required: ["documentType"],
        },
        {
          description: "Catálogo com elementos expansíveis.",
          properties: {
            documentType: { const: "catalog" },
            status: { type: "string", enum: ["draft", "published", "deprecated", "archived"] },
            markdown: { type: "string" },
            details: catalogDetailsSchema,
          },
          required: ["documentType", "applicationId"],
        },
      ],
    },
  },
  {
    name: "documents_update",
    description:
      "Atualiza um documento existente. documentType é imutável; consulte documents_get antes de alterar contexto, status ou details.",
    inputSchema: {
      type: "object",
      required: ["documentId"],
      additionalProperties: false,
      properties: {
        documentId: {
          type: "string",
          minLength: 1,
        },
        identifier: {
          type: "string",
          pattern: "^[a-z0-9]+(?:-[a-z0-9]+)*$",
          maxLength: 80,
          description: "Identificador opcional e único no workspace, usando minúsculas, números e hífens simples.",
        },
        documentType: {
          type: "string",
          enum: [
            "business-rule",
            "architecture-decision",
            "guideline",
            "feature",
            "technical-reference",
            "procedure",
            "free-text",
            "catalog",
          ],
          description: "Tipo imutável do documento. Consulte document_types_list para o contrato completo.",
        },
        title: {
          type: "string",
          minLength: 1,
          maxLength: 240,
        },
        summary: {
          type: "string",
          minLength: 1,
          maxLength: 500,
        },
        markdown: {
          type: "string",
        },
        applicationId: {
          type: "string",
          minLength: 1,
          description:
            "Obrigatório para regras, decisões, features e documentos cujo escopo seja aplicação ou componente; omita no escopo do workspace.",
        },
        affectedComponentIds: {
          type: "array",
          maxItems: 100,
          items: {
            type: "string",
            minLength: 1,
          },
          description: "Componentes ativos da applicationId. Não pode ser informado sem aplicação.",
        },
        collectionId: {
          type: "string",
        },
        status: {
          type: "string",
          enum: [
            "draft",
            "active",
            "retired",
            "archived",
            "proposed",
            "accepted",
            "rejected",
            "superseded",
            "published",
            "deprecated",
          ],
          description: "Estado válido para o documentType; quando omitido, usa o estado inicial do tipo.",
        },
        details: {
          type: "object",
          description: "Metadados específicos do documentType, validados pelo ramo correspondente do schema.",
        },
        classification: {
          type: "object",
          description: "Taxonomias e tags aplicáveis ao contexto do documento.",
          additionalProperties: false,
          properties: {
            primaryTaxonomyId: {
              type: "string",
            },
            secondaryTaxonomyIds: {
              type: "array",
              items: {
                type: "string",
                minLength: 1,
              },
            },
            tags: {
              type: "object",
              additionalProperties: {
                type: "array",
                items: {
                  type: "string",
                  minLength: 1,
                },
              },
            },
          },
        },
        source: {
          type: "object",
          description: "Origem canônica. Em mode=repository, repositoryId e path são obrigatórios.",
          additionalProperties: false,
          properties: {
            mode: {
              type: "string",
              enum: ["native", "repository"],
            },
            repositoryId: {
              type: "string",
              maxLength: 160,
            },
            path: {
              type: "string",
              maxLength: 500,
            },
          },
          oneOf: [
            {
              properties: {
                mode: {
                  const: "native",
                },
              },
              required: ["mode"],
            },
            {
              properties: {
                mode: {
                  const: "repository",
                },
              },
              required: ["mode", "repositoryId", "path"],
            },
          ],
        },
        references: {
          type: "array",
          maxItems: 100,
          description: "Relações com outros documentos do mesmo workspace.",
          items: {
            type: "object",
            required: ["targetDocumentId"],
            additionalProperties: false,
            properties: {
              targetDocumentId: {
                type: "string",
                minLength: 1,
              },
              relationship: {
                type: "string",
                maxLength: 80,
                description: "Tipo da relação; usa related quando omitido.",
              },
            },
          },
        },
        definedAt: {
          type: "string",
          pattern: String.raw`^\d{4}-\d{2}-\d{2}$`,
          description: "Data no formato YYYY-MM-DD.",
        },
        lastReviewedAt: {
          type: "string",
          description: "YYYY-MM-DD ou vazio.",
        },
        nextReviewAt: {
          type: "string",
          description: "YYYY-MM-DD ou vazio.",
        },
        changeSummary: {
          type: "string",
        },
      },
    },
  },
  {
    name: "documents_add_observation",
    description: "Acrescenta uma observação imutável a um documento.",
    inputSchema: {
      type: "object",
      required: ["documentId", "markdown"],
      additionalProperties: false,
      properties: {
        documentId: {
          type: "string",
          minLength: 1,
        },
        markdown: {
          type: "string",
          minLength: 1,
        },
      },
    },
  },
] as const satisfies readonly ToolDefinition[];
