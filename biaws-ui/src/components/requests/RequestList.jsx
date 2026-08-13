import {
  ChevronLeft,
  ChevronRight,
  GripVertical,
  LoaderCircle,
  RefreshCw,
} from "lucide-react";
import { useState } from "react";

import {
  normalizeRequestStatus,
  requestStatusLabel,
  requestStatusStyle,
} from "./requestUtils.js";
import { EntityIdentifier } from "../shared/EntityIdentifier/index.jsx";

export function RequestList({
  allowManualOrder,
  hasActiveFilters,
  filteredRequests,
  loadingRequests,
  requestMeta,
  selectedRequestId,
  onMoveRequest,
  onNextPage,
  onPreviousPage,
  onRefresh,
  onSelectRequest,
}) {
  const [draggedRequestId, setDraggedRequestId] = useState("");
  const [dropTargetRequestId, setDropTargetRequestId] = useState("");

  function handleDragStart(event, requestId) {
    if (!allowManualOrder) return;

    setDraggedRequestId(requestId);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", requestId);
  }

  function handleDragEnd() {
    setDraggedRequestId("");
    setDropTargetRequestId("");
  }

  function handleDragOver(event, requestId) {
    if (
      !allowManualOrder ||
      !draggedRequestId ||
      draggedRequestId === requestId
    )
      return;

    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setDropTargetRequestId(requestId);
  }

  function handleDrop(event, targetRequestId) {
    event.preventDefault();

    if (!allowManualOrder) return;

    const requestId =
      event.dataTransfer.getData("text/plain") || draggedRequestId;
    setDraggedRequestId("");
    setDropTargetRequestId("");
    onMoveRequest(requestId, targetRequestId);
  }

  function handleKeyboardMove(event, index, requestId) {
    if (
      !allowManualOrder ||
      !event.altKey ||
      !["ArrowUp", "ArrowDown"].includes(event.key)
    )
      return;

    const targetIndex = event.key === "ArrowUp" ? index - 1 : index + 1;
    const targetRequest = filteredRequests[targetIndex];
    if (!targetRequest) return;

    event.preventDefault();
    onMoveRequest(requestId, targetRequest.id);
  }

  function handleItemKeyDown(event, index, requestId) {
    handleKeyboardMove(event, index, requestId);
    if (event.defaultPrevented) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onSelectRequest(requestId);
    }
  }

  return (
    <aside className="requestListPanel">
      {allowManualOrder ? (
        <span className="srOnly" id="request-reorder-instructions">
          Para reordenar pelo teclado, use Alt mais seta para cima ou Alt mais
          seta para baixo.
        </span>
      ) : null}
      <div className="panelHeader">
        <div>
          <h3>Melhorias</h3>
          <span>
            {loadingRequests
              ? "Carregando registros"
              : `${filteredRequests.length} nesta página · ${requestMeta.total} no total`}
          </span>
        </div>
        <div className="pagination">
          <button
            className="iconButton"
            disabled={loadingRequests || requestMeta.page <= 1}
            onClick={onPreviousPage}
            title="Página anterior"
            type="button"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            className="iconButton"
            disabled={
              loadingRequests || requestMeta.page >= requestMeta.totalPages
            }
            onClick={onNextPage}
            title="Próxima página"
            type="button"
          >
            <ChevronRight size={16} />
          </button>
          <button
            className="iconButton"
            disabled={loadingRequests}
            onClick={onRefresh}
            title="Atualizar melhorias"
            type="button"
          >
            <RefreshCw
              className={loadingRequests ? "spinIcon" : ""}
              size={16}
            />
          </button>
        </div>
      </div>
      <div className="requestList" aria-busy={loadingRequests}>
        {loadingRequests ? (
          <div className="requestLoadingState" role="status">
            <LoaderCircle aria-hidden="true" className="spinIcon" size={24} />
            <span>Carregando melhorias...</span>
          </div>
        ) : null}
        {filteredRequests.map((request, index) => {
          const isSelected = request.id === selectedRequestId;
          const isDragging = request.id === draggedRequestId;
          const isDropTarget = request.id === dropTargetRequestId;
          const requestCode = request.clientCode || "Sem código";
          const requestTitle = request.title || "Sem título";
          const itemClassName = [
            "requestListItem",
            isSelected ? "selectedRequestListItem" : "",
            isDragging ? "draggingRequestListItem" : "",
            isDropTarget ? "dropTargetRequestListItem" : "",
          ]
            .filter(Boolean)
            .join(" ");

          return (
            <article
              aria-label={`${requestCode}: ${requestTitle}`}
              aria-pressed={isSelected}
              aria-describedby={
                allowManualOrder ? "request-reorder-instructions" : undefined
              }
              aria-keyshortcuts={
                allowManualOrder ? "Alt+ArrowUp Alt+ArrowDown" : undefined
              }
              className={itemClassName}
              draggable={allowManualOrder}
              key={request.id}
              onDragEnd={handleDragEnd}
              onDragOver={(event) => handleDragOver(event, request.id)}
              onDragStart={(event) => handleDragStart(event, request.id)}
              onDrop={(event) => handleDrop(event, request.id)}
              onClick={() => onSelectRequest(request.id)}
              onKeyDown={(event) => handleItemKeyDown(event, index, request.id)}
              role="button"
              tabIndex={0}
              title={requestTitle}
            >
              <span className="requestListItemHeader">
                <span className="requestListItemTitle">
                  <GripVertical
                    aria-hidden="true"
                    className="requestListDragHandle"
                    size={16}
                  />
                  <EntityIdentifier
                    fallback="Sem código"
                    label="Código da melhoria"
                    value={request.clientCode}
                  />
                </span>
                <span
                  className="requestStatusChip"
                  style={requestStatusStyle(request.status)}
                >
                  {requestStatusLabel(normalizeRequestStatus(request.status))}
                </span>
                <span className="requestListItemDescription">
                  {request.title}
                </span>
              </span>
            </article>
          );
        })}
        {!loadingRequests && !filteredRequests.length ? (
          <div className="emptyState compactEmpty">
            {hasActiveFilters
              ? "Nenhuma melhoria para os filtros selecionados."
              : "Nenhuma melhoria cadastrada."}
          </div>
        ) : null}
      </div>
    </aside>
  );
}
