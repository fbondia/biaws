export function TemplateContractTab({ draft, update }) {
  return (
    <section className="monitoringTemplateTabSection">
      <header>
        <h3>Contrato e apresentação</h3>
        <p>
          Defina os metadados produzidos e como eles serão apresentados na UI.
        </p>
      </header>
      <div className="monitoringTemplateEditorGrid">
        <label className="field">
          <span>Contrato JSON da saída</span>
          <textarea
            className="monitoringTemplateCode"
            onChange={(event) => update("outputText", event.target.value)}
            rows={20}
            spellCheck="false"
            value={draft.outputText}
          />
        </label>
        <label className="field">
          <span>Apresentação dos campos e séries</span>
          <textarea
            className="monitoringTemplateCode"
            onChange={(event) => update("presentationText", event.target.value)}
            rows={20}
            spellCheck="false"
            value={draft.presentationText}
          />
        </label>
      </div>
    </section>
  );
}
