import {
  deleteEntityAttachment,
  downloadEntityAttachment,
  fetchEntityAttachment,
  updateEntityAttachmentTags,
  uploadEntityAttachments,
} from "../../../../../api.js";
import { FilesPanel } from "../../../../shared/FilesPanel.jsx";
import { normalizedDraft } from "../../model.js";

export function DocumentFilesPanel({
  canCreate,
  canDelete,
  canUpdate,
  draft,
  onChange,
}) {
  function applyDocument(document) {
    onChange(normalizedDraft(document));
  }

  return (
    <div className="dialogForm knowledgeRecordPanel">
      <FilesPanel
        canCreate={canCreate}
        canDelete={canDelete}
        canUpdate={canUpdate}
        files={draft.attachments || []}
        onDelete={async (attachment) => {
          const payload = await deleteEntityAttachment(
            "knowledge/documents",
            draft.id,
            attachment,
          );
          applyDocument(payload.document);
          return payload.deleted;
        }}
        onDownload={(attachment) =>
          downloadEntityAttachment("knowledge/documents", draft.id, attachment)
        }
        onPreview={(attachment) =>
          fetchEntityAttachment("knowledge/documents", draft.id, attachment)
        }
        onUpdateTags={async (attachment, tags) => {
          const payload = await updateEntityAttachmentTags(
            "knowledge/documents",
            draft.id,
            attachment,
            tags,
          );
          applyDocument(payload.document);
        }}
        onUpload={async (files) => {
          const payload = await uploadEntityAttachments(
            "knowledge/documents",
            draft.id,
            files,
          );
          applyDocument(payload.document);
          return payload.uploaded?.length;
        }}
      />
    </div>
  );
}
