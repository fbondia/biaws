import {
  requireAllPermissions,
  requireApplicationAccess,
} from "../../../auth/authorizationMiddleware.js";
import { listTopologyDiagrams } from "../../../repositories/topologyDiagrams/index.js";
import { asyncHandler } from "../helpers.js";

export function registerListApplicationsTopologyDiagrams(router) {
  router.get(
    "/applications/:applicationId/topology-diagrams",
    requireAllPermissions("applications.read"),
    requireApplicationAccess("applications.read"),
    asyncHandler(async (req, res) => {
      res.json(await listTopologyDiagrams(req.params.applicationId, req.query));
    }),
  );
}
