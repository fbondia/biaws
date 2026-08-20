import { History, LoaderCircle, Play } from "lucide-react";

export function MonitoringExecutionButton({
  className = "secondaryButton",
  disabled = false,
  iconSize = 16,
  onExecute,
  runtime,
}) {
  return (
    <button
      aria-label={`Executar monitor de ${runtime.name}`}
      className={className}
      disabled={disabled}
      onClick={() => onExecute(runtime)}
      title="Executar monitor agora"
      type="button"
    >
      {disabled ? (
        <LoaderCircle className="spinIcon" size={iconSize} />
      ) : (
        <Play size={iconSize} />
      )}
    </button>
  );
}

export function MonitoringHistoryButton({
  className = "secondaryButton",
  iconSize = 18,
  onOpenHistory,
  runtime,
}) {
  return (
    <button
      aria-label={`Abrir histórico de ${runtime.name}`}
      className={className}
      onClick={() => onOpenHistory(runtime)}
      type="button"
    >
      <History size={iconSize} />
    </button>
  );
}
