export function TemplateTransformTab({ draft, update }) {
  return (
    <section className="monitoringTemplateTabSection">
      <header>
        <h3>Transformação JSONata</h3>
        <p>
          Documente a entrada esperada e transforme-a no resultado normalizado.
        </p>
      </header>
      <div className="monitoringTemplateEditorGrid">
        <label className="field">
          <span>Amostra JSON de entrada</span>
          <textarea
            className="monitoringTemplateCode"
            onChange={(event) => update("inputSampleText", event.target.value)}
            rows={18}
            spellCheck="false"
            value={draft.inputSampleText}
          />
          <small>
            JSON sanitizado usado como documentação e teste padrão da versão.
          </small>
        </label>
        <label className="field">
          <span>Expressão JSONata</span>
          <textarea
            className="monitoringTemplateCode"
            onChange={(event) => update("expression", event.target.value)}
            rows={18}
            spellCheck="false"
            value={draft.expression}
          />
          <small>Produza um objeto com status, message e metadata.</small>
        </label>
      </div>
    </section>
  );
}
