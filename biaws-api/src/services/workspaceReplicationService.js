import {
  actorHasPermission,
  actorHasWorkspaceScope,
} from "../auth/authorizationMiddleware.js";
import { apiLogger, serializeError } from "../logging/logger.js";
import { resolveUserAuthorization } from "../repositories/accessRepository.js";

export const MAX_REPLICATION_WORKSPACES = 20;

function httpError(statusCode, code, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

export function normalizeReplicationDestinations(
  payload = {},
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

function destinationWorkspace(actor, authorization, workspaceId) {
  return (
    authorization.workspaces?.find(({ id }) => id === workspaceId) ||
    actor.workspaces?.find(({ id }) => id === workspaceId) || {
      id: workspaceId,
      name: workspaceId,
    }
  );
}

function publicReplicationError(error, context, logger) {
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

export async function replicateAcrossWorkspaces({
  actor,
  forbiddenCode,
  forbiddenMessage,
  logger = apiLogger,
  payload,
  permission,
  replicate,
  resolveAuthorization = resolveUserAuthorization,
  resourceType,
}) {
  const normalized = normalizeReplicationDestinations(
    payload,
    actor.workspaceId,
  );
  const results = await Promise.all(
    normalized.destinationWorkspaceIds.map(async (workspaceId) => {
      try {
        const authorization = await resolveAuthorization(
          actor.userId,
          workspaceId,
        );
        const destinationActor = { ...actor, ...authorization };
        if (
          !actorHasPermission(destinationActor, permission) ||
          !actorHasWorkspaceScope(destinationActor, permission)
        ) {
          const error = httpError(403, forbiddenCode, forbiddenMessage);
          error.requiredPermissions = [permission];
          throw error;
        }
        const workspace = destinationWorkspace(
          actor,
          authorization,
          workspaceId,
        );
        const replicated = await replicate({
          destinationActor,
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

function publicResults(results) {
  return results.map(({ data, ...result }) => result);
}

export function sendReplicationResponse(res, batch) {
  const results = publicResults(batch.results);
  if (batch.legacyRequest) {
    const first = batch.results[0];
    if (first.status === "failed") {
      const { statusCode, ...error } = first.error;
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
