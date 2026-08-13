import { Check, LoaderCircle, X } from "lucide-react";

import { SanitizationConfiguration } from "./components/SanitizationConfiguration.jsx";
import { SanitizationPreview } from "./components/SanitizationPreview.jsx";
import { useEmlSanitizationDialog } from "./hooks/useEmlSanitizationDialog.js";

export function EmlSanitizationDialog({
  applicationId,
  onClose,
  onSaved,
  sampleFile,
  workspaceId,
}) {
  const dialog = useEmlSanitizationDialog({
    applicationId,
    onClose,
    onSaved,
    sampleFile,
    workspaceId,
  });

  return (
    <div className="dialogBackdrop sanitizationBackdrop" role="presentation">
      <section
        aria-labelledby="sanitization-title"
        aria-modal="true"
        className="issueDialog sanitizationDialog"
        role="dialog"
      >
        <header className="dialogHeader">
          <div className="dialogTitleBlock">
            <div className="dialogKicker">
              <span className="typeBadge">Configuração por workspace</span>
              {dialog.source === "default" ? (
                <span className="sanitizationSource">Padrões do sistema</span>
              ) : null}
            </div>
            <h2 id="sanitization-title">Sanitização de e-mails</h2>
          </div>
          <button
            className="iconButton"
            disabled={dialog.busy}
            onClick={onClose}
            title="Fechar"
            type="button"
          >
            <X size={18} />
          </button>
        </header>

        <div className="dialogBody sanitizationDialogBody">
          {dialog.loading ? (
            <p className="loadingLine">
              <LoaderCircle className="spinIcon" size={16} /> Carregando
              configuração…
            </p>
          ) : null}
          {dialog.error ? (
            <div className="errorBanner">{dialog.error}</div>
          ) : null}
          {dialog.config ? (
            <>
              <SanitizationConfiguration
                config={dialog.config}
                updateConfig={dialog.updateConfig}
              />
              <SanitizationPreview {...dialog} applicationId={applicationId} />
            </>
          ) : null}
        </div>

        <footer className="importDialogFooter">
          <span>
            As alterações serão usadas nas próximas análises e importações deste
            workspace.
          </span>
          <div>
            <button
              className="secondaryButton"
              disabled={dialog.busy}
              onClick={onClose}
              type="button"
            >
              Cancelar
            </button>
            <button
              className="primaryButton"
              disabled={dialog.busy || !dialog.config}
              onClick={() => void dialog.save()}
              type="button"
            >
              {dialog.saving ? (
                <LoaderCircle className="spinIcon" size={16} />
              ) : (
                <Check size={16} />
              )}{" "}
              Salvar configuração
            </button>
          </div>
        </footer>
      </section>
    </div>
  );
}
