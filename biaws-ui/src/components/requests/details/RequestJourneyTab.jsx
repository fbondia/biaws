import { formatMonth } from "../requestUtils.js";

export function RequestJourneyTab({
  request,
  isEditing,
  journeyTotals,
  onBeginNumberDraft,
  onUpdateNumberDraft,
  onClearNumberDraft,
  onReadDraftedNumber,
  onJourneyMonthCommit,
  onJourneyCommentChange,
}) {
  const { executedTotal, plannedTotal, pendingTotal, overExecutedTotal } =
    journeyTotals;
  const isOnPlan = pendingTotal === 0 && overExecutedTotal === 0;

  return (
    <section className="requestPanel">
      <div className="panelHeader">
        <div>
          <h3>Jornadas por mês</h3>
          <span>
            {executedTotal} de {plannedTotal} jornadas executadas
          </span>
        </div>
        <strong
          className={
            isOnPlan
              ? "billingBalance billingBalanced"
              : "billingBalance billingPending"
          }
        >
          {isOnPlan
            ? "Conforme o previsto"
            : pendingTotal > 0
              ? `${pendingTotal} jornadas a executar`
              : `${overExecutedTotal} jornadas executadas acima do previsto`}
        </strong>
      </div>

      {request.journeys.length ? (
        <div className="requestBillingList">
          {request.journeys.map((item) => (
            <div className="requestBillingRow" key={item.month}>
              <div className="requestBillingMonthLabel">
                <span>Mês</span>
                <strong>{formatMonth(item.month)}</strong>
              </div>
              <BillingJourneyField
                field="plannedJourneys"
                isEditing={isEditing}
                item={item}
                label="Previstas"
                onBeginNumberDraft={onBeginNumberDraft}
                onJourneyMonthCommit={onJourneyMonthCommit}
                onClearNumberDraft={onClearNumberDraft}
                onReadDraftedNumber={onReadDraftedNumber}
                onUpdateNumberDraft={onUpdateNumberDraft}
              />
              <BillingJourneyField
                field="executedJourneys"
                isEditing={isEditing}
                item={item}
                label="Executadas"
                onBeginNumberDraft={onBeginNumberDraft}
                onJourneyMonthCommit={onJourneyMonthCommit}
                onClearNumberDraft={onClearNumberDraft}
                onReadDraftedNumber={onReadDraftedNumber}
                onUpdateNumberDraft={onUpdateNumberDraft}
              />
              <label className="field requestBillingComment">
                <span>Comentário</span>
                <textarea
                  onChange={(event) =>
                    onJourneyCommentChange(item.month, event.target.value)
                  }
                  value={item.comment || ""}
                />
              </label>
            </div>
          ))}
        </div>
      ) : (
        <div className="emptyState">
          Informe início e fim para gerar o planejamento mensal da melhoria.
        </div>
      )}
    </section>
  );
}

function BillingJourneyField({
  field,
  isEditing,
  item,
  label,
  onBeginNumberDraft,
  onUpdateNumberDraft,
  onClearNumberDraft,
  onReadDraftedNumber,
  onJourneyMonthCommit,
}) {
  const draftKey = `journeys:${field}:${item.month}`;

  const value = Number(item[field]) || 0;
  return (
    <div className="requestBillingJourneys">
      {isEditing ? (
        <label className="field">
          <span>{label}</span>
          <input
            min="0"
            onBlur={(event) =>
              onJourneyMonthCommit(item.month, field, event.target.value)
            }
            onChange={(event) =>
              onUpdateNumberDraft(draftKey, event.target.value)
            }
            onFocus={() => onBeginNumberDraft(draftKey, item[field])}
            onKeyDown={(event) => {
              if (event.key === "Enter") event.currentTarget.blur();
              if (event.key === "Escape") onClearNumberDraft(draftKey);
            }}
            step="0.5"
            type="number"
            value={onReadDraftedNumber(draftKey, item[field])}
          />
        </label>
      ) : (
        <div className="requestReadOnlyValue">
          <span>{label}</span>
          {value > 0 && <strong>{value}</strong>}
        </div>
      )}
    </div>
  );
}
