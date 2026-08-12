import { ChevronDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { TYPE_FILTERS } from "../model.js";

export function DocumentTypeFilter({ onChange, value }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const selected =
    TYPE_FILTERS.find(([filterValue]) => filterValue === value) ||
    TYPE_FILTERS[0];
  const [, selectedLabel, SelectedIcon] = selected;

  useEffect(() => {
    if (!open) return undefined;

    function closeOnOutsideClick(event) {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    }

    function closeOnEscape(event) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  return (
    <div className="documentTypeFilter" ref={rootRef}>
      <button
        aria-expanded={open}
        aria-haspopup="listbox"
        className="documentTypeFilterTrigger"
        onClick={() => setOpen((current) => !current)}
        type="button"
      >
        <SelectedIcon aria-hidden="true" size={15} />
        <span>{value ? selectedLabel : "Todos os tipos"}</span>
        <ChevronDown aria-hidden="true" size={14} />
      </button>
      {open ? (
        <div
          aria-label="Tipo de documento"
          className="documentTypeFilterMenu"
          role="listbox"
        >
          {TYPE_FILTERS.map(([filterValue, label, TypeIcon]) => (
            <button
              aria-selected={filterValue === value}
              className={
                filterValue === value
                  ? "documentTypeFilterOption selectedDocumentTypeFilterOption"
                  : "documentTypeFilterOption"
              }
              key={filterValue || "all"}
              onClick={() => {
                onChange(filterValue);
                setOpen(false);
              }}
              role="option"
              type="button"
            >
              <TypeIcon aria-hidden="true" size={16} />
              <span>{filterValue ? label : "Todos os tipos"}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
