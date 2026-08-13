import { Plus, Save, X } from "lucide-react";
import { useState } from "react";

import { createIssue } from "../../api.js";
import { STATUS_OPTIONS, TYPE_OPTIONS } from "../../constants/issues.js";
import { CatalogContextFields } from "../catalog/CatalogContextFields/index.jsx";
import { MarkdownEditor } from "../shared/MarkdownEditor/index.jsx";

function today() {
  return new Date().toISOString().slice(0, 10);
}

function initialDraft() {
  return {
    title: "",
    text: "",
    type: TYPE_OPTIONS.find((option) => option.value)?.value || "",
    status: STATUS_OPTIONS.find((option) => option.value)?.value || "",
    date: today(),
    applicationId: "",
    affectedComponentIds: [],
    comment: "",
  };
}

export function CreateIssueDialog({
  applications = [],
  components = [],
  onClose,
  onCreated,
}) {
  const [draft, setDraft] = useState(initialDraft);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function update(field, value) {
    setDraft((current) => ({ ...current, [field]: value }));
  }

  async function save() {
    if (!draft.title.trim() || !draft.text.trim() || !draft.applicationId)
      return;
    setSaving(true);
    setError("");
    try {
      const issuePayload = {
        ...draft,
        title: draft.title.trim(),
        text: draft.text.trim(),
      };
      const comment = draft.comment.trim();
      if (comment) issuePayload.comment = comment;
      else delete issuePayload.comment;
      const payload = await createIssue(issuePayload);
      await onCreated?.(payload);
      onClose();
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="dialogBackdrop issueFormDialogBackdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !saving) onClose();
      }}
      role="presentation"
    >
      <section
        aria-labelledby="createIssueDialogTitle"
        aria-modal="true"
        className="issueFormDialog"
        role="dialog"
      >
        <header className="issueFormDialogHeader">
          <div>
            <span>Registro manual</span>
            <h2 id="createIssueDialogTitle">Incluir issue</h2>
          </div>
          <button
            className="iconButton"
            disabled={saving}
            onClick={onClose}
            title="Fechar"
            type="button"
          >
            <X size={18} />
          </button>
        </header>

        <div className="issueFormDialogBody">
          {error ? (
            <div className="errorBox" role="alert">
              {error}
            </div>
          ) : null}
          <div className="issueFormGrid">
            <label className="field issueFormTitleField">
              <span>Título</span>
              <input
                autoFocus
                disabled={saving}
                onChange={(event) => update("title", event.target.value)}
                value={draft.title}
              />
            </label>
            <label className="field">
              <span>Tipo</span>
              <select
                disabled={saving}
                onChange={(event) => update("type", event.target.value)}
                value={draft.type}
              >
                {TYPE_OPTIONS.filter((option) => option.value).map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Status</span>
              <select
                disabled={saving}
                onChange={(event) => update("status", event.target.value)}
                value={draft.status}
              >
                {STATUS_OPTIONS.filter((option) => option.value).map(
                  (option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ),
                )}
              </select>
            </label>
            <label className="field">
              <span>Data</span>
              <input
                disabled={saving}
                onChange={(event) => update("date", event.target.value)}
                type="date"
                value={draft.date}
              />
            </label>
          </div>

          <CatalogContextFields
            affectedComponentIds={draft.affectedComponentIds}
            applicationId={draft.applicationId}
            applications={applications}
            components={components}
            disabled={saving}
            onChange={(context) =>
              setDraft((current) => ({ ...current, ...context }))
            }
          />

          <label className="field issueFormMarkdownField">
            <span>Descrição</span>
            <MarkdownEditor
              onChange={(value) => update("text", value)}
              value={draft.text}
            />
          </label>
          <label className="field issueFormMarkdownField">
            <span>Comentário inicial (opcional)</span>
            <MarkdownEditor
              onChange={(value) => update("comment", value)}
              value={draft.comment}
            />
          </label>
        </div>

        <footer className="issueFormDialogFooter">
          <button
            className="secondaryButton"
            disabled={saving}
            onClick={onClose}
            type="button"
          >
            Cancelar
          </button>
          <button
            className="primaryButton"
            disabled={
              saving ||
              !draft.title.trim() ||
              !draft.text.trim() ||
              !draft.applicationId
            }
            onClick={save}
            type="button"
          >
            {saving ? <Save size={16} /> : <Plus size={16} />}
            {saving ? "Salvando..." : "Incluir issue"}
          </button>
        </footer>
      </section>
    </div>
  );
}
