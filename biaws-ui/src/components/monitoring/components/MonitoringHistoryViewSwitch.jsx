import { ChartNoAxesCombined, List } from "lucide-react";

import "../../../styles/features/monitoring-history.css";

export function MonitoringHistoryViewSwitch({ onChange, value }) {
  return (
    <div
      aria-label="Visualização do histórico"
      className="monitoringHistoryViewSwitch"
      role="group"
    >
      <button
        aria-pressed={value === "list"}
        onClick={() => onChange("list")}
        type="button"
      >
        <List size={16} /> Lista
      </button>
      <button
        aria-pressed={value === "timeline"}
        onClick={() => onChange("timeline")}
        type="button"
      >
        <ChartNoAxesCombined size={16} /> Gráfico
      </button>
    </div>
  );
}
