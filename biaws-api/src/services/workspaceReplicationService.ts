import type { Logger, LogFields } from "../logging/logger.js";
import { isRecord } from "../helpers/records.js";
type Workspace = { id: string; name?: string; [field: string]: unknown };
interface Destination<C> {
  destinationActor: Partial<Actor>;
  destinationContext: C | null;
  destinationWorkspace: Workspace;
  destinationWorkspaceId: string;
}
interface Replicated {
  status?: string;
  resource?: unknown;
  data?: Record<string, unknown>;
}
interface ReplicationOptions<C> {
  actor: Partial<Actor>;
  authorizeDestination?: (
    destination: Omit<Destination<C>, "destinationContext">,
  ) => Promise<C>;
  forbiddenCode?: string;
  forbiddenMessage?: string;
  logger?: Logger;
  payload: Record<string, unknown>;
  permission?: string;
  replicate: (destination: Destination<C>) => Promise<Replicated>;
  resolveAuthorization?: (
    userId: string,
    workspaceId: string,
  ) => Promise<Partial<Actor>>;
  resourceType: string;
}
import type { Actor } from "../types/http.js";
import type { Response } from "express";
import {
  actorHasPermission,
  actorHasWorkspaceScope,
} from "../auth/authorizationMiddleware.js";
import { apiLogger, serializeError } from "../logging/logger.js";
import { resolveUserAuthorization } from "../repositories/access/index.js";

export const MAX_REPLICATION_WORKSPACES = 20;

function httpError(
  statusCode: number | undefined,
  code: string | number | undefined,
  message: string | undefined,
) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

export function normalizeReplicationDestinations(
  payload: Record<string, unknown> = {},
  currentWorkspaceId = "",
) {
  const hasBatch = Object.hasOwn(payload, "destinationWorkspaceIds");
  const rawDestinations = hasBatch
    ? payload.destinationWorkspaceIds
    : [payload.destinationWorkspaceId];
  if (!Array.isArray(rawDestinations)) {
    throw httpError(
      422,
      "INVALID_DESTINATION_WORKSPACES",
      "destinationWorkspaceIds deve ser uma lista",
    );
  }
  const destinationWorkspaceIds = [
    ...new Set(
      rawDestinations
        .map((workspaceId) => String(workspaceId || "").trim())
        .filter(Boolean),
    ),
  ];
  if (!destinationWorkspaceIds.length) {
    throw httpError(
      422,
      "DESTINATION_WORKSPACE_REQUIRED",
      "Selecione ao menos um workspace de destino",
    );
  }
  if (destinationWorkspaceIds.length > MAX_REPLICATION_WORKSPACES) {
    throw httpError(
      422,
      "TOO_MANY_DESTINATION_WORKSPACES",
      `Selecione no máximo ${MAX_REPLICATION_WORKSPACES} workspaces`,
    );
  }
  if (destinationWorkspaceIds.includes(String(currentWorkspaceId || ""))) {
    throw httpError(
      422,
      "SAME_WORKSPACE_REPLICATION",
      "Selecione somente workspaces diferentes do atual",
    );
  }
  return { destinationWorkspaceIds, legacyRequest: !hasBatch };
}

function destinationWorkspace(
  actor: Partial<Actor>,
  authorization: Partial<Actor>,
  workspaceId: string,
) {
  return (
    authorization.workspaces?.find(({ id }) => id === workspaceId) ||
    actor.workspaces?.find(({ id }) => id === workspaceId) || {
      id: workspaceId,
      name: workspaceId,
    }
  );
}

function publicReplicationError(
  cause: unknown,
  context: LogFields,
  logger: Logger,
) {
  const error = (isRecord(cause) ? cause : {}) as Partial<Error>;
  const statusCode = Number(error?.statusCode || error?.status) || 500;
  if (statusCode >= 400 && statusCode < 500) {
    return {
      code: error.code || "REPLICATION_REJECTED",
      message: error.message || "A replicação foi recusada",
      statusCode,
      ...(error.requiredPermissions
        ? { requiredPermissions: error.requiredPermissions }
        : {}),
    };
  }
  logger.error("workspace_replication_failed", {
    ...context,
    error: serializeError(error),
  });
  return {
    code: "REPLICATION_FAILED",
    message: "Não foi possível replicar o item neste workspace",
    statusCode: 500,
  };
}

export async function replicateAcrossWorkspaces<C = unknown>({
  actor,
  authorizeDestination,
  forbiddenCode,
  forbiddenMessage,
  logger = apiLogger,
  payload,
  permission,
  replicate,
  resolveAuthorization = resolveUserAuthorization,
  resourceType,
}: ReplicationOptions<C>) {
  const normalized = normalizeReplicationDestinations(
    payload,
    actor.workspaceId || "",
  );
  const results = await Promise.all(
    normalized.destinationWorkspaceIds.map(async (workspaceId) => {
      try {
        const authorization = await resolveAuthorization(
          actor.userId || "",
          workspaceId,
        );
        const destinationActor = { ...actor, ...authorization };
        const workspace = destinationWorkspace(
          actor,
          authorization,
          workspaceId,
        );
        let destinationContext: C | null = null;
        if (authorizeDestination) {
          destinationContext = await authorizeDestination({
            destinationActor,
            destinationWorkspace: workspace,
            destinationWorkspaceId: workspaceId,
          });
        } else if (
          !actorHasPermission(destinationActor, permission || "") ||
          !actorHasWorkspaceScope(destinationActor, permission || "")
        ) {
          const error = httpError(403, forbiddenCode, forbiddenMessage);
          error.requiredPermissions = [permission];
          throw error;
        }
        const replicated = await replicate({
          destinationActor,
          destinationContext,
          destinationWorkspace: workspace,
          destinationWorkspaceId: workspaceId,
        });
        return {
          workspace,
          status: replicated.status || "created",
          ...(replicated.resource ? { resource: replicated.resource } : {}),
          ...(replicated.data ? { data: replicated.data } : {}),
        };
      } catch (error) {
        return {
          workspace:
            actor.workspaces?.find(({ id }) => id === workspaceId) ||
            destinationWorkspace(actor, {}, workspaceId),
          status: "failed",
          data: undefined,
          resource: undefined,
          error: publicReplicationError(
            error,
            {
              actorId: actor.userId,
              destinationWorkspaceId: workspaceId,
              resourceType,
              sourceWorkspaceId: actor.workspaceId,
            },
            logger,
          ),
        };
      }
    }),
  );
  const failed = results.filter(({ status }) => status === "failed").length;
  return {
    ...normalized,
    results,
    summary: {
      total: results.length,
      succeeded: results.length - failed,
      failed,
    },
  };
}

function publicResults(
  results: Awaited<ReturnType<typeof replicateAcrossWorkspaces>>["results"],
) {
  return results.map(({ data, ...result }) => result);
}

export function sendReplicationResponse(
  res: { status(code: number): { json(body: unknown): unknown } },
  batch: Awaited<ReturnType<typeof replicateAcrossWorkspaces>>,
) {
  const results = publicResults(batch.results);
  if (batch.legacyRequest) {
    const first = batch.results[0];
    if (first.status === "failed") {
      const { statusCode, ...error } = first.error!;
      res.status(statusCode).json({ error });
      return;
    }
    res.status(201).json({
      ...(first.data || {}),
      destinationWorkspace: first.workspace,
      results,
      summary: batch.summary,
    });
    return;
  }
  res.status(batch.summary.failed ? 207 : 201).json({
    results,
    summary: batch.summary,
  });
}
