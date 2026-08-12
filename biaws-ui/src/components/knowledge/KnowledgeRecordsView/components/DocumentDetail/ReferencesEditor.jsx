import { Plus } from "lucide-react";

import { DOCUMENT_TYPES } from "../../model.js";

export function ReferencesEditor({ disabled, draft, onChange, options }) {
  function update(index, field, value) {
    onChange({
      ...draft,
      references: draft.references.map((reference, itemIndex) =>
        itemIndex === index ? { ...reference, [field]: value } : reference,
      ),
    });
  }

  return (
    <div className="dialogForm knowledgeRecordPanel">
      {draft.references.map((reference, index) => (
        <div className="formGrid" key={index}>
          <label className="field">
            <span>Documento referenciado</span>
            <select
              disabled={disabled}
              onChange={(event) =>
                update(index, "targetDocumentId", event.target.value)
              }
              value={reference.targetDocumentId}
            >
              <option value="">Selecione...</option>
              {options.map((option) => (
                <option key={option.id} value={option.id}>
                  {DOCUMENT_TYPES[option.documentType]?.label}: {option.title}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Relação</span>
            <input
              disabled={disabled}
              onChange={(event) =>
                update(index, "relationship", event.target.value)
              }
              value={reference.relationship}
            />
          </label>
          {!disabled ? (
            <button
              className="secondaryButton"
              onClick={() =>
                onChange({
                  ...draft,
                  references: draft.references.filter(
                    (_, itemIndex) => itemIndex !== index,
                  ),
                })
              }
              type="button"
            >
              Remover
            </button>
          ) : null}
        </div>
      ))}
      {!disabled ? (
        <button
          className="secondaryButton"
          onClick={() =>
            onChange({
              ...draft,
              references: [
                ...draft.references,
                { targetDocumentId: "", relationship: "related" },
              ],
            })
          }
          type="button"
        >
          <Plus size={16} /> Adicionar referência
        </button>
      ) : null}
    </div>
  );
}
