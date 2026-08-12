function updateDetails(draft, onChange, field, value) {
  onChange({ ...draft, details: { ...draft.details, [field]: value } });
}

export function DocumentDetailsFields({ disabled, draft, onChange }) {
  if (draft.documentType === "procedure") return null;
  if (draft.documentType === "business-rule") {
    return (
      <div className="formGrid">
        <label className="field">
          <span>Código da regra</span>
          <input
            disabled={disabled}
            onChange={(event) =>
              updateDetails(draft, onChange, "ruleCode", event.target.value)
            }
            value={draft.details.ruleCode}
          />
        </label>
        <label className="field">
          <span>Vigente desde</span>
          <input
            disabled={disabled}
            onChange={(event) =>
              updateDetails(
                draft,
                onChange,
                "effectiveFrom",
                event.target.value,
              )
            }
            type="date"
            value={draft.details.effectiveFrom}
          />
        </label>
      </div>
    );
  }
  if (draft.documentType === "architecture-decision") {
    return (
      <label className="field">
        <span>Data da decisão</span>
        <input
          disabled={disabled}
          onChange={(event) =>
            updateDetails(draft, onChange, "decidedAt", event.target.value)
          }
          type="date"
          value={draft.details.decidedAt}
        />
      </label>
    );
  }
  if (draft.documentType === "guideline") {
    return (
      <div className="formGrid">
        <label className="field">
          <span>Escopo da diretriz</span>
          <select
            disabled={disabled}
            onChange={(event) =>
              updateDetails(draft, onChange, "scope", event.target.value)
            }
            value={draft.details.scope}
          >
            <option value="workspace">Workspace</option>
            <option value="application">Aplicação</option>
            <option value="component">Componente</option>
          </select>
        </label>
        <label className="field">
          <span>Força</span>
          <select
            disabled={disabled}
            onChange={(event) =>
              updateDetails(draft, onChange, "enforcement", event.target.value)
            }
            value={draft.details.enforcement}
          >
            <option value="required">Obrigatória</option>
            <option value="recommended">Recomendada</option>
            <option value="informative">Informativa</option>
          </select>
        </label>
      </div>
    );
  }
  if (draft.documentType === "feature") {
    return (
      <label className="field">
        <span>Maturidade</span>
        <select
          disabled={disabled}
          onChange={(event) =>
            updateDetails(draft, onChange, "maturity", event.target.value)
          }
          value={draft.details.maturity}
        >
          <option value="planned">Planejada</option>
          <option value="beta">Beta</option>
          <option value="stable">Estável</option>
          <option value="retired">Retirada</option>
        </select>
      </label>
    );
  }
  return (
    <label className="field">
      <span>Natureza da referência</span>
      <select
        disabled={disabled}
        onChange={(event) =>
          updateDetails(draft, onChange, "referenceKind", event.target.value)
        }
        value={draft.details.referenceKind}
      >
        <option value="architecture">Arquitetura</option>
        <option value="contract">Contrato</option>
        <option value="schema">Schema</option>
        <option value="protocol">Protocolo</option>
        <option value="mechanism">Mecanismo</option>
      </select>
    </label>
  );
}
