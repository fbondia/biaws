import { FileSearch, LoaderCircle, RotateCcw } from "lucide-react";

export function SanitizationPreview({
  applicationId,
  busy,
  calculatePreview,
  dropTargetProps,
  isDraggingFiles,
  preview,
  previewFile,
  previewInputRef,
  previewing,
  selectPreviewFiles,
}) {
  return (
    <section className="sanitizationSection sanitizationPreviewSection">
      <div>
        <h3>Pré-visualização</h3>
        <p>Teste as alterações sem salvar nem importar o e-mail.</p>
      </div>
      <div className="sanitizationPreviewToolbar">
        <button
          {...dropTargetProps}
          className={`secondaryButton${isDraggingFiles ? " fileDropTargetActive" : ""}`}
          disabled={busy}
          onClick={() => previewInputRef.current?.click()}
          type="button"
        >
          <FileSearch size={16} />{" "}
          {previewFile
            ? previewFile.name
            : "Arraste um EML ou clique para selecionar"}
        </button>
        <button
          className="primaryButton"
          disabled={!previewFile || !applicationId || previewing}
          onClick={() => calculatePreview()}
          type="button"
        >
          {previewing ? (
            <LoaderCircle className="spinIcon" size={16} />
          ) : (
            <RotateCcw size={16} />
          )}
          Gerar prévia
        </button>
        <input
          accept=".eml,message/rfc822"
          hidden
          onChange={(event) => {
            selectPreviewFiles([...(event.target.files || [])]);
            event.target.value = "";
          }}
          ref={previewInputRef}
          type="file"
        />
      </div>
      {!applicationId ? (
        <span className="fieldHint">
          Selecione a aplicação na tela anterior para gerar a prévia.
        </span>
      ) : null}
      {preview ? <SanitizedEmlPreview preview={preview} /> : null}
    </section>
  );
}

function SanitizedEmlPreview({ preview }) {
  return (
    <div className="sanitizedEmlPreview">
      <div>
        <span>Assunto sanitizado</span>
        <strong>{preview.issue.title}</strong>
      </div>
      <div>
        <span>Corpo sanitizado</span>
        <pre>{preview.issue.text || "Sem conteúdo textual."}</pre>
      </div>
      <span>
        {preview.comments.total} mensagem(ns) · {preview.attachments.length}{" "}
        anexo(s)
      </span>
    </div>
  );
}
