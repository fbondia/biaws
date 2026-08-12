import { CheckCircle2, CopyPlus, RotateCcw, X, XCircle } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import {
  failedReplicationWorkspaceIds,
  replicationTargets,
} from "./replicationModel.js";

function ReplicationResults({ results }) {
  return (
    <div className="replicationResults" role="status">
      {results.map((result) => {
        const failed = result.status === "failed";
        return (
          <div
            className={
              failed
                ? "replicationResult replicationResultFailed"
                : "replicationResult replicationResultSucceeded"
            }
            key={result.workspace.id}
          >
            {failed ? (
              <XCircle aria-hidden="true" size={18} />
            ) : (
              <CheckCircle2 aria-hidden="true" size={18} />
            )}
            <span>
              <strong>{result.workspace.name}</strong>
              <small>
                {failed
                  ? result.error?.message || "Não foi possível replicar"
                  : result.status === "replaced"
                    ? "Configuração substituída"
                    : "Item replicado"}
              </small>
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function ReplicationDialog({
  currentWorkspaceId,
  description,
  eyebrow,
  onClose,
  onReplicate,
  open,
  resourceKey,
  title,
  workspaces = [],
}) {
  const targets = replicationTargets(workspaces, currentWorkspaceId);
  const [selectedWorkspaceIds, setSelectedWorkspaceIds] = useState([]);
  const [replicating, setReplicating] = useState(false);
  const [error, setError] = useState("");
  const [results, setResults] = useState(null);
  const requestVersion = useRef(0);

  useEffect(() => {
    if (!open) return;
    requestVersion.current += 1;
    setSelectedWorkspaceIds([]);
    setReplicating(false);
    setError("");
    setResults(null);
  }, [open, resourceKey]);

  useEffect(
    () => () => {
      requestVersion.current += 1;
    },
    [],
  );

  if (!open) return null;

  function toggleWorkspace(workspaceId) {
    setSelectedWorkspaceIds((current) =>
      current.includes(workspaceId)
        ? current.filter((id) => id !== workspaceId)
        : [...current, workspaceId],
    );
  }

  async function replicate() {
    const version = ++requestVersion.current;
    setReplicating(true);
    setError("");
    try {
      const payload = await onReplicate(selectedWorkspaceIds);
      if (requestVersion.current === version) setResults(payload.results || []);
    } catch (replicationError) {
      if (requestVersion.current === version) {
        setError(replicationError.message);
      }
    } finally {
      if (requestVersion.current === version) setReplicating(false);
    }
  }

  const failedWorkspaceIds = failedReplicationWorkspaceIds(results || []);

  return (
    <div
      className="dialogBackdrop replicationDialogBackdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !replicating) onClose();
      }}
    >
      <section
        aria-label={title}
        aria-modal="true"
        className="replicationDialog"
        role="dialog"
      >
        <header className="replicationDialogHeader">
          <div>
            {eyebrow ? <span>{eyebrow}</span> : null}
            <h2>{title}</h2>
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

        <div className="replicationDialogContent">
          {results ? (
            <ReplicationResults results={results} />
          ) : (
            <>
              <div className="replicationDescription">{description}</div>
              {targets.length ? (
                <fieldset className="replicationWorkspacePicker">
                  <legend>Workspaces de destino</legend>
                  {targets.map((workspace) => (
                    <label key={workspace.id}>
                      <input
                        checked={selectedWorkspaceIds.includes(workspace.id)}
                        disabled={replicating}
                        onChange={() => toggleWorkspace(workspace.id)}
                        type="checkbox"
                      />
                      <span>
                        <strong>{workspace.name}</strong>
                        {workspace.key ? <small>{workspace.key}</small> : null}
                      </span>
                    </label>
                  ))}
                </fieldset>
              ) : (
                <div className="emptyState compactEmpty">
                  Nenhum outro workspace acessível.
                </div>
              )}
              {error ? (
                <div className="errorBox" role="alert">
                  {error}
                </div>
              ) : null}
            </>
          )}
        </div>

        <footer className="replicationDialogFooter">
          {results ? (
            <>
              {failedWorkspaceIds.length ? (
                <button
                  className="secondaryButton"
                  onClick={() => {
                    setSelectedWorkspaceIds(failedWorkspaceIds);
                    setResults(null);
                    setError("");
                  }}
                  type="button"
                >
                  <RotateCcw size={15} /> Repetir falhas
                </button>
              ) : null}
              <button className="primaryButton" onClick={onClose} type="button">
                Concluir
              </button>
            </>
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
                disabled={replicating || !selectedWorkspaceIds.length}
                onClick={() => void replicate()}
                type="button"
              >
                <CopyPlus size={15} />
                {replicating
                  ? "Replicando..."
                  : `Replicar para ${selectedWorkspaceIds.length || 0}`}
              </button>
            </>
          )}
        </footer>
      </section>
    </div>
  );
}
