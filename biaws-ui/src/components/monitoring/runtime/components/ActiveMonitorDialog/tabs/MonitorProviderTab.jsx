import {
  MonitorFormSection,
  RestMonitorFields,
  ShellMonitorFields,
} from "../../ActiveMonitorFields.jsx";

export function MonitorProviderTab({ draft, rest, update }) {
  return (
    <MonitorFormSection
      description={
        rest
          ? "Configure a requisição e os critérios básicos da resposta."
          : "Informe somente scripts previamente permitidos no executor."
      }
      title={rest ? "Requisição REST" : "Execução do script"}
    >
      {rest ? (
        <RestMonitorFields draft={draft} update={update} />
      ) : (
        <ShellMonitorFields draft={draft} update={update} />
      )}
    </MonitorFormSection>
  );
}
