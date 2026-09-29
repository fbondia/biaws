import { homeError } from "../support.js";
import { normalizeHomeWidgets } from "../normalization.js";
import { validateConfiguredApplications } from "./context.js";
import { homeCollection } from "../storage.js";
import type { Actor } from "../../../types/http.js";

export async function saveHomeConfiguration(payload: Record<string, unknown> = {}, actor: Partial<Actor> = {}) {
  const unknown = Object.keys(payload || {}).filter((key: string) => key !== "widgets");
  if (unknown.length) {
    throw homeError(422, "INVALID_HOME_CONFIGURATION", `unknown home fields: ${unknown.join(", ")}`);
  }
  const widgets = normalizeHomeWidgets(payload.widgets, actor);
  await validateConfiguredApplications(widgets, actor);
  const collection = await homeCollection();
  const now = new Date();
  await collection.updateOne(
    { workspaceId: actor.workspaceId, userId: actor.userId },
    {
      $set: { widgets, updatedAt: now, updatedBy: actor.userId },
      $setOnInsert: {
        workspaceId: actor.workspaceId,
        userId: actor.userId,
        createdAt: now,
      },
    },
    { upsert: true },
  );
  return { widgets, customized: true, updatedAt: now };
}
