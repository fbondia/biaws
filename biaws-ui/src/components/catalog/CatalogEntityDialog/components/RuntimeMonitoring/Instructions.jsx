import { Clipboard } from "lucide-react";
import React from "react";

import { EntityIdentifier } from "../../../../shared/EntityIdentifier/index.jsx";

function CopyBlock({ label, value }) {
  const [copied, setCopied] = React.useState(false);
  const [copyError, setCopyError] = React.useState("");
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopyError("");
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopyError("Não foi possível copiar automaticamente.");
    }
  }
  return (
    <section className="catalogMonitoringCommand">
      <header>
        <h3>{label}</h3>
        <button className="secondaryButton" onClick={copy} type="button">
          <Clipboard size={15} /> {copied ? "Copiado" : "Copiar"}
        </button>
      </header>
      <pre>
        <code>{value}</code>
      </pre>
      {copyError ? <small role="alert">{copyError}</small> : null}
    </section>
  );
}

function templateOptions(templates = []) {
  return templates.flatMap((template) =>
    (template.versions || [])
      .filter(({ status }) => status === "active")
      .map((version) => ({
        id: template.id,
        name: template.name,
        version: version.version,
        definition: version.definition,
      })),
  );
}

function templateExamples({ cliExample, curlExample, selected }) {
  if (!selected) return { cli: cliExample, curl: curlExample };
  const sample = selected.definition?.input?.sample || {};
  const reference = { id: selected.id, version: selected.version };
  const signal = {
    signalId: "example:check:1",
    source: "external-monitor",
    templateRef: reference,
    payload: sample,
  };
  const curl = curlExample.replace(
    /--data '[^']*'$/u,
    `--data '${JSON.stringify(signal)}'`,
  );
  const cliLines = cliExample.split("\n").slice(0, 2);
  const cli = [
    ...cliLines,
    `  --source external-monitor --template ${selected.id} \\`,
    `  --template-version ${selected.version} --payload '${JSON.stringify(sample)}'`,
  ].join("\n");
  return { cli, curl };
}

export function RuntimeMonitoringInstructions({
  cliExample,
  curlExample,
  entity,
  options,
  runtimePath,
  templates = [],
}) {
  const versions = templateOptions(templates);
  const [templateKey, setTemplateKey] = React.useState("");
  const selected = versions.find(
    ({ id, version }) => `${id}:${version}` === templateKey,
  );
  const examples = templateExamples({ cliExample, curlExample, selected });
  return (
    <div className="catalogMonitoringInstructions catalogWideField">
      <h3>Referência do runtime</h3>
      <p>
        Use o UUID estável ou o caminho contextual abaixo. Os exemplos contêm
        apenas placeholders de autenticação.
      </p>
      <dl>
        <div>
          <dt>Workspace</dt>
          <dd>
            <EntityIdentifier
              label="Identificador do workspace"
              value={options.workspace?.id}
            />
          </dd>
        </div>
        <div>
          <dt>UUID</dt>
          <dd>
            <EntityIdentifier
              fallback="UUID indisponível"
              label="UUID do runtime"
              value={entity?.id}
            />
          </dd>
        </div>
        <div>
          <dt>Caminho</dt>
          <dd>
            <code>{runtimePath || "Caminho indisponível"}</code>
          </dd>
        </div>
      </dl>
      {versions.length ? (
        <label className="field">
          <span>Template e versão (opcional)</span>
          <select
            onChange={(event) => setTemplateKey(event.target.value)}
            value={templateKey}
          >
            <option value="">Sinal sem template</option>
            {versions.map((template) => (
              <option
                key={`${template.id}:${template.version}`}
                value={`${template.id}:${template.version}`}
              >
                {template.name} · v{template.version}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      {selected ? (
        <div className="infoBox">
          Contrato consultável em{" "}
          <code>
            /api/monitoring/templates/{selected.id}/versions/{selected.version}
            /contract
          </code>
          . Os exemplos usam a amostra JSON declarada pela versão.
        </div>
      ) : null}
      {examples.curl ? (
        <CopyBlock label="Exemplo com curl" value={examples.curl} />
      ) : null}
      {examples.cli ? (
        <CopyBlock label="Comando BIAWS CLI" value={examples.cli} />
      ) : null}
    </div>
  );
}
