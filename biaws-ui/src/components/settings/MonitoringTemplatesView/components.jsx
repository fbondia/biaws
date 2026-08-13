import { Trash2 } from "lucide-react";

import { templateStatusLabel } from "./model.js";

export function VersionRow({
  canManage,
  onArchive,
  onStatus,
  onUsage,
  onValidate,
  template,
  usage,
  version,
  validated,
}) {
  return (
    <li>
      <div>
        <strong>v{version.version}</strong>
        <span
          className={`catalogStatus catalogStatus-${version.status === "active" ? "active" : "archived"}`}
        >
          {templateStatusLabel(version.status)}
        </span>
        <small>{new Date(version.updatedAt).toLocaleString("pt-BR")}</small>
      </div>
      <div className="monitoringTemplateVersionActions">
        <button
          className="secondaryButton"
          onClick={() => onUsage(version)}
          type="button"
        >
          Uso
        </button>
        <button
          className="secondaryButton"
          onClick={() => onValidate(version)}
          type="button"
        >
          {validated ? "Teste aprovado" : "Testar versão"}
        </button>
        {canManage ? (
          <button
            className="secondaryButton"
            disabled={version.status !== "active" && !validated}
            onClick={() => onStatus(version, version.status !== "active")}
            type="button"
          >
            {version.status === "active" ? "Desativar" : "Ativar"}
          </button>
        ) : null}
        {canManage && version.status !== "active" ? (
          <button
            aria-label={`Arquivar ${template.name} versão ${version.version}`}
            className="iconButton dangerIconButton"
            onClick={() => onArchive(version)}
            type="button"
          >
            <Trash2 size={15} />
          </button>
        ) : null}
      </div>
      {usage?.templateRef?.version === version.version ? (
        <p className="monitoringTemplateUsage">
          {usage.monitors ?? usage.activeMonitors} monitoramento(s) ·{" "}
          {usage.observations} observação(ões) histórica(s)
        </p>
      ) : null}
    </li>
  );
}
