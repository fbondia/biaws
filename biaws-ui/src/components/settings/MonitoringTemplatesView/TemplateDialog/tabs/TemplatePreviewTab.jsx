export function TemplatePreviewTab({
  preview,
  previewSample,
  setPreviewSample,
}) {
  return (
    <section className="monitoringTemplateTabSection">
      <header>
        <h3>Teste do template</h3>
        <p>
          Ajuste uma amostra sanitizada e use “Testar” para executar sem
          registrar uma observação.
        </p>
      </header>
      <div className="monitoringTemplatePreviewGrid">
        <label className="field">
          <span>Amostra sanitizada</span>
          <textarea
            className="monitoringTemplateCode"
            onChange={(event) => setPreviewSample(event.target.value)}
            rows={20}
            spellCheck="false"
            value={previewSample}
          />
        </label>
        <section aria-live="polite" className="monitoringTemplatePreviewResult">
          <strong>Pré-visualização</strong>
          {preview ? (
            <>
              <span
                className={`catalogStatus catalogStatus-${preview.result.status === "healthy" ? "active" : "archived"}`}
              >
                {preview.result.status}
              </span>
              <p>{preview.result.message || "Sem mensagem"}</p>
              <small>
                {preview.matchedRule
                  ? `Regra: ${preview.matchedRule.label}`
                  : "Resultado padrão"}
              </small>
              <pre>{JSON.stringify(preview.diagnostics, null, 2)}</pre>
            </>
          ) : (
            <p>Execute o teste para visualizar o resultado e o diagnóstico.</p>
          )}
        </section>
      </div>
    </section>
  );
}
