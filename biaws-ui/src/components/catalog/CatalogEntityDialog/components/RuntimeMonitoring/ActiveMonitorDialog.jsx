import { X } from "lucide-react";
import React from "react";

import { SelectField, TextField } from "../Fields.jsx";
import { useNestedDialogKeyboard } from "./support.jsx";

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

export function ActiveMonitorDialog({
  draft,
  onChange,
  onClose,
  onSave,
  saving,
  templates = [],
}) {
  const update = (name, value) =>
    onChange((current) => ({ ...current, [name]: value }));
  const dialogRef = useNestedDialogKeyboard(onClose, saving);
  return (
    <div className="dialogBackdrop catalogMonitoringNestedBackdrop">
      <section
        aria-labelledby="active-monitor-dialog-title"
        aria-modal="true"
        className="catalogMonitoringDialog"
        ref={dialogRef}
        role="dialog"
      >
        <header>
          <div>
            <span>
              {draft.id ? "Editar monitoramento" : "Novo monitoramento"}
            </span>
            <h2 id="active-monitor-dialog-title">
              {draft.name || "Configurar monitoramento"}
            </h2>
          </div>
          <button
            aria-label="Fechar"
            autoFocus
            className="iconButton"
            disabled={saving}
            onClick={onClose}
            type="button"
          >
            <X size={18} />
          </button>
        </header>
        <div className="catalogMonitoringDialogBody">
          <TextField
            label="Nome"
            name="name"
            onChange={update}
            required
            value={draft.name}
          />
          <div className="catalogMonitoringProviderSummary">
            <span>Provider</span>
            <strong>
              {draft.provider === "rest" ? "API REST" : "Shell Script"}
            </strong>
          </div>
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
          <label className="field catalogWideField">
            <span>Descrição</span>
            <textarea
              onChange={(event) => update("description", event.target.value)}
              rows={2}
              value={draft.description}
            />
          </label>
          {draft.provider === "rest" ? (
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
          ) : (
            <>
              <TextField
                label="ID do script permitido"
                name="shellScriptId"
                onChange={update}
                required
                value={draft.shellScriptId}
              />
              <label className="field catalogWideField">
                <span>Argumentos (um por linha)</span>
                <textarea
                  onChange={(event) =>
                    update("shellArgumentsText", event.target.value)
                  }
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
          )}
          {templates.some(({ versions }) =>
            versions?.some(({ status }) => status === "active"),
          ) ? (
            <label className="field catalogWideField">
              <span>Template de interpretação (opcional)</span>
              <select
                onChange={(event) => {
                  const [templateId = "", templateVersion = ""] =
                    event.target.value.split(":");
                  onChange((current) => ({
                    ...current,
                    templateId,
                    templateVersion,
                  }));
                }}
                value={
                  draft.templateId
                    ? `${draft.templateId}:${draft.templateVersion}`
                    : ""
                }
              >
                <option value="">Sem template</option>
                {templates.flatMap((template) =>
                  (template.versions || [])
                    .filter(({ status }) => status === "active")
                    .map((version) => (
                      <option
                        key={`${template.id}:${version.version}`}
                        value={`${template.id}:${version.version}`}
                      >
                        {template.name} · v{version.version}
                      </option>
                    )),
                )}
              </select>
            </label>
          ) : (
            <>
              <TextField
                label="ID do template (opcional)"
                name="templateId"
                onChange={update}
                value={draft.templateId}
              />
              <TextField
                label="Versão do template"
                name="templateVersion"
                onChange={update}
                value={draft.templateVersion}
              />
            </>
          )}
          <label className="field catalogMonitoringCheck catalogWideField">
            <input
              checked={draft.enabled}
              onChange={(event) => update("enabled", event.target.checked)}
              type="checkbox"
            />
            <span>Monitoramento ativo</span>
          </label>
        </div>
        <footer>
          <button
            className="secondaryButton"
            disabled={saving}
            onClick={onClose}
            type="button"
          >
            Cancelar
          </button>
          <button
            className="primaryButton"
            disabled={saving}
            onClick={onSave}
            type="button"
          >
            {saving ? "Salvando..." : "Salvar monitoramento"}
          </button>
        </footer>
      </section>
    </div>
  );
}
