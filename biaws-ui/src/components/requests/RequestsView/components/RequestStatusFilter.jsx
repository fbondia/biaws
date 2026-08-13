import { ListChecks } from "lucide-react";
import { useState } from "react";

import { FilterDialogButton } from "../../../shared/FilterDialogButton.jsx";
import {
  requestStatusLabel,
  REQUEST_STATUS_OPTIONS,
} from "../../requestUtils.js";

export function RequestStatusFilter({ onChange, value }) {
  const [open, setOpen] = useState(false);
  const summary =
    value.length === 1
      ? requestStatusLabel(value[0])
      : value.length
        ? `${value.length} selecionados`
        : "Todos os status";

  function toggleStatus(status) {
    onChange(
      value.includes(status)
        ? value.filter((item) => item !== status)
        : [...value, status],
    );
  }

  return (
    <>
      <FilterDialogButton
        count={value.length}
        icon={ListChecks}
        label="Status"
        onClick={() => setOpen(true)}
        summary={summary}
      />
      {open ? (
        <div
          className="tagFilterDialogBackdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setOpen(false);
          }}
        >
          <section
            aria-label="Filtrar melhorias por status"
            aria-modal="true"
            className="tagFilterDialog issueOptionFilterDialog"
            role="dialog"
          >
            <header>
              <div>
                <strong>Filtrar melhorias por status</strong>
                <span>
                  Selecione um ou mais status para restringir os resultados.
                </span>
              </div>
              {value.length ? (
                <small>{value.length} selecionado(s)</small>
              ) : null}
            </header>
            <div className="tagFilterGroups issueOptionFilterDialogContent">
              <div className="tagFilterOptions">
                {REQUEST_STATUS_OPTIONS.map((status) => (
                  <label
                    className={
                      value.includes(status)
                        ? "tagFilterOption selectedTagFilterOption"
                        : "tagFilterOption"
                    }
                    key={status}
                  >
                    <input
                      checked={value.includes(status)}
                      onChange={() => toggleStatus(status)}
                      type="checkbox"
                    />
                    <span>{requestStatusLabel(status)}</span>
                  </label>
                ))}
              </div>
            </div>
            <footer>
              {value.length ? (
                <button
                  className="secondaryButton clearDialogSelectionButton"
                  onClick={() => onChange([])}
                  type="button"
                >
                  Limpar seleção
                </button>
              ) : null}
              <button
                className="primaryButton"
                data-dialog-close
                onClick={() => setOpen(false)}
                type="button"
              >
                Concluir
              </button>
            </footer>
          </section>
        </div>
      ) : null}
    </>
  );
}
