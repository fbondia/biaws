import { getCollections } from "./storage.js";
import { accessFilter } from "./filters.js";
import { secretError } from "./support.js";
import { publicSecret } from "./normalization.js";
import type { SecretContent, SecretDocument } from "../../types/secrets.js";
import type { Actor, AuthorizationScope } from "../../types/http.js";
import type { UpdateFilter } from "mongodb";

export async function addSecretVersion(
  current: SecretDocument,
  { locator, actor, content }: { locator: string; actor: Actor; content: SecretContent },
  authorizationScope: AuthorizationScope,
) {
  const { secrets } = await getCollections();
  const version = (Number(current.currentVersion) || 0) + 1;
  const now = new Date();
  const document = await secrets.findOneAndUpdate(
    {
      id: current.id,
      ...accessFilter(authorizationScope),
      status: "active",
      currentVersion: current.currentVersion,
    },
    {
      $set: {
        currentVersion: version,
        provider: current.provider || "local",
        provisioningStatus: "ready",
        updatedAt: now,
        updatedBy: actor.userId,
      },
      $push: {
        versions: {
          version,
          locator,
          kind: content?.kind || current.contentKind || "text",
          ...(content?.kind === "file"
            ? {
                fileName: content.fileName,
                mediaType: content.mediaType,
                size: content.size,
              }
            : { size: content?.size }),
          createdAt: now,
          createdBy: actor.userId,
        },
      },
    } as unknown as UpdateFilter<SecretDocument>,
    { returnDocument: "after" },
  );
  if (!document) {
    throw secretError(409, "SECRET_VERSION_CONFLICT", "The secret changed while the new version was being stored");
  }
  return publicSecret(document);
}
