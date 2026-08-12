import { Edit3, Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { useMessages } from "../../../infrastructure/messages/MessagesProvider.jsx";
import { formatDate, todayDateValue } from "../requestUtils.js";
import { MarkdownPreview } from "../../shared/MarkdownEditor/index.jsx";
import { RequestNoteDialog } from "./RequestNoteDialog.jsx";

function draftFromNote(note) {
  return {
    date: note.date || todayDateValue(),
    content: note.content || "",
  };
}

export function RequestNotesTab({
  request,
  saving,
  onCreateNote,
  onDeleteNote,
  onUpdateNote,
}) {
  const { confirm } = useMessages();
  const [mode, setMode] = useState("");
  const [editingNoteId, setEditingNoteId] = useState("");
  const [draft, setDraft] = useState(draftFromNote({}));
  const notes = useMemo(() => request.notes || [], [request.notes]);

  useEffect(() => {
    setMode("");
    setEditingNoteId("");
    setDraft(draftFromNote({}));
  }, [request.id]);

  async function saveNote() {
    if (!draft.content.trim()) return;

    const payload = {
      date: draft.date || todayDateValue(),
      content: draft.content.trim(),
    };
    const saved =
      mode === "edit"
        ? await onUpdateNote(editingNoteId, payload)
        : await onCreateNote(payload);

    if (saved !== false) {
      setMode("");
      setEditingNoteId("");
      setDraft(draftFromNote({}));
    }
  }

  async function removeNote(note) {
    const confirmed = await confirm({
      message: "Excluir esta anotação?",
      tone: "danger",
    });
    if (!confirmed) return;

    await onDeleteNote(note.id);
  }

  function beginCreateNote() {
    setDraft(draftFromNote({}));
    setEditingNoteId("");
    setMode("create");
  }

  function closeDialog() {
    setMode("");
    setEditingNoteId("");
    setDraft(draftFromNote({}));
  }

  function beginEditNote(note) {
    setDraft(draftFromNote(note));
    setEditingNoteId(note.id);
    setMode("edit");
  }

  return (
    <section className="requestPanel">
      <div className="panelHeader">
        <div>
          <h3>Anotações</h3>
          <span>
            Histórico de decisões, pendências e contexto operacional da melhoria
          </span>
        </div>
        <button
          className="primaryButton"
          disabled={saving || Boolean(mode)}
          onClick={beginCreateNote}
          type="button"
        >
          <Plus size={16} />
          Incluir anotação
        </button>
      </div>

      <div className="requestNotesList">
        {notes.length ? (
          notes.map((note) => {
            return (
              <article className="requestNoteItem" key={note.id}>
                <div className="requestNoteRead">
                  <div className="requestNoteReadHeader">
                    <div>
                      <span>Data</span>
                      <strong>{formatDate(note.date)}</strong>
                    </div>
                    <div className="requestNoteActions">
                      <button
                        className="secondaryButton"
                        disabled={saving || Boolean(mode)}
                        onClick={() => beginEditNote(note)}
                        type="button"
                      >
                        <Edit3 size={16} />
                        Editar
                      </button>
                      <button
                        className="dangerButton"
                        disabled={saving}
                        onClick={() => removeNote(note)}
                        type="button"
                      >
                        <Trash2 size={16} />
                        Excluir
                      </button>
                    </div>
                  </div>
                  <div className="requestNoteReadContent">
                    <MarkdownPreview value={note.content} />
                  </div>
                </div>
              </article>
            );
          })
        ) : (
          <div className="emptyState compactEmpty">
            Nenhuma anotação registrada para esta melhoria.
          </div>
        )}
      </div>

      <RequestNoteDialog
        draft={draft}
        mode={mode}
        onChange={setDraft}
        onClose={closeDialog}
        onSave={saveNote}
        saving={saving}
      />
    </section>
  );
}
