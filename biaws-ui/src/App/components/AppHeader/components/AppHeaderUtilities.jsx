import { Check, Copy } from "lucide-react";

function LocalCommandCard({
  command,
  commandKey,
  copyStatus,
  description,
  disabled,
  onCopy,
  title,
  workspaceId,
}) {
  const copied = copyStatus === `copied:${commandKey}`;
  const failed = copyStatus === `failed:${commandKey}`;
  return (
    <section className="workspaceLocalCommand">
      <header>
        <div>
          <h3>{title}</h3>
          <p>{description}</p>
        </div>
        <button
          className="secondaryButton"
          disabled={disabled}
          onClick={() => onCopy(commandKey, command)}
          title={
            disabled
              ? "Informe a instância e o caminho do projeto"
              : "Copiar comando"
          }
          type="button"
        >
          {copied ? <Check size={15} /> : <Copy size={15} />}
          {copied ? "Copiado" : "Copiar"}
        </button>
      </header>
      <small>Workspace: {workspaceId}</small>
      <pre>{command}</pre>
      {failed ? (
        <p className="workspaceLocalCopyError" role="alert">
          Não foi possível copiar. Selecione o comando manualmente.
        </p>
      ) : null}
    </section>
  );
}

export async function copyPlainText(value) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }
  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  textarea.remove();
}

export function NavigationButton({
  active,
  iconOnly = false,
  menu = false,
  onClick,
  view,
}) {
  const Icon = view.icon;
  const baseClass = menu ? "navigationSubmenuItem" : "viewTab";
  const activeClass = menu ? "activeNavigationSubmenuItem" : "activeViewTab";
  return (
    <button
      aria-current={active ? "page" : undefined}
      aria-label={iconOnly ? view.label : undefined}
      className={`${active ? `${baseClass} ${activeClass}` : baseClass}${
        iconOnly ? " accountNavigationButton" : ""
      }`}
      onClick={onClick}
      title={iconOnly ? view.label : undefined}
      type="button"
    >
      <Icon size={16} /> {iconOnly ? null : view.label}
    </button>
  );
}
