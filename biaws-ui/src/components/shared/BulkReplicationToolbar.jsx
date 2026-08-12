import { CopyPlus, X } from "lucide-react";

export function BulkReplicationToolbar({
  canReplicate,
  count,
  onClear,
  onReplicate,
}) {
  if (!count) return null;

  return (
    <div
      aria-label="Ações dos itens selecionados"
      className="bulkReplicationToolbar"
      role="group"
    >
      <button
        className="primaryButton"
        disabled={!canReplicate}
        onClick={onReplicate}
        title={
          canReplicate
            ? undefined
            : "Nenhum outro workspace acessível para replicação"
        }
        type="button"
      >
        <CopyPlus aria-hidden="true" size={16} /> Replicar
      </button>
      <span aria-live="polite">
        {count} {count === 1 ? "item selecionado" : "itens selecionados"}
      </span>
      <button
        aria-label="Limpar seleção"
        className="iconButton bulkReplicationClearButton"
        onClick={onClear}
        title="Limpar seleção"
        type="button"
      >
        <X aria-hidden="true" size={15} />
      </button>
    </div>
  );
}
