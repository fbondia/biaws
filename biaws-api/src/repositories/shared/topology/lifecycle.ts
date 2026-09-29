import { textValue } from "../../../helpers/text.js";
import type { Actor } from "../../../types/http.js";
export function actorId(actor: Partial<Actor>) {
  return String(actor?.userId || actor?.email || "system").trim();
}

type BaseDocumentInput = {
  key: string;
  workspaceId: unknown;
  applicationId?: unknown;
  actor: Partial<Actor>;
  now?: Date;
};

export function createBaseDocument(
  input: BaseDocumentInput & { applicationId: string },
): ReturnType<typeof createBaseDocumentValue> & { applicationId: string };
export function createBaseDocument(input: BaseDocumentInput): ReturnType<typeof createBaseDocumentValue>;
export function createBaseDocument(input: BaseDocumentInput) {
  return createBaseDocumentValue(input);
}

function createBaseDocumentValue({ key, workspaceId, applicationId, actor, now = new Date() }: BaseDocumentInput) {
  return {
    key,
    workspaceId: String(workspaceId),
    ...(applicationId ? { applicationId: textValue(applicationId) } : {}),
    status: "active",
    createdAt: now,
    createdBy: actorId(actor),
    updatedAt: now,
    updatedBy: actorId(actor),
  };
}

export function archiveFields(actor: Partial<Actor>, now = new Date()) {
  return {
    status: "archived",
    archivedAt: now,
    archivedBy: actorId(actor),
    updatedAt: now,
    updatedBy: actorId(actor),
  };
}
