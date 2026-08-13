import { Eye } from "lucide-react";

export function TemplatePreviewTab({
  onPreview,
  preview,
  previewing,
  previewSample,
  saving,
  setPreviewSample,
}) {
  return (
    <section className="monitoringTemplateTabSection">
      <header className="monitoringTemplateTabHeader">
        <div>
          <h3>Teste do template</h3>
          <p>
            Ajuste uma amostra sanitizada e execute o template sem registrar uma
            observação.
          </p>
        </div>
        <button
          className="secondaryButton"
          disabled={saving || previewing}
          onClick={onPreview}
          type="button"
        >
          <Eye size={16} /> {previewing ? "Testando…" : "Testar amostra"}
        </button>
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
          <header className="monitoringTemplatePreviewResultHeader">
            <strong>Pré-visualização</strong>
            {preview ? (
              <span
                className={`catalogStatus monitoringTemplatePreviewStatus catalogStatus-${preview.result.status}`}
              >
                {preview.result.status}
              </span>
            ) : null}
          </header>
          {preview ? (
            <>
              <div className="monitoringTemplatePreviewSummary">
                <span>Mensagem</span>
                <p>{preview.result.message || "Sem mensagem"}</p>
              </div>
              <div className="monitoringTemplatePreviewSummary">
                <span>Regra aplicada</span>
                <p>
                  {preview.matchedRule?.label || "Resultado padrão do template"}
                </p>
              </div>
              <div className="monitoringTemplatePreviewDiagnostics">
                <span>Diagnóstico</span>
                <pre>{JSON.stringify(preview.diagnostics, null, 2)}</pre>
              </div>
            </>
          ) : (
            <div className="monitoringTemplatePreviewPlaceholder">
              <Eye size={22} />
              <p>
                Execute o teste para visualizar o resultado e o diagnóstico.
              </p>
            </div>
          )}
        </section>
      </div>
    </section>
  );
}
