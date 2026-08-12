import { Edit3, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";

import { useMessages } from "../../../infrastructure/messages/MessagesProvider.jsx";
import { MarkdownPreview } from "../../shared/MarkdownEditor/index.jsx";
import { formatDate, todayDateValue } from "../requestUtils.js";
import { RequestTaskNoteDialog } from "./RequestTaskNoteDialog.jsx";

function emptyDraft(note = {}) {
  return { date: note.date || todayDateValue(), content: note.content || "" };
}

export function RequestTaskNotesTab({
  taskId,
  notes,
  saving,
  onCreateNote,
  onDeleteNote,
  onUpdateNote,
}) {
  const { confirm } = useMessages();
  const [mode, setMode] = useState("");
  const [editingId, setEditingId] = useState("");
  const [draft, setDraft] = useState(emptyDraft());

  useEffect(() => {
    setMode("");
    setEditingId("");
    setDraft(emptyDraft());
  }, [taskId]);

  async function saveNote() {
    if (!draft.content.trim()) return;
    const payload = { ...draft, content: draft.content.trim() };
    const saved =
      mode === "edit"
        ? await onUpdateNote(editingId, payload)
        : await onCreateNote(payload);
    if (saved !== false) {
      setMode("");
      setEditingId("");
      setDraft(emptyDraft());
    }
  }

  function cancel() {
    setMode("");
    setEditingId("");
    setDraft(emptyDraft());
  }

  function edit(note) {
    setMode("edit");
    setEditingId(note.id);
    setDraft(emptyDraft(note));
  }

  async function remove(noteId) {
    if (
      await confirm({
        message: "Excluir esta nota de execução?",
        tone: "danger",
      })
    )
      await onDeleteNote(noteId);
  }

  return (
    <div className="requestTaskNotesTab">
      <div className="requestTaskNotesHeader">
        <div>
          <h4>Notas de Execução</h4>
          <span>
            Decisões, avanços e observações sobre a execução da tarefa.
          </span>
        </div>
        <button
          className="primaryButton"
          disabled={saving || Boolean(mode)}
          onClick={() => {
            setDraft(emptyDraft());
            setMode("create");
          }}
          type="button"
        >
          <Plus size={16} />
          Incluir nota
        </button>
      </div>

      <div className="requestTaskNotesList">
        {notes.length ? (
          notes.map((note) => (
            <article className="requestTaskNote" key={note.id}>
              <header>
                <strong>{formatDate(note.date)}</strong>
                <div className="requestTaskNoteActions">
                  <button
                    className="secondaryButton"
                    disabled={saving || Boolean(mode)}
                    onClick={() => edit(note)}
                    type="button"
                  >
                    <Edit3 size={15} />
                    Editar
                  </button>
                  <button
                    className="dangerButton"
                    disabled={saving}
                    onClick={() => remove(note.id)}
                    type="button"
                  >
                    <Trash2 size={15} />
                    Excluir
                  </button>
                </div>
              </header>
              <MarkdownPreview value={note.content} />
            </article>
          ))
        ) : (
          <div className="emptyState">Nenhuma nota de execução registrada.</div>
        )}
      </div>

      <RequestTaskNoteDialog
        draft={draft}
        mode={mode}
        onChange={setDraft}
        onClose={cancel}
        onSave={saveNote}
        saving={saving}
      />
    </div>
  );
}
