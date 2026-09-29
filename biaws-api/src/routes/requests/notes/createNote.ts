import type { Router, Request, Response } from "express";
import {
  createRequestNote,
  getRequest,
} from "../../../repositories/requests/index.js";
import { requireAllPermissions } from "../../../auth/authorizationMiddleware.js";
import {
  documentId,
  nestedById,
  scopedQuery,
  auditDemand,
  requireDemandDocument,
  asyncHandler,
} from "../helpers.js";

export function registerCreateNote(router: Router) {
  router.post(
    "/:id/notes",
    requireAllPermissions("demands.note.create"),
    asyncHandler(async (req: Request, res: Response) => {
      const query = scopedQuery(req, "demands.note.create");
      const before = requireDemandDocument(
        (await getRequest(req.params.id, query)).request,
      );
      const result = await createRequestNote(req.params.id, req.body, query);
      const added = (requireDemandDocument(result.request).notes || []).find(
        (note) => !nestedById(before.notes, documentId(note)),
      );
      await auditDemand({
        req,
        action: "note_added",
        summary: "Anotação adicionada à melhoria",
        before: null,
        after: added || req.body,
        targetType: "note",
        targetId: documentId(added) || "new",
        targetLabel: added?.content?.slice?.(0, 80),
      });
      res.status(201).json(result);
    }),
  );
}
