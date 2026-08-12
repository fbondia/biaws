import { FileDown, FileText, X } from "lucide-react";
import { useEffect, useState } from "react";

import { replicateDocument } from "../../../../../api.js";

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
  const targets = workspaces.filter(({ id }) => id !== currentWorkspaceId);
  const [destinationWorkspaceId, setDestinationWorkspaceId] = useState("");
  const [replicating, setReplicating] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  useEffect(() => {
    if (!open) return;
    setDestinationWorkspaceId("");
    setError("");
    setResult(null);
  }, [open]);

  if (!open) return null;

  async function replicate() {
    setReplicating(true);
    setError("");
    try {
      const payload = await replicateDocument(
        documentId,
        destinationWorkspaceId,
      );
      setResult(payload);
    } catch (replicationError) {
      setError(replicationError.message);
    } finally {
      setReplicating(false);
    }
  }

  return (
    <div
      className="tagFilterDialogBackdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !replicating) onClose();
      }}
    >
      <section
        aria-label="Replicar documento"
        aria-modal="true"
        className="tagFilterDialog knowledgeDocumentActionDialog"
        role="dialog"
      >
        <header>
          <div>
            <strong>Replicar documento</strong>
            <span>Crie uma cópia limpa em outro workspace.</span>
          </div>
          <button
            aria-label="Fechar replicação"
            className="iconButton"
            data-dialog-close
            disabled={replicating}
            onClick={onClose}
            type="button"
          >
            <X size={18} />
          </button>
        </header>
        <div className="knowledgeReplicationContent">
          {result ? (
            <div className="successBox" role="status">
              Documento replicado em{" "}
              <strong>{result.destinationWorkspace?.name}</strong>.
            </div>
          ) : (
            <>
              <label className="field">
                <span>Workspace de destino</span>
                <select
                  disabled={replicating || !targets.length}
                  onChange={(event) =>
                    setDestinationWorkspaceId(event.target.value)
                  }
                  value={destinationWorkspaceId}
                >
                  <option value="">Selecione...</option>
                  {targets.map((workspace) => (
                    <option key={workspace.id} value={workspace.id}>
                      {workspace.name}
                    </option>
                  ))}
                </select>
              </label>
              <p>
                A cópia levará somente tipo, título, resumo e conteúdo. Ela será
                criada sem coleção, aplicação, componentes, classificações, tags
                ou referências.
              </p>
              {!targets.length ? (
                <div className="emptyState compactEmpty">
                  Nenhum outro workspace acessível.
                </div>
              ) : null}
              {error ? (
                <div className="errorBox" role="alert">
                  {error}
                </div>
              ) : null}
            </>
          )}
        </div>
        <footer>
          {result ? (
            <button className="primaryButton" onClick={onClose} type="button">
              Concluir
            </button>
          ) : (
            <>
              <button
                className="secondaryButton"
                disabled={replicating}
                onClick={onClose}
                type="button"
              >
                Cancelar
              </button>
              <button
                className="primaryButton"
                disabled={replicating || !destinationWorkspaceId}
                onClick={() => void replicate()}
                type="button"
              >
                {replicating ? "Replicando..." : "Replicar"}
              </button>
            </>
          )}
        </footer>
      </section>
    </div>
  );
}
