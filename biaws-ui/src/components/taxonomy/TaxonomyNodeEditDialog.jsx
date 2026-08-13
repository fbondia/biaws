import { Trash2 } from "lucide-react";

function toggleApplicationId(current, applicationId, checked) {
  if (!checked) return [...current, applicationId];
  return current.filter((id) => id !== applicationId);
}

export function TaxonomyNodeEditDialog({
  applications,
  canDeleteNodes,
  editApplicationIds,
  editLabel,
  editNode,
  editScopeMode,
  onClose,
  onDelete,
  setEditApplicationIds,
  setEditLabel,
  setEditScopeMode,
}) {
  return (
    <div
      className="taxonomyEditBackdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        aria-label="Editar assunto"
        aria-modal="true"
        className="taxonomyEditDialog taxonomyNodeEditDialog"
        role="dialog"
      >
        <header>
          <div>
            <strong>Editar assunto</strong>
            <span>Altere o título e onde este item pode ser utilizado.</span>
          </div>
        </header>
        <form onSubmit={editNode}>
          <label className="field">
            <span>Título</span>
            <input
              autoFocus
              onChange={(event) => setEditLabel(event.target.value)}
              value={editLabel}
            />
          </label>
          <fieldset className="taxonomyApplicationScope">
            <legend>Aplicável a</legend>
            <label className="taxonomyScopeOption">
              <input
                checked={editScopeMode === "workspace"}
                name="taxonomy-scope"
                onChange={() => setEditScopeMode("workspace")}
                type="radio"
              />
              <span>
                <strong>Todas as aplicações</strong>
                <small>
                  O item fica disponível em todo o workspace, respeitando o
                  escopo do item superior.
                </small>
              </span>
            </label>
            <label className="taxonomyScopeOption">
              <input
                checked={editScopeMode === "applications"}
                name="taxonomy-scope"
                onChange={() => setEditScopeMode("applications")}
                type="radio"
              />
              <span>
                <strong>Aplicações específicas</strong>
                <small>Selecione uma ou mais aplicações abaixo.</small>
              </span>
            </label>
            {editScopeMode === "applications" ? (
              <div className="taxonomyApplicationList">
                {applications.length ? (
                  applications.map((application) => {
                    const checked = editApplicationIds.includes(application.id);
                    return (
                      <label key={application.id}>
                        <input
                          checked={checked}
                          onChange={() =>
                            setEditApplicationIds((current) =>
                              toggleApplicationId(
                                current,
                                application.id,
                                checked,
                              ),
                            )
                          }
                          type="checkbox"
                        />
                        <span>{application.name || application.id}</span>
                        {application.status !== "active" ? (
                          <small>Arquivada</small>
                        ) : null}
                      </label>
                    );
                  })
                ) : (
                  <span className="fieldHint">
                    Nenhuma aplicação cadastrada no workspace.
                  </span>
                )}
              </div>
            ) : null}
          </fieldset>
          <div className="dialogActions">
            {canDeleteNodes ? (
              <button
                className="dangerButton taxonomyDeleteNodeButton"
                onClick={onDelete}
                type="button"
              >
                <Trash2 size={15} />
                Excluir nó
              </button>
            ) : null}
            <button
              className="secondaryButton"
              data-dialog-close
              onClick={onClose}
              type="button"
            >
              Cancelar
            </button>
            <button
              className="primaryButton"
              disabled={
                !editLabel.trim() ||
                (editScopeMode === "applications" && !editApplicationIds.length)
              }
              type="submit"
            >
              Salvar
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
