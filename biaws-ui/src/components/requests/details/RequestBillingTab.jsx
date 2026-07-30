import { formatMonth } from "../requestUtils.js";

export function RequestBillingTab({
  request,
  isEditing,
  billingTotals,
  onBeginNumberDraft,
  onUpdateNumberDraft,
  onClearNumberDraft,
  onReadDraftedNumber,
  onBillingMonthCommit,
  onBillingCommentChange,
}) {
  const { billedTotal, plannedTotal, unbilledTotal, overbilledTotal } =
    billingTotals;
  const isBalanced = unbilledTotal === 0 && overbilledTotal === 0;

  return (
    <section className="requestPanel">
      <div className="panelHeader">
        <div>
          <h3>Faturamento por mês</h3>
          <span>
            {billedTotal} de {plannedTotal} jornadas faturadas
          </span>
        </div>
        <strong
          className={
            isBalanced
              ? "billingBalance billingBalanced"
              : "billingBalance billingPending"
          }
        >
          {isBalanced
            ? "Balanceado"
            : unbilledTotal > 0
              ? `${unbilledTotal} jornadas não faturadas`
              : `${overbilledTotal} jornadas acima do previsto`}
        </strong>
      </div>

      {request.billing.length ? (
        <div className="requestBillingList">
          {request.billing.map((item) => (
            <div className="requestBillingRow" key={item.month}>
              <div className="requestBillingMonthLabel">
                <span>Mês</span>
                <strong>{formatMonth(item.month)}</strong>
              </div>
              <BillingJourneyField
                field="plannedJourneys"
                isEditing={isEditing}
                item={item}
                label="Previsto"
                onBeginNumberDraft={onBeginNumberDraft}
                onBillingMonthCommit={onBillingMonthCommit}
                onClearNumberDraft={onClearNumberDraft}
                onReadDraftedNumber={onReadDraftedNumber}
                onUpdateNumberDraft={onUpdateNumberDraft}
              />
              <BillingJourneyField
                field="billedJourneys"
                isEditing={isEditing}
                item={item}
                label="Faturado"
                onBeginNumberDraft={onBeginNumberDraft}
                onBillingMonthCommit={onBillingMonthCommit}
                onClearNumberDraft={onClearNumberDraft}
                onReadDraftedNumber={onReadDraftedNumber}
                onUpdateNumberDraft={onUpdateNumberDraft}
              />
              <label className="field requestBillingComment">
                <span>Comentário</span>
                <textarea
                  onChange={(event) =>
                    onBillingCommentChange(item.month, event.target.value)
                  }
                  value={item.comment || ""}
                />
              </label>
            </div>
          ))}
        </div>
      ) : (
        <div className="emptyState">
          Informe início e fim para gerar os meses da demanda.
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
  onBillingMonthCommit,
}) {
  const draftKey = `billing:${field}:${item.month}`;

  const value = Number(item[field]) || 0;
  return (
    <div className="requestBillingJourneys">
      {isEditing ? (
        <label className="field">
          <span>{label}</span>
          <input
            min="0"
            onBlur={(event) =>
              onBillingMonthCommit(item.month, field, event.target.value)
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
