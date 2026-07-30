import { formatMonth } from "./requestUtils.js";

export function BillingCalendar({ months, requests, onSelectRequest }) {
  return (
    <div className="requestScheduleBlock">
      <div className="sectionTitleRow">
        <h3>Calendário de faturamento</h3>
        <span>
          {requests.length} demandas · {months.length} meses
        </span>
      </div>

      {requests.length && months.length ? (
        <div className="requestBillingMatrixWrap">
          <div
            className="requestBillingMatrix"
            style={{ "--billing-month-count": months.length }}
          >
            <div className="requestBillingMatrixHeader requestBillingMatrixDemandHeader">
              Demanda
            </div>
            {months.map((month) => (
              <div className="requestBillingMatrixHeader" key={month}>
                {formatMonth(month)}
              </div>
            ))}

            {requests.flatMap((request) => {
              const billingByMonth = new Map(
                request.billing.map((item) => [item.month, item]),
              );

              return [
                <button
                  className="requestBillingMatrixDemand"
                  key={`${request.id}:demand`}
                  onClick={() => onSelectRequest(request.id)}
                  type="button"
                >
                  <strong>{request.title || "Sem título"}</strong>
                </button>,
                ...months.map((month) => {
                  const item = billingByMonth.get(month);
                  const planned = Number(item?.plannedJourneys) || 0;
                  const billed = Number(item?.billedJourneys) || 0;

                  return (
                    <div
                      className="requestBillingMatrixCell"
                      key={`${request.id}:${month}`}
                    >
                      {planned || billed ? (
                        <>
                          {planned ? (
                            <span className="requestBillingMatrixChip requestBillingMatrixChipPlanned">
                              {planned} previstos
                            </span>
                          ) : null}
                          {billed ? (
                            <span className="requestBillingMatrixChip requestBillingMatrixChipBilled">
                              {billed} faturados
                            </span>
                          ) : null}
                        </>
                      ) : (
                        <span className="requestBillingMatrixEmpty">-</span>
                      )}
                    </div>
                  );
                }),
              ];
            })}
          </div>
        </div>
      ) : (
        <div className="emptyState compactEmpty">
          Nenhum faturamento previsto ou realizado.
        </div>
      )}
    </div>
  );
}
