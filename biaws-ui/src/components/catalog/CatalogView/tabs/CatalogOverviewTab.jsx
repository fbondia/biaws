import { Boxes, ExternalLink, GitBranch, Layers3 } from "lucide-react";

import { CatalogApplicationMonitoring } from "../../CatalogApplicationMonitoring.jsx";

export function CatalogOverviewTab({ context }) {
  const links = Array.isArray(context.application.links)
    ? context.application.links
    : [];

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
      <article className="catalogOverviewCard catalogLinksCard">
        <h3>Links</h3>
        {links.length ? (
          <ul>
            {links.map((link, index) => (
              <li key={`${link.label}-${link.url}-${index}`}>
                <a href={link.url} rel="noopener noreferrer" target="_blank">
                  <span>{link.label}</span>
                  <ExternalLink aria-hidden="true" size={15} />
                </a>
              </li>
            ))}
          </ul>
        ) : (
          <p>Nenhum link cadastrado.</p>
        )}
      </article>
      <CatalogApplicationMonitoring
        monitoringHealth={context.monitoringHealth}
      />
    </div>
  );
}
