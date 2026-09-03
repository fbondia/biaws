import { FolderTree } from "lucide-react";

import { buildJourneyCollectionRows, formatMonth } from "./requestUtils.js";

function JourneyValues({ totals }) {
  return totals.planned || totals.executed ? (
    <>
      {totals.planned ? (
        <span className="requestBillingMatrixChip requestBillingMatrixChipPlanned">
          {totals.planned} previstas
        </span>
      ) : null}
      {totals.executed ? (
        <span className="requestBillingMatrixChip requestBillingMatrixChipBilled">
          {totals.executed} executadas
        </span>
      ) : null}
    </>
  ) : (
    <span className="requestBillingMatrixEmpty">-</span>
  );
}

export function JourneyCalendar({
  collections,
  months,
  requests,
  onSelectRequest,
}) {
  const rows = buildJourneyCollectionRows(collections, requests, months);
  const generalTotals = rows[0]?.totals || { planned: 0, executed: 0 };

  return (
    <div className="requestScheduleBlock">
      <div className="sectionTitleRow">
        <h3>Calendário de jornadas</h3>
        <span>
          {requests.length} melhorias · {months.length} meses ·{" "}
          {generalTotals.planned} previstas · {generalTotals.executed}{" "}
          executadas
        </span>
      </div>

      {requests.length && months.length ? (
        <div className="requestBillingMatrixWrap">
          <div
            className="requestBillingMatrix"
            style={{ "--billing-month-count": months.length + 1 }}
          >
            <div className="requestBillingMatrixHeader requestBillingMatrixDemandHeader">
              Melhoria ou coleção
            </div>
            {months.map((month) => (
              <div className="requestBillingMatrixHeader" key={month}>
                {formatMonth(month)}
              </div>
            ))}
            <div className="requestBillingMatrixHeader">Total</div>

            {rows.flatMap((row) => {
              const rowKey =
                row.kind === "collection"
                  ? `collection:${row.id || "root"}`
                  : `request:${row.request.id}`;
              const label =
                row.kind === "collection" ? (
                  <div
                    className="requestBillingMatrixCollection"
                    key={`${rowKey}:label`}
                    style={{ "--billing-row-depth": row.depth }}
                  >
                    <FolderTree aria-hidden="true" size={14} />
                    <strong>{row.name}</strong>
                    <span>{row.itemCount}</span>
                  </div>
                ) : (
                  <button
                    className="requestBillingMatrixDemand"
                    key={`${rowKey}:label`}
                    onClick={() => onSelectRequest(row.request.id)}
                    style={{ "--billing-row-depth": row.depth }}
                    type="button"
                  >
                    <strong>{row.request.title || "Sem título"}</strong>
                  </button>
                );
              const cellClass =
                row.kind === "collection"
                  ? "requestBillingMatrixCell requestBillingMatrixCollectionCell"
                  : "requestBillingMatrixCell";

              return [
                label,
                ...months.map((month) => (
                  <div className={cellClass} key={`${rowKey}:${month}`}>
                    <JourneyValues totals={row.totals.months[month]} />
                  </div>
                )),
                <div
                  className={`${cellClass} requestBillingMatrixTotalCell`}
                  key={`${rowKey}:total`}
                >
                  <JourneyValues totals={row.totals} />
                </div>,
              ];
            })}
          </div>
        </div>
      ) : (
        <div className="emptyState compactEmpty">
          Nenhuma jornada prevista ou executada.
        </div>
      )}
    </div>
  );
}
