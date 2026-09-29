import type { Actor } from "../../types/http.js";
import { diagramsCollection } from "./storage.js";
import { normalizeDiagramPayload, normalizeDiagram } from "./normalization.js";
import { getTopologyDiagram } from "./queries.js";
import { randomUUID } from "node:crypto";
import { actorId } from "../shared/topology/lifecycle.js";
import {
  createCatalogError,
  duplicateKeyError,
} from "../shared/topology/errors.js";
import { requireOperationalApplication } from "../shared/topology/context.js";

export async function createTopologyDiagram(
  applicationId: string | string[],
  payload: Record<string, unknown> = {},
  actor: Partial<Actor> = {},
) {
  const application = await requireOperationalApplication(applicationId, {
    active: true,
  });
  const collection = await diagramsCollection();
  const value = normalizeDiagramPayload(payload);
  const now = new Date();
  const diagram = {
    id: randomUUID(),
    workspaceId: application.workspaceId,
    applicationId: application.id,
    ...value,
    createdAt: now,
    createdBy: actorId(actor),
    updatedAt: now,
    updatedBy: actorId(actor),
  };
  try {
    await collection.insertOne(diagram);
  } catch (error) {
    duplicateKeyError(
      error,
      "TOPOLOGY_DIAGRAM_NAME_CONFLICT",
      "A topology diagram with this name already exists in the application",
    );
  }
  return normalizeDiagram(diagram);
}

export async function updateTopologyDiagram(
  diagramId: string | string[],
  payload: Record<string, unknown> = {},
  actor: Partial<Actor> = {},
) {
  const current = await getTopologyDiagram(diagramId);
  if (!current) {
    throw createCatalogError(
      404,
      "TOPOLOGY_DIAGRAM_NOT_FOUND",
      "Topology diagram not found",
    );
  }
  await requireOperationalApplication(current.applicationId, { active: true });
  const value = normalizeDiagramPayload(payload, current);
  const updatedAt = new Date();
  const collection = await diagramsCollection();
  try {
    await collection.updateOne(
      { id: current.id },
      {
        $set: {
          ...value,
          updatedAt,
          updatedBy: actorId(actor),
        },
      },
    );
  } catch (error) {
    duplicateKeyError(
      error,
      "TOPOLOGY_DIAGRAM_NAME_CONFLICT",
      "A topology diagram with this name already exists in the application",
    );
  }
  return getTopologyDiagram(current.id);
}
