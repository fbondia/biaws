import {
  deleteRequestNote,
  getRequest,
} from "../../../repositories/requests/index.js";
import { requireAllPermissions } from "../../../auth/authorizationMiddleware.js";
import {
  nestedById,
  scopedQuery,
  auditDemand,
  asyncHandler,
} from "../helpers.js";

export function registerDeleteNote(router) {
  router.delete(
    "/:id/notes/:noteId",
    requireAllPermissions("demands.note.delete"),
    asyncHandler(async (req, res) => {
      const query = scopedQuery(req, "demands.note.delete");
      const beforeDemand = (await getRequest(req.params.id, query)).request;
      const before = nestedById(beforeDemand.notes, req.params.noteId);
      const result = await deleteRequestNote(
        req.params.id,
        req.params.noteId,
        query,
      );
      await auditDemand({
        req,
        action: "note_deleted",
        summary: "Anotação da melhoria excluída",
        before,
        after: null,
        targetType: "note",
        targetId: req.params.noteId,
      });
      res.json(result);
    }),
  );
}
