export function formatMonitoringDate(value) {
  if (!value) return "Sem sinal recebido";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}
