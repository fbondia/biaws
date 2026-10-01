import {
  OpenAPIRegistry,
  OpenApiGeneratorV31,
  extendZodWithOpenApi,
  type ResponseConfig,
  type ZodContentObject,
} from "@asteasolutions/zod-to-openapi";
import { z } from "zod";
import { collectRouteContracts, type RouteContract } from "./routeContracts.js";
import { contractRouters } from "./routers.js";
import { publicObjectSchema } from "./domainSchemas.js";

extendZodWithOpenApi(z);

const errorSchema = z
  .object({
    error: z.looseObject({
      code: z.string(),
      message: z.string(),
      fields: z
        .array(
          z.object({
            path: z.string(),
            code: z.string(),
            message: z.string(),
          }),
        )
        .optional(),
    }),
  })
  .openapi({
    example: {
      error: { code: "BAD_REQUEST", message: "Entrada inválida", fields: [] },
    },
  });

const commonQuerySchema = z.looseObject({
  page: z.string().optional().describe("Página; interpretação e defaults dependem da operação"),
  limit: z.string().optional().describe("Limite; interpretação e defaults dependem da operação"),
});

const workspaceHeaderSchema = z.object({
  "X-Biaws-Workspace-Id": z
    .string()
    .optional()
    .describe("Necessário quando a identidade possui acesso a múltiplos workspaces; dispensado em rotas de plataforma"),
});

const multipartPaths = new Set([
  "post /api/issues/imports/eml",
  "post /api/issues/:id/attachments",
  "post /api/knowledge/documents/:id/attachments",
  "post /api/requests/:id/attachments",
  "post /api/requests/:id/tasks/:taskId/attachments",
  "post /api/secrets/files",
  "put /api/secrets/:secretId/file",
]);

const binaryPaths = new Set([
  "get /api/issues/:id/attachments/:attachmentId",
  "get /api/knowledge/documents/:id/attachments/:attachmentId",
  "get /api/requests/:id/attachments/:attachmentId",
  "get /api/requests/:id/tasks/:taskId/attachments/:attachmentId",
  "post /api/secrets/:secretId/download",
]);

function operationId(contract: RouteContract) {
  return `${contract.domain.replace(/Router$/u, "")}_${contract.method}_${contract.routePath.replaceAll(/[^A-Za-z0-9]+/gu, "_").replaceAll(/^_|_$/gu, "") || "root"}`;
}

function bodyContent(contract: RouteContract) {
  const key = `${contract.method} ${contract.path}`;
  if (multipartPaths.has(key)) {
    const property = key.includes("/attachments") ? "files" : "file";
    return {
      "multipart/form-data": {
        schema: z.looseObject({
          [property]:
            property === "files"
              ? z.array(z.string().openapi({ format: "binary" }))
              : z.string().openapi({ format: "binary" }),
        }),
      },
    };
  }
  return {
    "application/json": {
      schema: contract.body,
      ...(key === "post /api/issues"
        ? {
            example: {
              title: "Exemplo sintético",
              text: "Descrição sintética",
            },
          }
        : {}),
    },
  };
}

function responseContent(contract: RouteContract): ZodContentObject {
  const key = `${contract.method} ${contract.path}`;
  if (binaryPaths.has(key)) {
    return {
      "application/octet-stream": {
        schema: z.string().openapi({ format: "binary" }),
      },
    };
  }
  const schema =
    contract.response === publicObjectSchema
      ? z.looseObject({}).describe("Objeto JSON público; formato específico permanece no contrato do domínio")
      : contract.response;
  return { "application/json": { schema } };
}

function successStatuses(contract: RouteContract): Record<string, ResponseConfig> {
  const response = {
    description: "Resposta pública",
    content: responseContent(contract),
  };
  if (contract.method === "post") return { 200: response, 201: response };
  if (contract.method === "patch" && contract.domain === "monitoringRouter") return { 200: response, 201: response };
  return { 200: response };
}

let cachedDocument: ReturnType<OpenApiGeneratorV31["generateDocument"]> | undefined;

export function buildOpenApiDocument() {
  if (cachedDocument) return cachedDocument;
  const registry = new OpenAPIRegistry();
  const publicErrorSchema = registry.register("PublicError", errorSchema);
  registry.registerComponent("securitySchemes", "sessionCookie", {
    type: "apiKey",
    in: "cookie",
    name: "biaws.session_token",
    description: "Sessão Better Auth obtida pelo login; o navegador envia o cookie automaticamente.",
  });
  registry.registerComponent("securitySchemes", "bearerApiKey", {
    type: "http",
    scheme: "bearer",
    description: "Chave de API biaws_ enviada em Authorization: Bearer.",
  });

  const contracts = collectRouteContracts(contractRouters).sort(
    (a, b) => a.path.localeCompare(b.path) || a.method.localeCompare(b.method),
  );
  for (const contract of contracts) {
    registry.registerPath({
      method: contract.method as "get" | "post" | "put" | "patch" | "delete",
      path: contract.path.replaceAll(/:([A-Za-z]\w*)/gu, "{$1}"),
      operationId: operationId(contract),
      tags: [contract.domain.replace(/Router$/u, "")],
      summary: `${contract.method.toUpperCase()} ${contract.path}`,
      description: "A autorização por operação/campo e as regras de domínio continuam aplicadas pelo backend.",
      security: [{ sessionCookie: [] }, { bearerApiKey: [] }],
      request: {
        params: contract.params as z.ZodObject<z.ZodRawShape>,
        query: commonQuerySchema,
        ...(contract.domain === "platformRouter" ? {} : { headers: workspaceHeaderSchema }),
        ...(contract.method === "get" || contract.method === "delete"
          ? {}
          : { body: { content: bodyContent(contract) } }),
      },
      responses: {
        ...successStatuses(contract),
        400: {
          description: "Consulta ou requisição inválida",
          content: { "application/json": { schema: publicErrorSchema } },
        },
        401: {
          description: "Autenticação necessária",
          content: { "application/json": { schema: publicErrorSchema } },
        },
        403: {
          description: "Acesso negado",
          content: { "application/json": { schema: publicErrorSchema } },
        },
        404: {
          description: "Recurso não encontrado",
          content: { "application/json": { schema: publicErrorSchema } },
        },
        422: {
          description: "Entrada ou regra de domínio inválida",
          content: { "application/json": { schema: publicErrorSchema } },
        },
      },
    });
  }
  registry.registerPath({
    method: "get",
    path: "/api/health",
    operationId: "health_get",
    tags: ["system"],
    summary: "Estado básico da API",
    responses: {
      200: {
        description: "API pronta",
        content: {
          "application/json": {
            schema: z.object({
              status: z.literal("ok"),
              service: z.literal("biaws-api"),
              version: z.string(),
              issueStorage: z.literal("ready"),
            }),
          },
        },
      },
    },
  });
  registry.registerPath({
    method: "get",
    path: "/api/openapi.json",
    operationId: "openapi_get",
    tags: ["system"],
    summary: "Documento OpenAPI gerado",
    responses: {
      200: {
        description: "Documento OpenAPI 3.1",
        content: {
          "application/json": {
            schema: z.looseObject({
              openapi: z.literal("3.1.0"),
              info: z.looseObject({ title: z.string(), version: z.string() }),
              paths: z.looseObject({}),
            }),
          },
        },
      },
    },
  });
  cachedDocument = new OpenApiGeneratorV31(registry.definitions).generateDocument({
    openapi: "3.1.0",
    info: {
      title: "Bondia Workspaces API",
      version: "0.6.1",
      description:
        "Contrato HTTP dos routers BIAWS. As rotas /api/auth/* são delegadas ao Better Auth e descritas em docs/authentication.md; não fazem parte deste documento gerado. Try it out executa operações reais e respeita as permissões do backend.",
    },
  });
  return cachedDocument;
}
