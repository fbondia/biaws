import { z } from "zod";

// These schemas describe the HTTP boundary. Database relations, authorization,
// dynamic option lists and uniqueness remain in the domain repositories.
export const routeQuerySchema = z.record(z.string(), z.unknown());
export const optionalObjectBodySchema = z.object({}).passthrough().optional();
export const publicObjectSchema = z.record(z.string(), z.json());

const legacyRequiredIssueText = (field: "title" | "text") =>
  z
    .unknown()
    .transform((value) => String(value || "").trim())
    .refine(Boolean, `Invalid issue payload: ${field} is required`);

export const issueCreateBodySchema = z
  .object({
    title: legacyRequiredIssueText("title"),
    text: legacyRequiredIssueText("text"),
    type: z.unknown().optional(),
    status: z.unknown().optional(),
    date: z.unknown().optional(),
    comment: z.unknown().optional(),
    applicationId: z.unknown().optional(),
    affectedComponentIds: z.unknown().optional(),
  })
  .passthrough();

export type IssueCreateInput = z.input<typeof issueCreateBodySchema>;
export type IssueCreateOutput = z.output<typeof issueCreateBodySchema>;

export const issueResponseSchema = z
  .object({
    issue: z
      .object({
        _id: z.string(),
        id: z.string(),
        workspaceId: z.string(),
      })
      .passthrough(),
  })
  .passthrough();

export const demandResponseSchema = z
  .object({
    request: z
      .object({
        id: z.string(),
        workspaceId: z.string(),
      })
      .passthrough(),
  })
  .passthrough();

export const monitoringTemplateResponseSchema = z
  .object({
    template: z
      .object({ id: z.string(), name: z.string(), version: z.string() })
      .passthrough(),
  })
  .passthrough();

export const publicSecretSchema = z
  .object({
    id: z.string(),
    workspaceId: z.string(),
    applicationId: z.string().nullable(),
    collectionId: z.string(),
    identifier: z.string(),
    name: z.string(),
    description: z.string(),
    type: z.string(),
    environment: z.string(),
    provider: z.string().nullable(),
    status: z.string(),
    provisioningStatus: z.string(),
    currentVersion: z.number(),
    versionCount: z.number(),
    contentKind: z.string(),
    file: z
      .object({ name: z.string(), mediaType: z.string(), size: z.number() })
      .nullable(),
    createdAt: z.union([z.string(), z.date()]).optional(),
    createdBy: z.string().nullable().optional(),
    updatedAt: z.union([z.string(), z.date()]).optional(),
    updatedBy: z.string().nullable().optional(),
  })
  .strict();

export const secretResponseSchema = z
  .object({ secret: publicSecretSchema })
  .strict();

export type PublicSecret = z.output<typeof publicSecretSchema>;

export const domainBodySchemas = {
  accessRouter: optionalObjectBodySchema,
  auditRouter: z.unknown(),
  catalogRouter: optionalObjectBodySchema,
  catalogTopologyRouter: optionalObjectBodySchema,
  homeRouter: optionalObjectBodySchema,
  identityRouter: optionalObjectBodySchema,
  issuesRouter: optionalObjectBodySchema,
  knowledgeRecordsRouter: optionalObjectBodySchema,
  monitoringRouter: optionalObjectBodySchema,
  optionListsRouter: optionalObjectBodySchema,
  platformRouter: optionalObjectBodySchema,
  requestsRouter: optionalObjectBodySchema,
  resourceCollectionsRouter: optionalObjectBodySchema,
  secretsRouter: optionalObjectBodySchema,
  skillsRouter: optionalObjectBodySchema,
  userPreferencesRouter: optionalObjectBodySchema,
} as const;

export type ContractDomain = keyof typeof domainBodySchemas;

export function operationBodySchema(
  domain: ContractDomain,
  method: string,
  routePath: string,
): z.ZodType {
  if (domain === "issuesRouter" && method === "post" && routePath === "/") {
    return issueCreateBodySchema;
  }
  return method === "get" ? z.unknown() : domainBodySchemas[domain];
}

export function operationResponseSchema(
  domain: ContractDomain,
  method: string,
  routePath: string,
): z.ZodType {
  if (
    domain === "issuesRouter" &&
    ((method === "post" && routePath === "/") ||
      (method === "get" && routePath === "/:id"))
  ) {
    return issueResponseSchema;
  }
  if (
    domain === "requestsRouter" &&
    ((method === "post" && routePath === "/") ||
      (method === "get" && routePath === "/:id"))
  ) {
    return demandResponseSchema;
  }
  if (
    domain === "monitoringRouter" &&
    ((["post", "get", "patch"].includes(method) &&
      ["/templates", "/templates/:templateId"].includes(routePath) &&
      !(method === "get" && routePath === "/templates")) ||
      /^\/templates\/:templateId\/versions\/:version\/(activate|deactivate)$/u.test(
        routePath,
      ) ||
      (method === "delete" &&
        routePath === "/templates/:templateId/versions/:version"))
  ) {
    return monitoringTemplateResponseSchema;
  }
  if (
    domain === "secretsRouter" &&
    routePath === "/:secretId" &&
    method === "get"
  ) {
    return secretResponseSchema;
  }
  return publicObjectSchema;
}
