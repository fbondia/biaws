import type { Db, Document, Filter } from "mongodb";
import { DEFAULT_WORKSPACE_KEY } from "../../../../shared/index.js";
import { COLLECTION_NAMES } from "../../database/collectionNames.js";
import { isRecord } from "../../helpers/records.js";
import { textValue } from "../../helpers/text.js";
import type { AuthorizationScope, RepositoryQuery } from "../../types/http.js";
import type { KnowledgeContext, KnowledgeContextInput } from "../../types/requests.js";
import { ensureDefaultWorkspace } from "../catalog/workspaces/bootstrap.js";

const MAX_AFFECTED_COMPONENTS = 100;

function createContextError(
  statusCode: number | undefined,
  code: string | number | undefined,
  message: string | undefined,
) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

function hasOwn(value: object, field: PropertyKey) {
  return Boolean(value && Object.hasOwn(value, field));
}

function normalizedId(value: unknown) {
  return textValue(value ?? "").trim();
}

export function normalizeAffectedComponentIds(value: unknown, current: string[] = []) {
  if (value === undefined) return [...(current || [])];
  if (!Array.isArray(value)) {
    throw createContextError(422, "INVALID_KNOWLEDGE_CONTEXT", "affectedComponentIds must be an array");
  }
  if (value.length > MAX_AFFECTED_COMPONENTS) {
    throw createContextError(
      422,
      "INVALID_KNOWLEDGE_CONTEXT",
      `affectedComponentIds must contain at most ${MAX_AFFECTED_COMPONENTS} items`,
    );
  }
  return [...new Set(value.map(normalizedId).filter(Boolean))];
}

export function normalizeStoredKnowledgeContext(document: KnowledgeContextInput = {}): KnowledgeContext {
  return {
    workspaceId: normalizedId(document.workspaceId),
    applicationId: normalizedId(document.applicationId) || null,
    affectedComponentIds: normalizeAffectedComponentIds(document.affectedComponentIds, []),
  };
}

export function knowledgeContextMetadata(document: unknown = {}) {
  const context = normalizeStoredKnowledgeContext(isRecord(document) ? document : {});
  return {
    workspaceId: context.workspaceId || null,
    applicationId: context.applicationId,
    affectedComponentIds: context.affectedComponentIds,
  };
}

export function knowledgeContextWasProvided(payload: Record<string, unknown> = {}) {
  return ["workspaceId", "applicationId", "affectedComponentIds"].some((field: string) => hasOwn(payload, field));
}

export function buildKnowledgeContextFilter(query: RepositoryQuery = {}) {
  const filter: Filter<Document> = {};
  const authorizationScope = query.authorizationScope;
  const workspaceId = normalizedId(authorizationScope?.workspaceId || query.workspaceId);
  const applicationId = normalizedId(query.applicationId);
  const componentId = normalizedId(query.componentId ?? query.affectedComponentId);
  if (workspaceId) filter.workspaceId = workspaceId;
  if (authorizationScope && authorizationScope.workspace !== true) {
    const allowed = (authorizationScope.applicationIds || []).map(normalizedId);
    if (applicationId && allowed.includes(applicationId)) {
      filter.applicationId = applicationId;
    } else if (applicationId) {
      filter.applicationId = { $in: [] };
    } else {
      filter.applicationId = { $in: allowed };
    }
  } else if (applicationId) {
    filter.applicationId = applicationId;
  }
  if (componentId) filter.affectedComponentIds = componentId;
  return filter;
}

async function requireDefaultWorkspace(db: Db, workspaceId = "") {
  let workspace = await db
    .collection(COLLECTION_NAMES.WORKSPACES)
    .findOne(workspaceId ? { id: workspaceId } : { key: DEFAULT_WORKSPACE_KEY, default: true });
  if (!workspace) {
    await ensureDefaultWorkspace();
    workspace = await db
      .collection(COLLECTION_NAMES.WORKSPACES)
      .findOne(workspaceId ? { id: workspaceId } : { key: DEFAULT_WORKSPACE_KEY, default: true });
  }
  if (!workspace) {
    throw createContextError(409, "DEFAULT_WORKSPACE_UNAVAILABLE", "Default workspace is not available");
  }
  if (workspace.status !== "active") {
    throw createContextError(409, "WORKSPACE_ARCHIVED", "The related workspace is archived");
  }
  return workspace;
}

async function validateComponents(db: Db, context: KnowledgeContext) {
  if (!context.affectedComponentIds.length) return;
  if (!context.applicationId) {
    throw createContextError(
      422,
      "APPLICATION_REQUIRED_FOR_COMPONENTS",
      "applicationId is required when affectedComponentIds is informed",
    );
  }

  const components = await db
    .collection(COLLECTION_NAMES.APPLICATION_COMPONENTS)
    .find({ id: { $in: context.affectedComponentIds } })
    .project({ id: 1, workspaceId: 1, applicationId: 1, status: 1 })
    .toArray();
  const byId = new Map(components.map((component) => [component.id, component]));
  const invalid = context.affectedComponentIds.filter((componentId: unknown) => {
    const component = byId.get(componentId);
    return (
      component?.status !== "active" ||
      component.workspaceId !== context.workspaceId ||
      component.applicationId !== context.applicationId
    );
  });
  if (invalid.length) {
    throw createContextError(
      422,
      "INVALID_AFFECTED_COMPONENTS",
      `Affected components must be active and belong to the application: ${invalid.join(", ")}`,
    );
  }
}

async function resolveWorkspaceContext(
  db: Db,
  requestedWorkspaceId: string,
  affectedComponentIds: string[],
  authorizationScope: AuthorizationScope | null,
) {
  if (affectedComponentIds.length) {
    throw createContextError(
      422,
      "APPLICATION_REQUIRED_FOR_COMPONENTS",
      "applicationId is required when affectedComponentIds is informed",
    );
  }
  const workspace = await requireDefaultWorkspace(db, authorizationScope?.workspaceId || requestedWorkspaceId);
  if (authorizationScope && authorizationScope.workspace !== true) {
    throw createContextError(
      404,
      "WORKSPACE_KNOWLEDGE_NOT_FOUND",
      "Workspace knowledge is not available in the application scope",
    );
  }
  if (requestedWorkspaceId && requestedWorkspaceId !== workspace.id) {
    throw createContextError(
      422,
      "WORKSPACE_APPLICATION_MISMATCH",
      "workspaceId must identify the authorized workspace",
    );
  }
  return {
    workspaceId: workspace.id,
    applicationId: null,
    affectedComponentIds: [],
  };
}

async function requireActiveApplication(db: Db, applicationId: string, requestedWorkspaceId: string) {
  const application = await db.collection(COLLECTION_NAMES.APPLICATIONS).findOne({
    id: applicationId,
  });
  if (!application) {
    throw createContextError(404, "APPLICATION_NOT_FOUND", "Application not found");
  }
  if (application.status !== "active") {
    throw createContextError(409, "APPLICATION_ARCHIVED", "The related application is archived");
  }
  if (requestedWorkspaceId && requestedWorkspaceId !== application.workspaceId) {
    throw createContextError(
      422,
      "WORKSPACE_APPLICATION_MISMATCH",
      "workspaceId does not match the related application",
    );
  }
  return application;
}

function ensureApplicationAuthorized(context: KnowledgeContext, authorizationScope: AuthorizationScope | null) {
  if (
    authorizationScope &&
    authorizationScope.workspace !== true &&
    !authorizationScope.applicationIds?.includes(context.applicationId || "")
  ) {
    throw createContextError(404, "APPLICATION_NOT_FOUND", "Application not found");
  }
}

export async function resolveKnowledgeContext(
  db: Db,
  payload: Record<string, unknown> = {},
  current: KnowledgeContextInput | null = null,
  {
    applicationRequired = false,
    authorizationScope = null,
    create = false,
  }: {
    applicationRequired?: boolean;
    authorizationScope?: AuthorizationScope | null;
    create?: boolean;
  } = {},
) {
  const relationChanged = create || knowledgeContextWasProvided(payload);
  const stored = normalizeStoredKnowledgeContext(current || {});
  if (!relationChanged) return stored;

  const applicationId = hasOwn(payload, "applicationId")
    ? normalizedId(payload.applicationId)
    : stored.applicationId || "";
  const requestedWorkspaceId = hasOwn(payload, "workspaceId") ? normalizedId(payload.workspaceId) : stored.workspaceId;
  const affectedComponentIds = normalizeAffectedComponentIds(
    hasOwn(payload, "affectedComponentIds") ? payload.affectedComponentIds : undefined,
    stored.affectedComponentIds,
  );

  if (applicationRequired && !applicationId) {
    throw createContextError(422, "APPLICATION_REQUIRED", "applicationId is required");
  }

  if (!applicationId) {
    return resolveWorkspaceContext(db, requestedWorkspaceId, affectedComponentIds, authorizationScope);
  }

  const application = await requireActiveApplication(db, applicationId, requestedWorkspaceId);

  const workspace = await db.collection(COLLECTION_NAMES.WORKSPACES).findOne({
    id: application.workspaceId,
  });
  if (workspace?.status !== "active") {
    throw createContextError(409, "WORKSPACE_UNAVAILABLE", "The application's workspace is not active");
  }

  const context = {
    workspaceId: application.workspaceId,
    applicationId: application.id,
    affectedComponentIds,
  };
  await validateComponents(db, context);
  ensureApplicationAuthorized(context, authorizationScope);
  return context;
}
