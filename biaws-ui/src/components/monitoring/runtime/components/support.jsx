import { Check } from "lucide-react";
import React from "react";

export function formatDate(value) {
  if (!value) return "Data não informada";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

export function Feedback({ error, notice }) {
  return (
    <>
      {error ? (
        <div className="errorBox" role="alert">
          {error}
        </div>
      ) : null}
      {notice ? (
        <div className="catalogMonitoringNotice" role="status">
          <Check size={16} /> {notice}
        </div>
      ) : null}
    </>
  );
}

export function useNestedDialogKeyboard(onClose, disabled) {
  const dialogRef = React.useRef(null);
  React.useEffect(() => {
    function onKeyDown(event) {
      if (event.key === "Escape" && !disabled) {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab") return;
      const controls = [
        ...(dialogRef.current?.querySelectorAll(
          "button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [href]",
        ) || []),
      ];
      if (!controls.length) return;
      const first = controls[0];
      const last = controls.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [disabled, onClose]);
  return dialogRef;
}
