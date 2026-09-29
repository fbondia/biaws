import { getCollections } from "../storage.js";
import { actorId, normalizeDocument } from "../support.js";
import { randomUUID } from "node:crypto";
import {
  DEFAULT_WORKSPACE_KEY,
  DEFAULT_WORKSPACE_NAME,
} from "../../../../../shared/index.js";

export async function ensureDefaultWorkspace(actor = {}) {
  const { workspaces } = await getCollections();
  const now = new Date();
  await workspaces.updateOne(
    { key: DEFAULT_WORKSPACE_KEY },
    {
      $setOnInsert: {
        id: randomUUID(),
        key: DEFAULT_WORKSPACE_KEY,
        name: DEFAULT_WORKSPACE_NAME,
        description:
          "Workspace padrão criado pelo bootstrap do Bondia Workspaces.",
        status: "active",
        default: true,
        settings: {},
        createdAt: now,
        createdBy: actorId(actor),
        updatedAt: now,
        updatedBy: actorId(actor),
      },
    },
    { upsert: true },
  );
  return normalizeDocument(
    await workspaces.findOne({ key: DEFAULT_WORKSPACE_KEY }),
  );
}
