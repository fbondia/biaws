import {
  getSecretMetadata,
  listSecretMetadata,
  registerSecretMetadata,
} from "./service.js";

const SECRET_METADATA_PROPERTIES = {
  identifier: {
    type: "string",
    pattern: "^[a-z0-9](?:[a-z0-9._-]{0,98}[a-z0-9])$",
    description: "Identificação técnica única e imutável no workspace.",
  },
  name: { type: "string", minLength: 1, maxLength: 100 },
  description: { type: "string", maxLength: 500 },
  type: {
    type: "string",
    enum: ["password", "api-key", "token", "private-key", "generic"],
  },
  environment: {
    type: "string",
    enum: ["", "development", "test", "staging", "production", "other"],
  },
  applicationId: {
    type: ["string", "null"],
    description:
      "Aplicação à qual o segredo pertence; null exige escopo de workspace.",
  },
  collectionId: {
    type: "string",
    description: "Coleção de segredos; vazio registra na raiz.",
  },
  contentKind: {
    type: "string",
    enum: ["text", "file"],
    description: "Formato esperado, imutável após o registro.",
  },
};

export const secretTools = [
  {
    name: "secrets_list",
    description:
      "Lista exclusivamente metadados de segredos, inclusive registros aguardando preenchimento humano. Nunca retorna valores ou arquivos.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        applicationId: { type: "string" },
        environment: SECRET_METADATA_PROPERTIES.environment,
        provisioningStatus: {
          type: "string",
          enum: ["pending", "ready"],
        },
        status: { type: "string", enum: ["active", "archived"] },
        page: { type: "integer", minimum: 1, default: 1 },
        limit: { type: "integer", minimum: 1, maximum: 100, default: 50 },
      },
    },
    handler: listSecretMetadata,
  },
  {
    name: "secrets_get",
    description:
      "Obtém exclusivamente os metadados de um segredo. Nunca retorna seu valor ou arquivo.",
    inputSchema: {
      type: "object",
      required: ["secretId"],
      additionalProperties: false,
      properties: { secretId: { type: "string", minLength: 1 } },
    },
    handler: getSecretMetadata,
  },
  {
    name: "secrets_register",
    description:
      "Registra a necessidade e os metadados de um segredo sem aceitar seu valor. O conteúdo deverá ser fornecido posteriormente por um humano autorizado na UI.",
    inputSchema: {
      type: "object",
      required: ["identifier", "name", "type", "contentKind"],
      additionalProperties: false,
      properties: SECRET_METADATA_PROPERTIES,
    },
    handler: registerSecretMetadata,
  },
];
