export function TemplateGeneralTab({ draft, update }) {
  return (
    <section className="monitoringTemplateTabSection">
      <header>
        <h3>Identificação</h3>
        <p>Descreva o propósito e o contrato funcional deste template.</p>
      </header>
      <div className="monitoringTemplateTabGrid">
        <label className="field">
          <span>Nome</span>
          <input
            onChange={(event) => update("name", event.target.value)}
            required
            value={draft.name}
          />
        </label>
        <label className="field monitoringTemplateWideField">
          <span>Descrição</span>
          <textarea
            onChange={(event) => update("description", event.target.value)}
            rows={6}
            value={draft.description}
          />
        </label>
        {draft.migratedFromLegacy ? (
          <div className="infoBox monitoringTemplateWideField">
            Esta nova versão parte do contrato unificado. Revise as demais abas
            antes de salvar.
          </div>
        ) : null}
      </div>
    </section>
  );
}
