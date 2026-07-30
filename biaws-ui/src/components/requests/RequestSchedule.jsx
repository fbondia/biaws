import {
  formatDate,
  formatMonth,
  normalizeRequestStatus,
  requestGanttStatusStyle,
  requestStatusLabel,
  requestStatusStyle,
} from "./requestUtils.js";

const DAY_MS = 24 * 60 * 60 * 1000;

export function RequestSchedule({ requests, onSelectRequest }) {
  const ganttItems = requests.map(toGanttItem).filter(Boolean);
  const timeline = buildGanttTimeline(ganttItems);

  return (
    <div className="requestScheduleBlock">
      <div className="sectionTitleRow">
        <h3>Demandas e prazos</h3>
        <span>{ganttItems.length} demandas com datas</span>
      </div>

      {timeline ? (
        <div className="requestGanttWrap">
          <div
            className="requestGantt"
            style={{
              "--gantt-min-width": `${Math.max(760, timeline.months.length * 112 + 240)}px`,
            }}
          >
            <div className="requestGanttHeader">
              <div className="requestGanttDemandHeader">Demanda</div>
              <div className="requestGanttTimelineHeader">
                {timeline.months.map((month) => (
                  <span
                    className="requestGanttMonth"
                    key={month.key}
                    style={{ left: `${month.left}%`, width: `${month.width}%` }}
                  >
                    {formatMonth(month.key)}
                  </span>
                ))}
              </div>
            </div>

            {ganttItems.map((item) => {
              const left = timelinePercent(timeline, item.barStart);
              const width = Math.min(
                100 - left,
                Math.max(
                  1.5,
                  timelineWidth(timeline, item.barStart, item.barEnd),
                ),
              );
              const deadlineLeft = item.deadline
                ? timelinePercent(timeline, item.deadline)
                : null;

              return (
                <div className="requestGanttRow" key={item.request.id}>
                  <button
                    className="requestGanttDemand"
                    onClick={() => onSelectRequest(item.request.id)}
                    type="button"
                  >
                    <strong>{item.request.title || "Sem título"}</strong>
                    <span
                      className="requestStatusChip"
                      style={requestStatusStyle(item.request.status)}
                    >
                      {requestStatusLabel(
                        normalizeRequestStatus(item.request.status),
                      )}
                    </span>
                  </button>

                  <button
                    className="requestGanttTimeline"
                    onClick={() => onSelectRequest(item.request.id)}
                    title={ganttItemTitle(item)}
                    type="button"
                  >
                    <span
                      className="requestGanttBar"
                      style={{
                        ...requestGanttStatusStyle(item.request.status),
                        left: `${left}%`,
                        width: `${width}%`,
                      }}
                    >
                      <span>{item.barLabel}</span>
                    </span>
                    {deadlineLeft === null ? null : (
                      <span
                        className="requestGanttDeadline"
                        style={{ left: `${deadlineLeft}%` }}
                        title={`Prazo ${formatDate(item.request.estimatedDeliveryDate)}`}
                      />
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="emptyState compactEmpty">
          Nenhuma demanda com datas para exibir no cronograma.
        </div>
      )}
    </div>
  );
}

function parseScheduleDate(value) {
  const [year, month, day] = String(value || "")
    .split("-")
    .map(Number);
  if (!year || !month || !day) return null;

  const date = new Date(Date.UTC(year, month - 1, day));
  return Number.isNaN(date.getTime()) ? null : date;
}

function toDateKey(date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function toMonthKey(date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");

  return `${year}-${month}`;
}

function startOfMonth(date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function endOfMonth(date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0));
}

function toGanttItem(request) {
  const start = parseScheduleDate(request.startDate);
  const end = parseScheduleDate(request.endDate);
  const deadline = parseScheduleDate(request.estimatedDeliveryDate);
  const barStart = start || end || deadline;
  const barEnd = end || deadline || start;

  if (!barStart || !barEnd) return null;

  const normalizedStart = barStart <= barEnd ? barStart : barEnd;
  const normalizedEnd = barStart <= barEnd ? barEnd : barStart;

  return {
    request,
    barStart: normalizedStart,
    barEnd: normalizedEnd,
    deadline,
    barLabel: `${formatDate(toDateKey(normalizedStart))} até ${formatDate(toDateKey(normalizedEnd))}`,
  };
}

function buildGanttTimeline(items) {
  const dates = items
    .flatMap((item) => [item.barStart, item.barEnd, item.deadline])
    .filter(Boolean);
  if (!dates.length) return null;

  const minDate = new Date(Math.min(...dates.map((date) => date.getTime())));
  const maxDate = new Date(Math.max(...dates.map((date) => date.getTime())));
  const start = startOfMonth(minDate);
  const end = endOfMonth(maxDate);
  const totalDays = Math.max(
    1,
    Math.round((end.getTime() - start.getTime()) / DAY_MS) + 1,
  );
  const months = [];
  let cursor = startOfMonth(start);

  while (cursor <= end) {
    const monthStart = new Date(cursor);
    const monthEnd = endOfMonth(cursor);
    const visibleStart = monthStart < start ? start : monthStart;
    const visibleEnd = monthEnd > end ? end : monthEnd;
    const left =
      ((visibleStart.getTime() - start.getTime()) / DAY_MS / totalDays) * 100;
    const width =
      (((visibleEnd.getTime() - visibleStart.getTime()) / DAY_MS + 1) /
        totalDays) *
      100;

    months.push({
      key: toMonthKey(cursor),
      left,
      width,
    });
    cursor = new Date(
      Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1),
    );
  }

  return { start, end, totalDays, months };
}

function timelinePercent(timeline, date) {
  const days = Math.round((date.getTime() - timeline.start.getTime()) / DAY_MS);
  return Math.min(100, Math.max(0, (days / timeline.totalDays) * 100));
}

function timelineWidth(timeline, start, end) {
  const days = Math.round((end.getTime() - start.getTime()) / DAY_MS) + 1;
  return Math.min(100, Math.max(0, (days / timeline.totalDays) * 100));
}

function ganttItemTitle(item) {
  const parts = [
    item.request.title || "Sem título",
    `Período: ${item.barLabel}`,
    item.request.estimatedDeliveryDate
      ? `Prazo: ${formatDate(item.request.estimatedDeliveryDate)}`
      : "",
    `Status: ${normalizeRequestStatus(item.request.status)}`,
  ].filter(Boolean);

  return parts.join("\n");
}
