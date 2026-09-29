import type { Router, Request, Response } from "express";
import { getRequest, updateRequestNote } from "../../../repositories/requests/index.js";
import { requireAllPermissions } from "../../../auth/authorizationMiddleware.js";
import { nestedById, scopedQuery, auditDemand, requireDemandDocument, asyncHandler } from "../helpers.js";

export function registerReplaceNote(router: Router) {
  router.put(
    "/:id/notes/:noteId",
    requireAllPermissions("demands.note.update"),
    asyncHandler(async (req: Request, res: Response) => {
      const query = scopedQuery(req, "demands.note.update");
      const beforeDemand = requireDemandDocument((await getRequest(req.params.id, query)).request);
      const before = nestedById(beforeDemand.notes, req.params.noteId);
      const result = await updateRequestNote(req.params.id, req.params.noteId, req.body, query);
      const after = nestedById(requireDemandDocument(result.request).notes, req.params.noteId);
      await auditDemand({
        req,
        action: "note_updated",
        summary: "Anotação da melhoria atualizada",
        before,
        after,
        targetType: "note",
        targetId: req.params.noteId,
      });
      res.json(result);
    }),
  );
}
