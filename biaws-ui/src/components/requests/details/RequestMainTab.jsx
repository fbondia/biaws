import { Trash2 } from "lucide-react";

import {
  formatDate,
  normalizeRequestStatus,
  requestStatusLabel,
  requestStatusStyle,
  REQUEST_STATUS_OPTIONS,
} from "../requestUtils.js";
import { CatalogContextDialogField } from "../../catalog/CatalogContextFields.jsx";

export function RequestMainTab({
  request,
  isEditing,
  savingRequestId,
  onDelete,
  onFieldChange,
  onBeginNumberDraft,
  onUpdateNumberDraft,
  onClearNumberDraft,
  onReadDraftedNumber,
  onCommitEstimatedJourneys,
  onContextChange,
  applications = [],
  components = [],
}) {
  return (
    <>
      <section className="requestPanel">
        <div className="panelHeader">
          <div>
            <h3>Dados da melhoria</h3>
            <span>
              {request.clientCode || "Código do cliente não informado"}
            </span>
          </div>
        </div>

        {isEditing ? (
          <>
            <CatalogContextDialogField
              affectedComponentIds={request.affectedComponentIds}
              applicationId={request.applicationId}
              applications={applications}
              components={components}
              onChange={onContextChange}
            />
            <div className="requestFormGrid">
              <label className="field requestCodeField">
                <span>Código da melhoria</span>
                <input
                  onChange={(event) =>
                    onFieldChange("clientCode", event.target.value)
                  }
                  placeholder="Código do cliente"
                  type="text"
                  value={request.clientCode}
                />
              </label>
              <label className="field requestTitleField">
                <span>Título</span>
                <input
                  onChange={(event) =>
                    onFieldChange("title", event.target.value)
                  }
                  type="text"
                  value={request.title}
                />
              </label>
              <label className="field requestMetaField">
                <span>Jornadas estimadas</span>
                <input
                  min="0"
                  onBlur={(event) =>
                    onCommitEstimatedJourneys(event.target.value)
                  }
                  onChange={(event) =>
                    onUpdateNumberDraft("estimatedJourneys", event.target.value)
                  }
                  onFocus={() =>
                    onBeginNumberDraft(
                      "estimatedJourneys",
                      request.estimatedJourneys,
                    )
                  }
                  onKeyDown={(event) => {
                    if (event.key === "Enter") event.currentTarget.blur();
                    if (event.key === "Escape")
                      onClearNumberDraft("estimatedJourneys");
                  }}
                  step="0.5"
                  type="number"
                  value={onReadDraftedNumber(
                    "estimatedJourneys",
                    request.estimatedJourneys,
                  )}
                />
              </label>
              <label className="field requestStatusField">
                <span>Status</span>
                <select
                  onChange={(event) =>
                    onFieldChange("status", event.target.value)
                  }
                  value={normalizeRequestStatus(request.status)}
                >
                  {!REQUEST_STATUS_OPTIONS.includes(request.status) &&
                  request.status ? (
                    <option value={request.status}>
                      {requestStatusLabel(request.status)} (inativo)
                    </option>
                  ) : null}
                  {REQUEST_STATUS_OPTIONS.map((status) => (
                    <option key={status} value={status}>
                      {requestStatusLabel(status)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field requestMetaField">
                <span>Prazo estimado</span>
                <input
                  onChange={(event) =>
                    onFieldChange("estimatedDeliveryDate", event.target.value)
                  }
                  type="date"
                  value={request.estimatedDeliveryDate}
                />
              </label>
              <label className="field requestMetaField">
                <span>Início</span>
                <input
                  onChange={(event) =>
                    onFieldChange("startDate", event.target.value)
                  }
                  type="date"
                  value={request.startDate}
                />
              </label>
              <label className="field requestMetaField">
                <span>Fim</span>
                <input
                  onChange={(event) =>
                    onFieldChange("endDate", event.target.value)
                  }
                  type="date"
                  value={request.endDate}
                />
              </label>
            </div>
          </>
        ) : (
          <div className="requestDetailsGrid">
            <div className="requestDetailCard requestMetaField">
              <span>Aplicação</span>
              <strong>
                {applications.find(({ id }) => id === request.applicationId)
                  ?.name ||
                  request.applicationId ||
                  "-"}
              </strong>
            </div>
            <div className="requestDetailCard requestCodeField">
              <span>Código da melhoria</span>
              <strong>{request.clientCode || "-"}</strong>
            </div>
            <div className="requestDetailCard requestDetailTitle">
              <span>Título</span>
              <strong>{request.title || "-"}</strong>
            </div>
            <div className="requestDetailCard requestStatusField">
              <span>Status</span>
              <strong>
                <span
                  className="requestStatusChip"
                  style={requestStatusStyle(request.status)}
                >
                  {requestStatusLabel(normalizeRequestStatus(request.status))}
                </span>
              </strong>
            </div>
            <div className="requestDetailCard requestMetaField">
              <span>Prazo estimado</span>
              <strong>{formatDate(request.estimatedDeliveryDate)}</strong>
            </div>
            <div className="requestDetailCard requestMetaField">
              <span>Início</span>
              <strong>{formatDate(request.startDate)}</strong>
            </div>
            <div className="requestDetailCard requestMetaField">
              <span>Fim</span>
              <strong>{formatDate(request.endDate)}</strong>
            </div>
            <div className="requestDetailCard requestMetaField">
              <span>Jornadas estimadas</span>
              <strong>{Number(request.estimatedJourneys) || 0}</strong>
            </div>
          </div>
        )}
      </section>

      <section className="requestPanel">
        <div className="panelHeader">
          <div>
            <h3>Descrição</h3>
            <span>Escopo e contexto da melhoria</span>
          </div>
        </div>

        {isEditing ? (
          <label className="field requestDescriptionField">
            <span>Descrição</span>
            <textarea
              onChange={(event) =>
                onFieldChange("description", event.target.value)
              }
              value={request.description}
            />
          </label>
        ) : (
          <div className="requestLongText">
            {request.description || "Descrição não informada."}
          </div>
        )}
      </section>

      {isEditing ? (
        <div className="requestDeleteActions">
          <button
            className="dangerButton"
            disabled={savingRequestId === request.id}
            onClick={onDelete}
            type="button"
          >
            <Trash2 size={16} />
            Excluir melhoria
          </button>
        </div>
      ) : null}
    </>
  );
}
