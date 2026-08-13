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

export function RuntimeMonitoringInstructions({
  cliExample,
  curlExample,
  entity,
  options,
  runtimePath,
}) {
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
      {curlExample ? (
        <CopyBlock label="Exemplo com curl" value={curlExample} />
      ) : null}
      {cliExample ? (
        <CopyBlock label="Comando BIAWS CLI" value={cliExample} />
      ) : null}
    </div>
  );
}
