import { FileDown, FileText, X } from "lucide-react";

import { replicateDocument } from "../../../../../api.js";
import { ReplicationDialog } from "../../../../shared/ReplicationDialog.jsx";

export function DocumentExportDialog({
  onClose,
  onExportMarkdown,
  onExportPdf,
  open,
}) {
  if (!open) return null;
  return (
    <div
      className="tagFilterDialogBackdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        aria-label="Exportar documento"
        aria-modal="true"
        className="tagFilterDialog knowledgeDocumentActionDialog"
        role="dialog"
      >
        <header>
          <div>
            <strong>Exportar documento</strong>
            <span>Escolha o formato que deseja gerar.</span>
          </div>
          <button
            aria-label="Fechar exportação"
            className="iconButton"
            data-dialog-close
            onClick={onClose}
            type="button"
          >
            <X size={18} />
          </button>
        </header>
        <div className="knowledgeDocumentActionOptions">
          <button
            className="knowledgeDocumentActionOption"
            onClick={() => {
              onExportMarkdown();
              onClose();
            }}
            type="button"
          >
            <FileText size={24} />
            <span>
              <strong>Markdown</strong>
              <small>Baixa o conteúdo original em um arquivo .md.</small>
            </span>
          </button>
          <button
            className="knowledgeDocumentActionOption"
            onClick={() => {
              onExportPdf();
              onClose();
            }}
            type="button"
          >
            <FileDown size={24} />
            <span>
              <strong>PDF</strong>
              <small>Abre a versão diagramada para salvar como PDF.</small>
            </span>
          </button>
        </div>
      </section>
    </div>
  );
}

export function DocumentReplicationDialog({
  currentWorkspaceId,
  documentId,
  onClose,
  open,
  workspaces,
}) {
  return (
    <ReplicationDialog
      currentWorkspaceId={currentWorkspaceId}
      description={
        <p>
          O identificador localiza o documento correspondente em cada destino.
          Se ele existir, somente título, resumo e conteúdo serão substituídos;
          tipo, contexto e histórico locais serão preservados. Se não existir,
          uma nova cópia será criada sem contexto local.
        </p>
      }
      onClose={onClose}
      onReplicate={(destinationWorkspaceIds) =>
        replicateDocument(documentId, destinationWorkspaceIds)
      }
      open={open}
      resourceKey={documentId}
      title="Replicar documento"
      workspaces={workspaces}
    />
  );
}
