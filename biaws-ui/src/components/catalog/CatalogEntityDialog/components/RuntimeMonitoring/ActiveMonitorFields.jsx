import { SelectField, TextField } from "../Fields.jsx";
import { selectableMonitoringTemplates } from "../../runtimeMonitoringModel.js";

function JsonField({ label, name, onChange, rows = 4, value }) {
  return (
    <label className="field catalogWideField">
      <span>{label}</span>
      <textarea
        name={name}
        onChange={(event) => onChange(name, event.target.value)}
        rows={rows}
        value={value}
      />
    </label>
  );
}

export function MonitorFormSection({ children, description, title }) {
  return (
    <section className="catalogMonitorFormSection catalogWideField">
      <header>
        <h3>{title}</h3>
        {description ? <p>{description}</p> : null}
      </header>
      <div className="catalogMonitorFormSectionGrid">{children}</div>
    </section>
  );
}

export function RestMonitorFields({ draft, update }) {
  return (
    <>
      <SelectField
        label="Método"
        name="restMethod"
        onChange={update}
        options={["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE"]}
        required
        value={draft.restMethod}
      />
      <TextField
        className="catalogMonitoringUrlField"
        label="URL HTTP(S), sem credenciais"
        name="restUrl"
        onChange={update}
        required
        type="url"
        value={draft.restUrl}
      />
      <TextField
        label="Status esperados (separados por vírgula)"
        name="restExpectedStatusesText"
        onChange={update}
        value={draft.restExpectedStatusesText}
      />
      <label className="field catalogMonitoringCheck">
        <input
          checked={draft.restFollowRedirects}
          onChange={(event) =>
            update("restFollowRedirects", event.target.checked)
          }
          type="checkbox"
        />
        <span>Seguir redirecionamentos permitidos</span>
      </label>
      <JsonField
        label="Headers públicos (JSON)"
        name="restHeadersText"
        onChange={update}
        value={draft.restHeadersText}
      />
      <JsonField
        label="Headers secretos por referência (lista JSON)"
        name="restHeaderRefsText"
        onChange={update}
        value={draft.restHeaderRefsText}
      />
      <JsonField
        label="Corpo opcional"
        name="restBody"
        onChange={update}
        value={draft.restBody}
      />
    </>
  );
}

export function ShellMonitorFields({ draft, update }) {
  return (
    <>
      <TextField
        className="catalogWideField"
        label="ID do script permitido"
        name="shellScriptId"
        onChange={update}
        required
        value={draft.shellScriptId}
      />
      <label className="field catalogWideField">
        <span>Argumentos (um por linha)</span>
        <textarea
          onChange={(event) => update("shellArgumentsText", event.target.value)}
          rows={4}
          value={draft.shellArgumentsText}
        />
      </label>
      <JsonField
        label="Ambiente permitido (JSON)"
        name="shellEnvironmentText"
        onChange={update}
        value={draft.shellEnvironmentText}
      />
    </>
  );
}

export function TemplateFields({ draft, onChange, templates }) {
  const availableTemplates = selectableMonitoringTemplates(templates, {
    id: draft.templateId,
    version: draft.templateVersion,
  });
  const selectedTemplate = availableTemplates.find(
    ({ id }) => id === draft.templateId,
  );
  const hasTemplates = availableTemplates.length > 0;
  return (
    <>
      <label className="field">
        <span>Template (opcional)</span>
        <select
          disabled={!hasTemplates}
          name="templateId"
          onChange={(event) =>
            onChange((current) => ({
              ...current,
              templateId: event.target.value,
              templateVersion: "",
            }))
          }
          value={draft.templateId}
        >
          <option value="">
            {hasTemplates ? "Sem template" : "Nenhum template disponível"}
          </option>
          {availableTemplates.map((template) => (
            <option key={template.id} value={template.id}>
              {template.name}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>Versão</span>
        <select
          disabled={!selectedTemplate}
          name="templateVersion"
          onChange={(event) =>
            onChange((current) => ({
              ...current,
              templateVersion: event.target.value,
            }))
          }
          value={draft.templateVersion}
        >
          <option value="">
            {selectedTemplate ? "Selecione a versão" : "Selecione um template"}
          </option>
          {(selectedTemplate?.versions || []).map((version) => (
            <option key={version.version} value={version.version}>
              v{version.version}
              {version.status === "active" ? "" : " (versão atual)"}
            </option>
          ))}
        </select>
      </label>
      {!hasTemplates ? (
        <small className="catalogMonitorTemplateEmpty catalogWideField">
          Ative um template na administração para associá-lo ao monitoramento.
        </small>
      ) : null}
    </>
  );
}
