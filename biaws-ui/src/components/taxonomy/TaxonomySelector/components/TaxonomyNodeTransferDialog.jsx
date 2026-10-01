import { ArrowRightLeft } from "lucide-react";
import { useState } from "react";

export function TaxonomyNodeTransferDialog({ children, destinationNodeId, onClose, onTransfer, sourceNode }) {
  const [submitting, setSubmitting] = useState(false);

  async function submitTransfer(event) {
    event.preventDefault();
    if (!destinationNodeId || submitting) return;

    setSubmitting(true);
    try {
      const transferred = await onTransfer(sourceNode.id, destinationNodeId);
      if (transferred !== false) onClose();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="taxonomyEditBackdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !submitting) onClose();
      }}
    >
      <section
        aria-label="Transferir vínculos de taxonomia"
        aria-modal="true"
        className="taxonomyEditDialog taxonomyTransferDialog"
        role="dialog"
      >
        <header>
          <div>
            <strong>Transferir vínculos de “{sourceNode.label}”</strong>
            <span>
              Selecione o nó de destino. Issues e documentos deixarão de usar a origem; a árvore de taxonomia não será
              alterada.
            </span>
          </div>
        </header>
        <form onSubmit={submitTransfer}>
          <div className="taxonomyTransferSelector">{children}</div>
          <div className="warningBox taxonomyTransferWarning">
            Esta ação altera todos os vínculos existentes no workspace e não pode ser desfeita automaticamente.
          </div>
          <div className="dialogActions">
            <button className="secondaryButton" data-dialog-close disabled={submitting} onClick={onClose} type="button">
              Cancelar
            </button>
            <button className="primaryButton" disabled={!destinationNodeId || submitting} type="submit">
              <ArrowRightLeft size={15} />
              {submitting ? "Transferindo..." : "Transferir vínculos"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
