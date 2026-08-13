import { useState } from "react";

import { validateMonitoringTemplateVersion } from "../../../../../api.js";
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
      <SelectField
        label="Estado para código diferente de zero"
        name="shellFailureStatus"
        onChange={update}
        options={["unavailable", "degraded", "unknown"]}
        value={draft.shellFailureStatus}
      />
      <SelectField
        label="Captura de saída"
        name="shellCaptureOutput"
        onChange={update}
        options={["none", "stdout", "stderr", "both"]}
        value={draft.shellCaptureOutput}
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
  const selectedVersion = selectedTemplate?.versions?.find(
    ({ version }) => String(version) === String(draft.templateVersion),
  );
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
      {selectedVersion ? (
        <TemplateContractPanel
          key={`${draft.templateId}:${draft.templateVersion}`}
          template={selectedTemplate}
          version={selectedVersion}
        />
      ) : null}
    </>
  );
}

function TemplateContractPanel({ template, version }) {
  const definition = version.definition || template.definition || {};
  const [sampleText, setSampleText] = useState(
    JSON.stringify(definition.input?.sample || {}, null, 2),
  );
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [testing, setTesting] = useState(false);

  async function testSample() {
    setTesting(true);
    setError("");
    setResult(null);
    try {
      const sample = JSON.parse(sampleText);
      const payload = await validateMonitoringTemplateVersion(
        template.id,
        version.version,
        sample,
      );
      setResult(payload.validation.result);
    } catch (testError) {
      setError(testError.message || "A resposta JSON não é válida.");
    } finally {
      setTesting(false);
    }
  }

  return (
    <section className="catalogMonitorTemplateContract catalogWideField">
      <header>
        <strong>Contrato esperado</strong>
        <code>
          {template.id}/{version.version}
        </code>
      </header>
      <p>
        {definition.presentation?.label ||
          template.description ||
          "Template JSONata"}
      </p>
      <small>
        Saída: status, message e{" "}
        {definition.output?.metadata?.fields?.length || 0} campo(s) de metadata.
      </small>
      <label className="field">
        <span>Testar resposta JSON sanitizada</span>
        <textarea
          className="monitoringTemplateCode"
          onChange={(event) => setSampleText(event.target.value)}
          rows={7}
          spellCheck="false"
          value={sampleText}
        />
      </label>
      <button
        className="secondaryButton"
        disabled={testing}
        onClick={testSample}
        type="button"
      >
        {testing ? "Testando…" : "Testar sem salvar"}
      </button>
      {result ? (
        <div className="infoBox" role="status">
          Resultado: <strong>{result.status}</strong>
          {result.message ? ` · ${result.message}` : ""}
        </div>
      ) : null}
      {error ? (
        <div className="errorBox" role="alert">
          {error}
        </div>
      ) : null}
    </section>
  );
}
