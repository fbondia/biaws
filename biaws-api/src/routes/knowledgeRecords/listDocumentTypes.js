import { DOCUMENT_TYPE_CATALOG } from "../../../../shared/documentTypes.js";
import { requireAllPermissions } from "../../auth/authorizationMiddleware.js";

export function registerListDocumentTypes(router) {
  router.get(
    "/document-types",
    requireAllPermissions("documents.read"),
    (req, res) => {
      res.json({ documentTypes: Object.values(DOCUMENT_TYPE_CATALOG) });
    },
  );
}
