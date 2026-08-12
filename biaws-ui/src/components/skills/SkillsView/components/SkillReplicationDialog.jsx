import { CopyPlus, X } from "lucide-react";
import { useEffect, useState } from "react";

import { replicateSkill } from "../../../../api.js";

export function SkillReplicationDialog({
  currentWorkspaceId,
  onClose,
  open,
  skillId,
  version,
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
  }, [open, version]);

  if (!open) return null;

  async function replicate() {
    setReplicating(true);
    setError("");
    try {
      setResult(await replicateSkill(skillId, version, destinationWorkspaceId));
    } catch (replicationError) {
      setError(replicationError.message);
    } finally {
      setReplicating(false);
    }
  }

  return (
    <div
      className="dialogBackdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !replicating) onClose();
      }}
    >
      <section
        aria-label="Replicar skill"
        aria-modal="true"
        className="skillDialog skillReplicationDialog"
        role="dialog"
      >
        <header className="skillDialogHeader">
          <div>
            <span>
              {skillId}@{version}
            </span>
            <h2>Replicar skill</h2>
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
        <div className="skillReplicationContent">
          {result ? (
            <div className="successBox" role="status">
              Skill replicada em{" "}
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
                A versão e todos os arquivos serão publicados no destino. A
                cópia será criada na raiz, sem coleção, status ou datas da
                origem. Uma versão já existente não será sobrescrita.
              </p>
              {!targets.length ? (
                <div className="emptyState compactEmpty">
                  Nenhum outro workspace acessível.
                </div>
              ) : null}
              {error ? (
                <div className="skillInlineError" role="alert">
                  {error}
                </div>
              ) : null}
            </>
          )}
        </div>
        <footer className="skillDialogFooter">
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
                <CopyPlus size={15} />
                {replicating ? "Replicando..." : "Replicar"}
              </button>
            </>
          )}
        </footer>
      </section>
    </div>
  );
}
