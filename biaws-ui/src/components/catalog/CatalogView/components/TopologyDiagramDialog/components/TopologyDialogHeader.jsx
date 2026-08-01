import { X } from "lucide-react";

export function TopologyDialogHeader({ applicationName, onClose, saving }) {
  return (
    <header>
      <div>
        <span>Topologia gráfica</span>
        <h2 id="topology-diagram-title">{applicationName}</h2>
      </div>
      <button
        aria-label="Fechar visualização"
        className="iconButton"
        disabled={saving}
        onClick={onClose}
        type="button"
      >
        <X size={18} />
      </button>
    </header>
  );
}
