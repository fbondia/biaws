import { Save, Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";

import {
  REQUEST_TASK_STATUS_OPTIONS,
  requestTaskStatusLabel,
} from "../requestUtils.js";
import {
  deleteEntityAttachment,
  downloadEntityAttachment,
  fetchEntityAttachment,
  updateEntityAttachmentTags,
  uploadEntityAttachments,
} from "../../../api.js";
import { FilesPanel } from "../../shared/FilesPanel/index.jsx";
import { AuditHistory } from "../../shared/AuditHistory.jsx";
import { MarkdownEditor } from "../../shared/MarkdownEditor/index.jsx";
import { RequestTaskNotesTab } from "./RequestTaskNotesTab.jsx";

const TASK_TABS = [
  { key: "main", label: "Dados principais" },
  { key: "specification", label: "Especificação" },
  { key: "notes", label: "Notas de Execução" },
  { key: "files", label: "Arquivos" },
  { key: "history", label: "Histórico" },
];

export function RequestTaskDialog({
  task,
  request,
  saving,
  onClose,
  onCreateNote,
  onDelete,
  onDeleteNote,
  onRequestUpdated,
  onSave,
  onUpdateNote,
}) {
  const [draft, setDraft] = useState(task);
  const [activeTab, setActiveTab] = useState("main");
  const [validationError, setValidationError] = useState("");

  useEffect(() => {
    setDraft(task);
    setActiveTab("main");
    setValidationError("");
  }, [task?.id]);

  if (!task || !draft) return null;
  const visibleTabs = task.id
    ? TASK_TABS.filter((tab) => tab.key !== "files" || task.code)
    : TASK_TABS.filter(
        (tab) => !["notes", "files", "history"].includes(tab.key),
      );
  const taskTag = String(task.code || "")
    .trim()
    .toLowerCase();
  const taskFiles = (request.attachments || []).filter((attachment) =>
    (attachment.tags || []).some(
      (tag) => String(tag).toLowerCase() === taskTag,
    ),
  );

  function updateField(field, value) {
    setDraft((current) => ({ ...current, [field]: value }));
    setValidationError("");
  }

  function submit() {
    if (!draft.title.trim()) {
      setActiveTab("main");
      setValidationError("Informe o título da tarefa.");
      return;
    }
    if (draft.startDate && draft.endDate && draft.endDate < draft.startDate) {
      setActiveTab("main");
      setValidationError("A data final não pode ser anterior à data inicial.");
      return;
    }

    onSave({
      ...draft,
      code: draft.code.trim(),
      title: draft.title.trim(),
    });
  }

  return (
    <div className="dialogBackdrop">
      <section
        aria-labelledby="requestTaskDialogTitle"
        aria-modal="true"
        className="requestTaskDialog"
        role="dialog"
      >
        <header className="requestTaskDialogHeader">
          <div>
            <span>Tarefa da melhoria</span>
            <h3 id="requestTaskDialogTitle">
              {task.id
                ? [task.code, task.title].filter(Boolean).join(" - ")
                : "Nova tarefa"}
            </h3>
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

        <div className="requestTaskDialogBody">
          <div
            className="detailTabs requestTaskTabs"
            role="tablist"
            aria-label="Dados da tarefa"
          >
            {visibleTabs.map((tab) => (
              <button
                aria-selected={activeTab === tab.key}
                className={
                  activeTab === tab.key
                    ? "detailTab activeDetailTab"
                    : "detailTab"
                }
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                role="tab"
                type="button"
              >
                {tab.label}
              </button>
            ))}
          </div>

          {validationError ? (
            <div className="errorBox requestTaskValidationError" role="alert">
              {validationError}
            </div>
          ) : null}

          {activeTab === "main" ? (
            <div className="requestTaskMainTab">
              <div className="requestTaskFormGrid">
                <label className="field requestTaskCodeField">
                  <span>Código</span>
                  <input
                    disabled={saving}
                    onChange={(event) =>
                      updateField("code", event.target.value)
                    }
                    value={draft.code}
                  />
                </label>
                <label className="field requestTaskTitleField">
                  <span>Título</span>
                  <input
                    autoFocus
                    disabled={saving}
                    onChange={(event) =>
                      updateField("title", event.target.value)
                    }
                    value={draft.title}
                  />
                </label>
                <label className="field">
                  <span>Status</span>
                  <select
                    disabled={saving}
                    onChange={(event) =>
                      updateField("status", event.target.value)
                    }
                    value={draft.status}
                  >
                    {!REQUEST_TASK_STATUS_OPTIONS.includes(draft.status) &&
                    draft.status ? (
                      <option value={draft.status}>
                        {requestTaskStatusLabel(draft.status)} (inativo)
                      </option>
                    ) : null}
                    {REQUEST_TASK_STATUS_OPTIONS.map((status) => (
                      <option key={status} value={status}>
                        {requestTaskStatusLabel(status)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>Data de início</span>
                  <input
                    disabled={saving}
                    onChange={(event) =>
                      updateField("startDate", event.target.value)
                    }
                    type="date"
                    value={draft.startDate}
                  />
                </label>
                <label className="field">
                  <span>Data de fim</span>
                  <input
                    disabled={saving}
                    onChange={(event) =>
                      updateField("endDate", event.target.value)
                    }
                    type="date"
                    value={draft.endDate}
                  />
                </label>
              </div>
              <label className="field">
                <span>Situação</span>
                <textarea
                  disabled={saving}
                  onChange={(event) =>
                    updateField("situation", event.target.value)
                  }
                  placeholder="Descreva em linhas gerais o que precisa ser feito nesta tarefa"
                  rows={4}
                  value={draft.situation}
                />
              </label>
              <label className="field requestTaskMarkdownField requestTaskDescriptionField">
                <span>Descrição</span>
                <MarkdownEditor
                  value={draft.description}
                  onChange={(value) => updateField("description", value)}
                />
              </label>
            </div>
          ) : null}

          {activeTab === "specification" ? (
            <label className="field requestTaskMarkdownField">
              <MarkdownEditor
                value={draft.specification}
                onChange={(value) => updateField("specification", value)}
              />
            </label>
          ) : null}

          {activeTab === "notes" ? (
            <RequestTaskNotesTab
              notes={task.notes || []}
              onCreateNote={(note) => onCreateNote(task.id, note)}
              onDeleteNote={(noteId) => onDeleteNote(task.id, noteId)}
              onUpdateNote={(noteId, note) =>
                onUpdateNote(task.id, noteId, note)
              }
              saving={saving}
              taskId={task.id}
            />
          ) : null}

          {activeTab === "files" ? (
            <FilesPanel
              files={taskFiles}
              onDelete={async (attachment) => {
                const payload = await deleteEntityAttachment(
                  "requests",
                  request.id,
                  attachment,
                );
                onRequestUpdated(payload.request);
                return payload.deleted;
              }}
              onDownload={(attachment) =>
                downloadEntityAttachment("requests", request.id, attachment)
              }
              onPreview={(attachment) =>
                fetchEntityAttachment("requests", request.id, attachment)
              }
              onUpdateTags={async (attachment, tags) => {
                const payload = await updateEntityAttachmentTags(
                  "requests",
                  request.id,
                  attachment,
                  tags,
                );
                onRequestUpdated(payload.request);
              }}
              onUpload={async (files) => {
                const payload = await uploadEntityAttachments(
                  "requests",
                  request.id,
                  files,
                  { tags: [task.code] },
                );
                onRequestUpdated(payload.request);
                return payload.uploaded?.length;
              }}
            />
          ) : null}

          {activeTab === "history" ? (
            <AuditHistory
              entityId={task.id}
              entityType="task"
              refreshKey={task.updatedAt}
            />
          ) : null}
        </div>

        <footer className="requestTaskDialogFooter">
          <div>
            {task.id ? (
              <button
                className="dangerButton"
                disabled={saving}
                onClick={() => onDelete(task)}
                type="button"
              >
                <Trash2 size={16} />
                Excluir
              </button>
            ) : null}
          </div>
          <div>
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
              disabled={saving}
              onClick={submit}
              type="button"
            >
              <Save size={16} />
              Salvar tarefa
            </button>
          </div>
        </footer>
      </section>
    </div>
  );
}
