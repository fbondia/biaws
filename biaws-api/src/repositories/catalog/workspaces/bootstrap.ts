import type { Actor } from "../../../types/http.js";
import type { WorkspaceDocument } from "../../../types/catalog.js";
import { getCollections } from "../storage.js";
import { actorId, normalizeDocument } from "../support.js";
import { randomUUID } from "node:crypto";
import { DEFAULT_WORKSPACE_KEY, DEFAULT_WORKSPACE_NAME } from "../../../../../shared/index.js";

export async function ensureDefaultWorkspace(actor: Partial<Actor> = {}) {
  const { workspaces } = await getCollections();
  const now = new Date();
  await workspaces.updateOne(
    { key: DEFAULT_WORKSPACE_KEY },
    {
      $setOnInsert: {
        id: randomUUID(),
        key: DEFAULT_WORKSPACE_KEY,
        name: DEFAULT_WORKSPACE_NAME,
        description: "Workspace padrão criado pelo bootstrap do Bondia Workspaces.",
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
  const workspace = await workspaces.findOne({ key: DEFAULT_WORKSPACE_KEY });
  if (!workspace) throw new Error("Default workspace was not found after bootstrap");
  return normalizeDocument(workspace) as WorkspaceDocument;
}
