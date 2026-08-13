import { Pencil, Save } from "lucide-react";
import { useState } from "react";

import {
  deleteEntityAttachment,
  downloadEntityAttachment,
  fetchEntityAttachment,
  updateEntityAttachmentTags,
  updateIssue,
  uploadEntityAttachments,
} from "../../../../api.js";
import { CatalogContextFields } from "../../../catalog/CatalogContextFields/index.jsx";
import { AuditHistory } from "../../../shared/AuditHistory.jsx";
import { FilesPanel } from "../../../shared/FilesPanel/index.jsx";
import { MarkdownPreview } from "../../../shared/MarkdownEditor/index.jsx";
import { IssueDescriptionDialog } from "../../IssueDescriptionDialog.jsx";
import { IssueCommentsTab } from "./IssueCommentsTab.jsx";
import { IssueKnowledgeTab } from "./IssueKnowledgeTab.jsx";

function IssueDescriptionTab({ canEditContext, issue, onIssueUpdated }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ title: "", text: "" });
  const [saving, setSaving] = useState(false);
  const [descriptionError, setDescriptionError] = useState("");

  function openEditor() {
    setDraft({ title: issue.title || "", text: issue.text || "" });
    setDescriptionError("");
    setEditing(true);
  }

  async function saveDescription() {
    setSaving(true);
    setDescriptionError("");
    try {
      const payload = await updateIssue(issue.id, {
        title: draft.title.trim(),
        text: draft.text.trim(),
      });
      await onIssueUpdated?.(payload.issue);
      setEditing(false);
    } catch (saveError) {
      setDescriptionError(saveError.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="detailSection">
      <div className="sectionTitleRow">
        <h3>Descrição</h3>
        {canEditContext ? (
          <button
            className="secondaryButton"
            onClick={openEditor}
            type="button"
          >
            <Pencil size={15} /> Editar descrição
          </button>
        ) : null}
      </div>
      <MarkdownPreview value={issue.text || ""} />
      <IssueDescriptionDialog
        draft={draft}
        error={descriptionError}
        onChange={setDraft}
        onClose={() => setEditing(false)}
        onSave={saveDescription}
        open={editing}
        saving={saving}
      />
    </section>
  );
}

function IssueContextTab({
  applications,
  canEditContext,
  components,
  contextDraft,
  contextError,
  saveContext,
  savingContext,
  setContextDraft,
}) {
  return (
    <section className="detailSection">
      <h3>Aplicação e impacto</h3>
      {contextError ? (
        <div className="errorBox dialogError">{contextError}</div>
      ) : null}
      <CatalogContextFields
        affectedComponentIds={contextDraft.affectedComponentIds}
        applicationId={contextDraft.applicationId}
        applications={applications}
        components={components}
        disabled={!canEditContext || savingContext}
        onChange={setContextDraft}
      />
      {canEditContext ? (
        <div className="catalogContextActions">
          <button
            className="primaryButton"
            disabled={!contextDraft.applicationId || savingContext}
            onClick={saveContext}
            type="button"
          >
            <Save size={16} />{" "}
            {savingContext ? "Salvando..." : "Salvar contexto"}
          </button>
        </div>
      ) : null}
    </section>
  );
}

function IssueFilesTab({ attachments, issue, onIssueUpdated }) {
  return (
    <FilesPanel
      files={attachments}
      onDelete={async (attachment) => {
        const payload = await deleteEntityAttachment(
          "issues",
          issue.id,
          attachment,
        );
        onIssueUpdated?.(payload.issue);
        return payload.deleted;
      }}
      onDownload={(attachment) =>
        downloadEntityAttachment("issues", issue.id, attachment)
      }
      onPreview={(attachment) =>
        fetchEntityAttachment("issues", issue.id, attachment)
      }
      onUpdateTags={async (attachment, tags) => {
        const payload = await updateEntityAttachmentTags(
          "issues",
          issue.id,
          attachment,
          tags,
        );
        onIssueUpdated?.(payload.issue);
      }}
      onUpload={async (files) => {
        const payload = await uploadEntityAttachments(
          "issues",
          issue.id,
          files,
        );
        onIssueUpdated?.(payload.issue);
        return payload.uploaded?.length;
      }}
    />
  );
}

function IssueHistoryTab({ issue }) {
  return (
    <AuditHistory
      entityId={issue.id}
      entityType="issue"
      refreshKey={issue.updatedAt}
    />
  );
}

const TAB_COMPONENTS = {
  comments: IssueCommentsTab,
  context: IssueContextTab,
  description: IssueDescriptionTab,
  files: IssueFilesTab,
  history: IssueHistoryTab,
  kb: IssueKnowledgeTab,
};

export function IssueDetailContent(props) {
  const Component = TAB_COMPONENTS[props.activeTab];
  return Component ? <Component {...props} /> : null;
}
