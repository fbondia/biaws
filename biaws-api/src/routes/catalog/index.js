import { Router } from "express";
import { registerListWorkspaces } from "./listWorkspaces.js";
import { registerGetWorkspace } from "./workspaces/getWorkspace.js";
import { registerListWorkspacesApplications } from "./workspaces/listWorkspacesApplications.js";
import { registerCreateWorkspacesApplication } from "./workspaces/createWorkspacesApplication.js";
import { registerGetApplication } from "./applications/getApplication.js";
import { registerUpdateApplicationsCollection } from "./applications/updateApplicationsCollection.js";
import { registerUpdateApplication } from "./applications/updateApplication.js";
import { registerUpdateApplicationsArchive } from "./applications/updateApplicationsArchive.js";
import { registerUpdateApplicationsRestore } from "./applications/updateApplicationsRestore.js";
import { registerDeleteApplicationsPermanent } from "./applications/deleteApplicationsPermanent.js";
import { requireWorkspaceContext } from "../../auth/authenticationMiddleware.js";

export const catalogRouter = Router();
registerListWorkspaces(catalogRouter);

catalogRouter.use(requireWorkspaceContext);
registerGetWorkspace(catalogRouter);
registerListWorkspacesApplications(catalogRouter);
registerCreateWorkspacesApplication(catalogRouter);
registerGetApplication(catalogRouter);
registerUpdateApplicationsCollection(catalogRouter);
registerUpdateApplication(catalogRouter);
registerUpdateApplicationsArchive(catalogRouter);
registerUpdateApplicationsRestore(catalogRouter);
registerDeleteApplicationsPermanent(catalogRouter);
