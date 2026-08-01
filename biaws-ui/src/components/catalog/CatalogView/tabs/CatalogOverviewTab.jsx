import { Boxes, GitBranch, HeartPulse, Layers3 } from "lucide-react";

export function CatalogOverviewTab({ context }) {
  return (
    <div className="catalogOverviewGrid">
      {[
        ["Componentes", context.components.length, Boxes],
        ["Repositórios", context.repositories.length, GitBranch],
        ["Deployments", context.deployments.length, Layers3],
      ].map(([label, value, Icon]) => (
        <article className="catalogMetricCard" key={label}>
          <Icon size={20} />
          <span>{label}</span>
          <strong>{value}</strong>
        </article>
      ))}
      <article className="catalogMetricCard">
        <HeartPulse size={20} />
        <span>Saúde da aplicação</span>
        <strong
          className={`catalogHealthText catalogHealthText-${context.monitoringHealth?.status || "unknown"}`}
        >
          {context.monitoringHealth?.status || "unknown"}
        </strong>
        <small>
          {context.monitoringHealth
            ? `${context.monitoringHealth.observed}/${context.monitoringHealth.total} runtimes observados`
            : "Monitoramento indisponível"}
        </small>
      </article>
      <article className="catalogOverviewCard">
        <h3>Responsabilidade</h3>
        <dl>
          <div>
            <dt>Equipe</dt>
            <dd>{context.application.owner?.team || "-"}</dd>
          </div>
          <div>
            <dt>Contato</dt>
            <dd>{context.application.owner?.contact || "-"}</dd>
          </div>
          <div>
            <dt>Tags</dt>
            <dd>{(context.application.tags || []).join(", ") || "-"}</dd>
          </div>
        </dl>
      </article>
    </div>
  );
}
