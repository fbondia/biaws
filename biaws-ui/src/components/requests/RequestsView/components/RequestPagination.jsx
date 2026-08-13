import { ChevronLeft, ChevronRight, RefreshCw } from "lucide-react";

export function RequestPagination({
  loadCollections,
  loadRequestCollectionItems,
  loadRequests,
  loadSelectedRequest,
  loadingRequests,
  requestMeta,
  setRequestPage,
}) {
  return (
    <div className="requestCollectionPagination">
      <span>
        {requestMeta.total} melhoria(s) · página {requestMeta.page} de{" "}
        {requestMeta.totalPages}
      </span>
      <button
        className="iconButton"
        disabled={loadingRequests || requestMeta.page <= 1}
        onClick={() => setRequestPage((current) => Math.max(1, current - 1))}
        title="Página anterior"
        type="button"
      >
        <ChevronLeft size={16} />
      </button>
      <button
        className="iconButton"
        disabled={loadingRequests || requestMeta.page >= requestMeta.totalPages}
        onClick={() =>
          setRequestPage((current) =>
            Math.min(requestMeta.totalPages, current + 1),
          )
        }
        title="Próxima página"
        type="button"
      >
        <ChevronRight size={16} />
      </button>
      <button
        className="iconButton"
        disabled={loadingRequests}
        onClick={() =>
          void Promise.all([
            loadRequests(),
            loadRequestCollectionItems(),
            loadCollections(),
            loadSelectedRequest(),
          ])
        }
        title="Atualizar melhorias"
        type="button"
      >
        <RefreshCw size={16} />
      </button>
    </div>
  );
}
