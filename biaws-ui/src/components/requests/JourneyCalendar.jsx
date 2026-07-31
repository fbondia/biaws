import { formatMonth } from "./requestUtils.js";

export function JourneyCalendar({ months, requests, onSelectRequest }) {
  return (
    <div className="requestScheduleBlock">
      <div className="sectionTitleRow">
        <h3>Calendário de jornadas</h3>
        <span>
          {requests.length} melhorias · {months.length} meses
        </span>
      </div>

      {requests.length && months.length ? (
        <div className="requestBillingMatrixWrap">
          <div
            className="requestBillingMatrix"
            style={{ "--billing-month-count": months.length }}
          >
            <div className="requestBillingMatrixHeader requestBillingMatrixDemandHeader">
              Melhoria
            </div>
            {months.map((month) => (
              <div className="requestBillingMatrixHeader" key={month}>
                {formatMonth(month)}
              </div>
            ))}

            {requests.flatMap((request) => {
              const journeysByMonth = new Map(
                request.journeys.map((item) => [item.month, item]),
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
                  const item = journeysByMonth.get(month);
                  const planned = Number(item?.plannedJourneys) || 0;
                  const executed = Number(item?.executedJourneys) || 0;

                  return (
                    <div
                      className="requestBillingMatrixCell"
                      key={`${request.id}:${month}`}
                    >
                      {planned || executed ? (
                        <>
                          {planned ? (
                            <span className="requestBillingMatrixChip requestBillingMatrixChipPlanned">
                              {planned} previstas
                            </span>
                          ) : null}
                          {executed ? (
                            <span className="requestBillingMatrixChip requestBillingMatrixChipBilled">
                              {executed} executadas
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
          Nenhuma jornada prevista ou executada.
        </div>
      )}
    </div>
  );
}
