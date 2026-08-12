import { X } from "lucide-react";

import { MarkdownPreview } from "../shared/MarkdownEditor/index.jsx";

function formatDate(value) {
  if (!value) return "Não informada";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

export function RuntimeProcedureDetailsDialog({
  application: currentApplication,
  applications = [],
  components = [],
  document,
  onClose,
}) {
  const application = [currentApplication, ...applications]
    .filter(Boolean)
    .find(({ id }) => id === document.applicationId);
  const componentNames = (document.affectedComponentIds || []).map(
    (componentId) =>
      components.find(({ id }) => id === componentId)?.name || componentId,
  );

  return (
    <div
      className="dialogBackdrop runtimeProcedureDetailsBackdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        aria-labelledby="runtimeProcedureDetailsTitle"
        aria-modal="true"
        className="runtimeProcedureDetailsDialog"
        role="dialog"
      >
        <header>
          <div>
            <span>Documento relacionado</span>
            <h2 id="runtimeProcedureDetailsTitle">{document.title}</h2>
          </div>
          <button
            aria-label="Fechar"
            className="iconButton"
            onClick={onClose}
            type="button"
          >
            <X size={18} />
          </button>
        </header>
        <div className="runtimeProcedureDetailsBody">
          <section className="runtimeProcedureDetailsSummary">
            <span>Sumário</span>
            <p>{document.summary || "Sumário não informado."}</p>
          </section>
          <div className="runtimeProcedureDetailsMetadata">
            <div>
              <span>Aplicação</span>
              <strong>
                {application?.name || "Conhecimento geral do workspace"}
              </strong>
            </div>
            <div>
              <span>Componentes afetados</span>
              <strong>
                {componentNames.length
                  ? componentNames.join(", ")
                  : "Nenhum componente informado"}
              </strong>
            </div>
            <div>
              <span>Data de criação</span>
              <strong>{formatDate(document.createdAt)}</strong>
            </div>
            <div>
              <span>Última revisão</span>
              <strong>{formatDate(document.updatedAt)}</strong>
            </div>
          </div>
          <section className="runtimeProcedureDetailsContent">
            <span>Conteúdo do documento</span>
            <MarkdownPreview value={document.markdown || ""} />
          </section>
        </div>
        <footer>
          <button className="secondaryButton" onClick={onClose} type="button">
            Fechar
          </button>
        </footer>
      </section>
    </div>
  );
}
