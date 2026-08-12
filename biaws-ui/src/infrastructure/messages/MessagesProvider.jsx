import { LoaderCircle, X } from "lucide-react";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";

import { MESSAGE_DIALOG } from "./contract.js";
import { defaultMessagesService } from "./runtime.js";
import { selectActiveLoading } from "./service.js";

const MessagesContext = createContext(null);

function MessageDialog({ dialog, service }) {
  const [value, setValue] = useState("");
  const options = dialog.options;
  const isPrompt = dialog.type === MESSAGE_DIALOG.PROMPT;

  useEffect(() => {
    const focusBeforeDialog = dialog.focusTarget;
    setValue("");
    return () => {
      if (focusBeforeDialog?.isConnected) {
        focusBeforeDialog.focus({ preventScroll: true });
      }
    };
  }, [dialog.id]);

  function submit(event) {
    event.preventDefault();
    service.resolveDialog(isPrompt ? value : true);
  }

  return (
    <div className="dialogBackdrop messagesDialogBackdrop">
      <form
        aria-describedby={`messages-dialog-description-${dialog.id}`}
        aria-labelledby={`messages-dialog-title-${dialog.id}`}
        aria-modal="true"
        className="messagesDialog"
        onSubmit={submit}
        role="dialog"
      >
        <header className="messagesDialogHeader">
          <h2 id={`messages-dialog-title-${dialog.id}`}>{options.title}</h2>
          <button
            aria-label="Fechar diálogo"
            className="iconButton"
            data-dialog-close
            onClick={service.cancelDialog}
            type="button"
          >
            <X aria-hidden="true" size={18} />
          </button>
        </header>
        <p id={`messages-dialog-description-${dialog.id}`}>{options.message}</p>
        {isPrompt ? (
          <label className="field messagesPromptField">
            <span>{options.inputLabel}</span>
            <input
              autoComplete={options.autoComplete || "off"}
              autoFocus
              data-dialog-initial-focus
              name="message-prompt"
              onChange={(event) => setValue(event.target.value)}
              placeholder={options.placeholder}
              required={options.required === true}
              type={options.inputType || "text"}
              value={value}
            />
          </label>
        ) : null}
        <footer className="messagesDialogActions">
          <button
            autoFocus={!isPrompt}
            className="secondaryButton"
            data-dialog-close
            data-dialog-initial-focus={!isPrompt || undefined}
            onClick={service.cancelDialog}
            type="button"
          >
            {options.cancelLabel}
          </button>
          <button
            className={
              options.tone === "danger" ? "dangerButton" : "primaryButton"
            }
            type="submit"
          >
            {options.confirmLabel}
          </button>
        </footer>
      </form>
    </div>
  );
}

function NoticeRegion({ notices, service }) {
  if (!notices.length) return null;
  return (
    <div aria-atomic="false" aria-live="polite" className="messagesNotices">
      {notices.map((notice) => (
        <div className={`messagesNotice is-${notice.level}`} key={notice.id}>
          <span>{notice.message}</span>
          <button
            aria-label="Dispensar mensagem"
            onClick={() => service.dismiss(notice.id)}
            type="button"
          >
            <X aria-hidden="true" size={16} />
          </button>
        </div>
      ))}
    </div>
  );
}

export function MessagesProvider({
  children,
  service = defaultMessagesService,
}) {
  const snapshot = useSyncExternalStore(
    service.subscribe,
    service.getSnapshot,
    service.getSnapshot,
  );
  const value = useMemo(
    () => ({
      confirm: (options) =>
        service.confirm(options, { focusTarget: document.activeElement }),
      error: service.error,
      info: service.info,
      prompt: (options) =>
        service.prompt(options, { focusTarget: document.activeElement }),
      run: service.run,
      startLoading: service.startLoading,
      success: service.success,
      warning: service.warning,
    }),
    [service],
  );
  const blockingLoading = selectActiveLoading(snapshot.loadings, true);
  const nonBlockingLoading = selectActiveLoading(snapshot.loadings, false);

  return (
    <MessagesContext.Provider value={value}>
      {children}
      {blockingLoading ? (
        <div
          aria-busy="true"
          aria-label={blockingLoading.label}
          aria-live="polite"
          className="globalLoading"
        >
          <div className="globalLoadingIndicator" role="status">
            <LoaderCircle
              aria-hidden="true"
              className="globalLoadingSpinner"
              size={22}
            />
            <span>{blockingLoading.label}</span>
          </div>
        </div>
      ) : null}
      {nonBlockingLoading ? (
        <div
          aria-live="polite"
          className="messagesBackgroundStatus"
          role="status"
        >
          <LoaderCircle aria-hidden="true" size={16} />
          <span>{nonBlockingLoading.label}</span>
        </div>
      ) : null}
      <NoticeRegion notices={snapshot.notices} service={service} />
      {snapshot.dialog ? (
        <MessageDialog dialog={snapshot.dialog} service={service} />
      ) : null}
    </MessagesContext.Provider>
  );
}

export function useMessages() {
  const context = useContext(MessagesContext);
  if (!context) {
    throw new Error("useMessages must be used inside MessagesProvider");
  }
  return context;
}
