import { Check, Copy } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import "../../../styles/shared/entity-identifier.css";
import { copyIdentifier } from "./model.js";

const COPY_FEEDBACK_DURATION_MS = 1600;

export function EntityIdentifier({
  className = "",
  fallback = "Sem identificador",
  label = "Identificador",
  value,
  showCopyButton = true,
  variant = "subtitle",
}) {
  const [copied, setCopied] = useState(false);
  const resetTimerRef = useRef(null);
  const identifier = value == null ? "" : String(value).trim();
  const displayValue = identifier || fallback;

  useEffect(
    () => () => {
      if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
    },
    [],
  );

  async function handleCopy(event) {
    event.preventDefault();
    event.stopPropagation();
    if (!identifier) return;

    try {
      const didCopy = await copyIdentifier(identifier);
      if (!didCopy) return;
      setCopied(true);
      if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
      resetTimerRef.current = setTimeout(
        () => setCopied(false),
        COPY_FEEDBACK_DURATION_MS,
      );
    } catch {
      setCopied(false);
    }
  }

  const classes = [
    "entityIdentifier",
    `entityIdentifier-${variant}`,
    identifier ? "" : "entityIdentifier-empty",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <span className={classes} title={`${label}: ${displayValue}`}>
      <code>{displayValue}</code>

      {showCopyButton ? (
        <button
          aria-live="polite"
          aria-label={
            copied ? `${label} copiado` : `Copiar ${label.toLowerCase()}`
          }
          className="entityIdentifierCopy"
          disabled={!identifier}
          onClick={handleCopy}
          onKeyDown={(event) => event.stopPropagation()}
          onMouseDown={(event) => event.stopPropagation()}
          title={copied ? "Copiado" : `Copiar ${label.toLowerCase()}`}
          type="button"
        >
          {copied ? (
            <Check aria-hidden="true" size={13} />
          ) : (
            <Copy aria-hidden="true" size={13} />
          )}
        </button>
      ) : (
        <></>
      )}
    </span>
  );
}
