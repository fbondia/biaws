import { buildJourneyBalance } from "../model.js";

export function JourneyBalanceBar({ totals }) {
  const balance = buildJourneyBalance(totals);
  if (!balance.total) return <span className="requestBillingMatrixEmpty">-</span>;

  const description = [
    `${balance.executed} executadas / ${balance.planned} previstas`,
    `${balance.balanced} previstas e executadas`,
    `${balance.pending} previstas pendentes`,
    `${balance.excess} executadas além do previsto`,
  ].join("; ");

  return (
    <div aria-label={description} className="requestJourneyBalanceBar" role="img" title={description}>
      <div aria-hidden="true" className="requestJourneyBalanceTrack">
        {balance.segments.map((segment) => (
          <span
            className={`requestJourneyBalanceSegment requestJourneyBalance${segment.kind}`}
            key={segment.kind}
            style={{ width: `${segment.percentage}%` }}
          />
        ))}
      </div>
      <span aria-hidden="true" className="requestJourneyBalanceNumbers">
        {balance.executed} / {balance.planned}
      </span>
    </div>
  );
}
