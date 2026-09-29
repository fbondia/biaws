import { getCollections } from "./storage.js";
import { secretError } from "./support.js";

export async function assertApplication(applicationId: string | null, workspaceId: string) {
  if (!applicationId) return;
  const { applications } = await getCollections();
  const exists = await applications.countDocuments({ id: applicationId, workspaceId, status: "active" }, { limit: 1 });
  if (!exists) {
    throw secretError(
      422,
      "INVALID_SECRET_APPLICATION",
      "applicationId must reference an active application in the workspace",
    );
  }
}
