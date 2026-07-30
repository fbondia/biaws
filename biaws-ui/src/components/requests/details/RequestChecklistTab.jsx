import { CheckCircle2, Circle } from "lucide-react";

import { formatDate, requestChecklistLabel } from "../requestUtils.js";

export function RequestChecklistTab({ request, onToggleChecklistItem }) {
  return (
    <section className="requestPanel">
      <div className="panelHeader">
        <div>
          <h3>Checklist</h3>
          <span>
            {request.checklist.filter((item) => item.done).length} de{" "}
            {request.checklist.length} itens concluídos
          </span>
        </div>
      </div>

      <div className="requestChecklist">
        {request.checklist.map((item) => (
          <div className="requestChecklistItem" key={item.label}>
            <button
              aria-pressed={item.done}
              className={
                item.done
                  ? "requestChecklistToggle completedChecklistStatus"
                  : "requestChecklistToggle"
              }
              onClick={() => onToggleChecklistItem(item)}
              type="button"
            >
              {item.done ? <CheckCircle2 size={18} /> : <Circle size={18} />}
              <strong>{requestChecklistLabel(item.label)}</strong>
            </button>
            <div className="requestReadOnlyValue">
              <span>Data</span>
              <strong>{formatDate(item.date)}</strong>
            </div>
            <div className="requestReadOnlyValue">
              <span>Comentários</span>
              <strong>{item.comment || "-"}</strong>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
