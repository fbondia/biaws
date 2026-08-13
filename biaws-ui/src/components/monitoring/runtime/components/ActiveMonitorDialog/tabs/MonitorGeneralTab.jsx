import { TextField } from "../../../../../catalog/CatalogEntityDialog/components/Fields.jsx";
import { MonitorFormSection } from "../../ActiveMonitorFields.jsx";

export function MonitorGeneralTab({ draft, update }) {
  return (
    <>
      <MonitorFormSection
        description="Identifique o monitoramento e controle seu estado."
        title="Identificação"
      >
        <TextField
          label="Nome"
          name="name"
          onChange={update}
          required
          value={draft.name}
        />
        <label className="field catalogMonitoringCheck">
          <input
            checked={draft.enabled}
            onChange={(event) => update("enabled", event.target.checked)}
            type="checkbox"
          />
          <span>Monitoramento ativo</span>
        </label>
        <label className="field catalogWideField">
          <span>Descrição</span>
          <textarea
            onChange={(event) => update("description", event.target.value)}
            rows={3}
            value={draft.description}
          />
        </label>
      </MonitorFormSection>
      <MonitorFormSection
        description="Defina a frequência e o limite de cada execução."
        title="Agendamento"
      >
        <TextField
          label="Intervalo (segundos)"
          name="intervalSeconds"
          onChange={update}
          type="number"
          value={draft.intervalSeconds}
        />
        <TextField
          label="Timeout (segundos)"
          name="timeoutSeconds"
          onChange={update}
          type="number"
          value={draft.timeoutSeconds}
        />
      </MonitorFormSection>
    </>
  );
}
