import { CheckCircle2, Circle, X } from "lucide-react";

export function RequestChecklistDialog({
  item,
  onClose,
  onUpdateChecklistItem,
}) {
  if (!item) return null;

  return (
    <div className="dialogBackdrop">
      <section
        aria-labelledby="requestChecklistDialogTitle"
        aria-modal="true"
        className="requestChecklistDialog"
        role="dialog"
      >
        <header>
          <div>
            <span>Checklist</span>
            <h3 id="requestChecklistDialogTitle">{item.label}</h3>
          </div>
          <button
            className="iconButton"
            onClick={onClose}
            title="Fechar"
            type="button"
          >
            <X size={18} />
          </button>
        </header>

        <button
          aria-pressed={item.done}
          className={
            item.done
              ? "requestChecklistDialogToggle completedChecklistStatus"
              : "requestChecklistDialogToggle"
          }
          onClick={() => onUpdateChecklistItem(item.label, "done", !item.done)}
          type="button"
        >
          {item.done ? <CheckCircle2 size={18} /> : <Circle size={18} />}
          {item.done ? "Item marcado" : "Item desmarcado"}
        </button>

        <label className="field">
          <span>Data</span>
          <input
            onChange={(event) =>
              onUpdateChecklistItem(item.label, "date", event.target.value)
            }
            type="date"
            value={item.date}
          />
        </label>

        <label className="field requestChecklistDialogComment">
          <span>Comentários</span>
          <textarea
            onChange={(event) =>
              onUpdateChecklistItem(item.label, "comment", event.target.value)
            }
            value={item.comment}
          />
        </label>

        <footer>
          <button className="primaryButton" onClick={onClose} type="button">
            Concluir
          </button>
        </footer>
      </section>
    </div>
  );
}
