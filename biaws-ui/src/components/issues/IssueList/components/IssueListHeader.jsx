import { ChevronLeft, ChevronRight, Plus, Upload } from "lucide-react";

export function IssueListHeader({
  loading,
  meta,
  onNextPage,
  onOpenCreate,
  onOpenImport,
  onPreviousPage,
  page,
  totalPages,
}) {
  return (
    <div className="tableHeader">
      <div>
        <h2>Chamados e Solicitações</h2>
        <span>
          Página {meta.page || page} de {totalPages}
        </span>
      </div>
      <div className="pagination">
        {onOpenCreate ? (
          <button
            className="primaryButton"
            onClick={onOpenCreate}
            type="button"
          >
            <Plus size={16} />
            Incluir issue
          </button>
        ) : null}
        {onOpenImport ? (
          <button
            className="secondaryButton"
            onClick={onOpenImport}
            type="button"
          >
            <Upload size={16} />
            Importar
          </button>
        ) : null}
        <button
          className="iconButton"
          disabled={loading || page <= 1}
          onClick={onPreviousPage}
          title="Página anterior"
          type="button"
        >
          <ChevronLeft size={18} />
        </button>
        <button
          className="iconButton"
          disabled={loading || page >= totalPages}
          onClick={onNextPage}
          title="Próxima página"
          type="button"
        >
          <ChevronRight size={18} />
        </button>
      </div>
    </div>
  );
}
