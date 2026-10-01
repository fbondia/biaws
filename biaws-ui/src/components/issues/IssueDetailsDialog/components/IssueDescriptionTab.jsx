import { Pencil, Save } from "lucide-react";
import { useState } from "react";

import { updateIssue } from "../../../../api.js";
import { MarkdownEditor, MarkdownPreview } from "../../../shared/MarkdownEditor/index.jsx";
import { IssueDescriptionDialog } from "../../IssueDescriptionDialog.jsx";

export function IssueDescriptionTab({
  attachments,
  canEditContext,
  classificationDraft,
  hasSummaryChanges,
  issue,
  onIssueUpdated,
  onLoadAttachment,
  saveSummary,
  savingClassification,
  savingSummary,
  summaryError,
  summaryMessage,
  updateKbSummary,
}) {
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
    <>
      <section className="detailSection issueSummarySection">
        <h3>Resumo</h3>
        {summaryError ? <div className="errorBox dialogError">{summaryError}</div> : null}
        {summaryMessage ? <div className="infoBox">{summaryMessage}</div> : null}
        {hasSummaryChanges ? <div className="warningBox">Há alterações de resumo ainda não salvas.</div> : null}
        <MarkdownEditor
          ariaLabel="Resumo"
          attachments={attachments}
          onChange={updateKbSummary}
          onLoadAttachment={onLoadAttachment}
          value={classificationDraft.summary}
        />
        <div className="dialogActions">
          <button
            className="primaryButton"
            disabled={savingSummary || savingClassification || !hasSummaryChanges || !issue.id}
            onClick={saveSummary}
            type="button"
          >
            <Save size={16} /> {savingSummary ? "Salvando..." : "Salvar resumo"}
          </button>
        </div>
      </section>
      <section className="detailSection">
        <div className="sectionTitleRow">
          <h3>Descrição completa</h3>
          {canEditContext ? (
            <button className="secondaryButton" onClick={openEditor} type="button">
              <Pencil size={15} /> Editar descrição
            </button>
          ) : null}
        </div>
        <MarkdownPreview attachments={attachments} onLoadAttachment={onLoadAttachment} value={issue.text || ""} />
        <IssueDescriptionDialog
          attachments={attachments}
          draft={draft}
          error={descriptionError}
          onChange={setDraft}
          onClose={() => setEditing(false)}
          onLoadAttachment={onLoadAttachment}
          onSave={saveDescription}
          open={editing}
          saving={saving}
        />
      </section>
    </>
  );
}
