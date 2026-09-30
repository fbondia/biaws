function monthIndex(month) {
  const [year, number] = month.split("-").map(Number);
  return year * 12 + number - 1;
}

export function buildJourneyBalance(totals = {}) {
  function journeyCount(value) {
    const number = Number(value);
    return Number.isFinite(number) ? Math.max(0, number) : 0;
  }

  const planned = journeyCount(totals.planned);
  const executed = journeyCount(totals.executed);
  const balanced = Math.min(planned, executed);
  const pending = Math.max(0, planned - executed);
  const excess = Math.max(0, executed - planned);
  const total = Math.max(planned, executed);
  const segments = [
    { kind: "Balanced", value: balanced },
    { kind: "Pending", value: pending },
    { kind: "Excess", value: excess },
  ]
    .filter((segment) => segment.value > 0)
    .map((segment) => ({ ...segment, percentage: (segment.value / total) * 100 }));

  return { planned, executed, balanced, pending, excess, total, segments };
}

export function normalizeJourneyMonthCount(value) {
  if (value === "") return "";
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.floor(number)) : "";
}

export function filterJourneyCalendar({
  requests = [],
  months = [],
  monthsBefore = "",
  monthsAfter = "",
  onlyUnbalanced = false,
  currentDate = new Date(),
}) {
  const currentMonthIndex = currentDate.getFullYear() * 12 + currentDate.getMonth();
  const before = normalizeJourneyMonthCount(monthsBefore);
  const after = normalizeJourneyMonthCount(monthsAfter);
  const visibleMonths = months.filter((month) => {
    const index = monthIndex(month);
    return (
      (before === "" || index >= currentMonthIndex - before) && (after === "" || index <= currentMonthIndex + after)
    );
  });
  const visibleMonthSet = new Set(visibleMonths);
  const visibleRequests = [];

  for (const request of requests) {
    const journeys = request.journeys || [];
    const planned = journeys.reduce((total, journey) => total + (Number(journey.plannedJourneys) || 0), 0);
    const executed = journeys.reduce((total, journey) => total + (Number(journey.executedJourneys) || 0), 0);
    if (onlyUnbalanced && planned === executed) continue;

    const visibleJourneys = journeys.filter((journey) => visibleMonthSet.has(journey.month));
    if (
      !visibleJourneys.some(
        (journey) => (Number(journey.plannedJourneys) || 0) > 0 || (Number(journey.executedJourneys) || 0) > 0,
      )
    ) {
      continue;
    }
    visibleRequests.push({ ...request, journeys: visibleJourneys });
  }

  return { months: visibleMonths, requests: visibleRequests };
}
