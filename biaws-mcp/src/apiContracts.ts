import { z } from "zod";
import { BiawsError } from "./errors.js";

// Validate fields consumed by services; retain unknown API fields for forwarding.
export interface ApiEntity {
  [key: string]: unknown;
  id?: string;
  _id?: string;
  key?: string;
  name?: string;
  title?: string;
  label?: string;
  value?: string;
  status?: string;
  defaultValue?: string;
  active?: boolean;
  code?: string;
  clientCode?: string;
  description?: string;
  text?: string;
  markdown?: string;
  summary?: string;
  date?: string;
  applicationId?: string;
  componentId?: string;
  deploymentId?: string;
  workspaceId?: string;
  targetDocumentId?: string;
  identifier?: string;
  collectionId?: string;
  startDate?: string;
  endDate?: string;
  estimatedDeliveryDate?: string;
  estimatedJourneys?: number;
  plannedJourneys?: number;
  executedJourneys?: number;
  month?: string;
  comment?: string;
  content?: string;
  affectedComponentIds?: string[];
  applicationIds?: string[];
  children?: ApiEntity[];
  items?: ApiEntity[];
  tasks?: ApiEntity[];
  notes?: ApiEntity[];
  journeys?: ApiEntity[];
  attachments?: ApiEntity[];
  specification?: { sections?: ApiEntity[] } | string;
}
const strings = [
  "id",
  "_id",
  "key",
  "name",
  "title",
  "label",
  "value",
  "status",
  "defaultValue",
  "code",
  "clientCode",
  "description",
  "text",
  "markdown",
  "summary",
  "date",
  "applicationId",
  "componentId",
  "deploymentId",
  "workspaceId",
  "targetDocumentId",
  "identifier",
  "collectionId",
  "startDate",
  "endDate",
  "estimatedDeliveryDate",
  "month",
  "comment",
  "content",
];
const numbers = ["estimatedJourneys", "plannedJourneys", "executedJourneys"];
export const apiEntitySchema: z.ZodType<ApiEntity> = z.lazy(() =>
  z
    .object({
      ...Object.fromEntries(strings.map((key) => [key, z.string().optional()])),
      ...Object.fromEntries(numbers.map((key) => [key, z.number().optional()])),
      active: z.boolean().optional(),
      affectedComponentIds: z.array(z.string()).optional(),
      applicationIds: z.array(z.string()).optional(),
      children: z.array(apiEntitySchema).optional(),
      items: z.array(apiEntitySchema).optional(),
      tasks: z.array(apiEntitySchema).optional(),
      notes: z.array(apiEntitySchema).optional(),
      journeys: z.array(apiEntitySchema).optional(),
      attachments: z.array(apiEntitySchema).optional(),
      specification: z
        .union([
          z.string(),
          z
            .object({ sections: z.array(apiEntitySchema).optional() })
            .passthrough(),
        ])
        .optional(),
    })
    .passthrough(),
);
export const apiPayloadSchema = z
  .object({
    meta: z
      .object({
        page: z.number().optional(),
        limit: z.number().optional(),
        total: z.number().optional(),
        totalPages: z.number().optional(),
      })
      .passthrough()
      .optional(),
    items: z.array(apiEntitySchema).optional(),
    issue: apiEntitySchema.optional(),
    request: apiEntitySchema.optional(),
    document: apiEntitySchema.optional(),
    application: apiEntitySchema.optional(),
    component: apiEntitySchema.optional(),
    repository: apiEntitySchema.optional(),
    integration: apiEntitySchema.optional(),
    deployment: apiEntitySchema.optional(),
    runtime: apiEntitySchema.optional(),
    server: apiEntitySchema.optional(),
    secret: apiEntitySchema.optional(),
    workspace: apiEntitySchema.optional(),
    context: apiEntitySchema.optional(),
    value: apiEntitySchema.optional(),
    comments: z.array(apiEntitySchema).optional(),
    uploaded: z.array(apiEntitySchema).optional(),
    taxonomy: z
      .object({
        schemaVersion: z.number().optional(),
        source: z.unknown().optional(),
        taxonomy: z.array(apiEntitySchema).optional(),
        tagGroups: z
          .array(
            z
              .object({
                id: z.string(),
                label: z.string().optional(),
                tags: z.array(z.string()).optional(),
              })
              .passthrough(),
          )
          .optional(),
      })
      .passthrough()
      .optional(),
    error: z
      .object({
        code: z.string().optional(),
        message: z.string().optional(),
        requestId: z.string().optional(),
        retryable: z.boolean().optional(),
      })
      .passthrough()
      .optional(),
    message: z.string().optional(),
  })
  .passthrough();
export type ApiPayload = z.infer<typeof apiPayloadSchema>;
export type ApiMeta = NonNullable<ApiPayload["meta"]>;
export function parseApiPayload(value: unknown): ApiPayload {
  const result = apiPayloadSchema.safeParse(value);
  if (result.success) return result.data;
  const error = new BiawsError("biaws-api returned an invalid payload");
  error.code = "INVALID_UPSTREAM_PAYLOAD";
  error.statusCode = 502;
  error.retryable = false;
  error.fields = result.error.issues.map(({ path, code }) => ({
    path: path.join("."),
    code,
  }));
  throw error;
}
export function requireEntity(
  value: ApiEntity | undefined,
): ApiEntity & { id: string } {
  if (!value || typeof value.id !== "string" || !value.id)
    throw new BiawsError("API entity requires an id");
  return { ...value, id: value.id };
}
