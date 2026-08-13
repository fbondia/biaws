import { Braces, ChevronLeft, Terminal, UserRound, X } from "lucide-react";

import { RuntimeMonitoringInstructions } from "./Instructions.jsx";
import { useNestedDialogKeyboard } from "./support.jsx";

const PROVIDERS = [
  {
    description:
      "O BIAWS consulta um endpoint HTTP periodicamente e interpreta a resposta.",
    icon: Braces,
    key: "rest",
    title: "API REST",
  },
  {
    description:
      "O executor chama um script previamente instalado e permitido no ambiente.",
    icon: Terminal,
    key: "shell",
    title: "Shell Script",
  },
  {
    description:
      "Um processo externo envia sinais pela API ou pela linha de comando do BIAWS.",
    icon: UserRound,
    key: "manual",
    title: "Manual",
  },
];

function ProviderChoice({ description, icon: Icon, onClick, title }) {
  return (
    <button
      className="catalogMonitoringProviderChoice"
      onClick={onClick}
      type="button"
    >
      <Icon aria-hidden="true" size={24} />
      <strong>{title}</strong>
      <span>{description}</span>
    </button>
  );
}

export function MonitorCreationDialog({
  cliExample,
  curlExample,
  entity,
  mode,
  onBack,
  onChoose,
  onClose,
  options,
  runtimePath,
}) {
  const dialogRef = useNestedDialogKeyboard(onClose, false);
  const manual = mode === "manual";
  return (
    <div className="dialogBackdrop catalogMonitoringNestedBackdrop">
      <section
        aria-labelledby="monitor-creation-dialog-title"
        aria-modal="true"
        className="catalogMonitoringDialog catalogMonitorCreationDialog"
        ref={dialogRef}
        role="dialog"
      >
        <header>
          <div>
            <span>Novo monitoramento</span>
            <h2 id="monitor-creation-dialog-title">
              {manual ? "Monitoramento manual" : "Como deseja monitorar?"}
            </h2>
          </div>
          <button
            aria-label="Fechar"
            autoFocus
            className="iconButton"
            onClick={onClose}
            type="button"
          >
            <X size={18} />
          </button>
        </header>
        {manual ? (
          <div className="catalogMonitorManualBody">
            <p className="catalogMonitorManualIntroduction">
              Neste modo o BIAWS não agenda uma execução. Envie sinais a partir
              de uma ferramenta, automação ou processo externo.
            </p>
            <RuntimeMonitoringInstructions
              cliExample={cliExample}
              curlExample={curlExample}
              entity={entity}
              options={options}
              runtimePath={runtimePath}
            />
          </div>
        ) : (
          <div className="catalogMonitoringProviderChoices">
            {PROVIDERS.map(({ key, ...provider }) => (
              <ProviderChoice
                {...provider}
                key={key}
                onClick={() => onChoose(key)}
              />
            ))}
          </div>
        )}
        <footer>
          {manual ? (
            <button className="secondaryButton" onClick={onBack} type="button">
              <ChevronLeft size={16} /> Voltar
            </button>
          ) : null}
          <button className="secondaryButton" onClick={onClose} type="button">
            Fechar
          </button>
        </footer>
      </section>
    </div>
  );
}
