import { CatalogContextDialogField } from "../../../../catalog/CatalogContextFields.jsx";
import { DocumentClassificationSelectors } from "./DocumentClassificationSelectors.jsx";
import { DocumentDetailsFields } from "./DocumentDetailsFields.jsx";

export function DocumentOverview({
  canUpdate,
  catalog,
  config,
  draft,
  onChange,
  onContextChange,
  taxonomyPackage,
}) {
  return (
    <div className="dialogForm knowledgeRecordPanel">
      <label className="field">
        <span>Título</span>
        <input
          disabled={!canUpdate}
          maxLength={240}
          onChange={(event) =>
            onChange({ ...draft, title: event.target.value })
          }
          value={draft.title}
        />
      </label>
      <label className="field">
        <span>Estado</span>
        <select
          disabled={!canUpdate}
          onChange={(event) =>
            onChange({ ...draft, status: event.target.value })
          }
          value={draft.status}
        >
          {config.statuses.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>Resumo</span>
        <textarea
          disabled={!canUpdate}
          maxLength={500}
          onChange={(event) =>
            onChange({ ...draft, summary: event.target.value })
          }
          rows={3}
          value={draft.summary}
        />
      </label>
      <section className="knowledgeOverviewSection">
        <h3>Contexto</h3>
        <div className="knowledgeOverviewSelectors">
          <CatalogContextDialogField
            affectedComponentIds={draft.affectedComponentIds}
            applicationId={draft.applicationId || ""}
            applications={catalog.applications}
            components={catalog.components}
            disabled={!canUpdate}
            onChange={onContextChange}
            optional={[
              "guideline",
              "procedure",
              "technical-reference",
            ].includes(draft.documentType)}
          />
          <DocumentClassificationSelectors
            applications={catalog.applications}
            disabled={!canUpdate}
            draft={draft}
            onChange={onChange}
            taxonomyPackage={taxonomyPackage}
          />
        </div>
      </section>
      <section className="knowledgeOverviewSection">
        <h3>Detalhes Adicionais</h3>
        <DocumentDetailsFields
          disabled={!canUpdate}
          draft={draft}
          onChange={onChange}
        />
      </section>
      <section className="knowledgeOverviewSection">
        <h3>Governança e origem</h3>
        <div className="formGrid">
          <label className="field">
            <span>Data de definição</span>
            <input
              disabled={!canUpdate}
              onChange={(event) =>
                onChange({ ...draft, definedAt: event.target.value })
              }
              type="date"
              value={draft.definedAt}
            />
          </label>
          <label className="field">
            <span>Última revisão</span>
            <input
              disabled={!canUpdate}
              onChange={(event) =>
                onChange({ ...draft, lastReviewedAt: event.target.value })
              }
              type="date"
              value={draft.lastReviewedAt}
            />
          </label>
          <label className="field">
            <span>Próxima revisão</span>
            <input
              disabled={!canUpdate}
              onChange={(event) =>
                onChange({ ...draft, nextReviewAt: event.target.value })
              }
              type="date"
              value={draft.nextReviewAt}
            />
          </label>
        </div>
        <label className="field">
          <span>Origem</span>
          <select
            disabled={!canUpdate}
            onChange={(event) =>
              onChange({
                ...draft,
                source: { ...draft.source, mode: event.target.value },
              })
            }
            value={draft.source.mode}
          >
            <option value="native">Conteúdo nativo no Biaws</option>
            <option value="repository">Documento em repositório</option>
          </select>
        </label>
        {draft.source.mode === "repository" ? (
          <div className="formGrid">
            <label className="field">
              <span>ID do repositório</span>
              <input
                disabled={!canUpdate}
                onChange={(event) =>
                  onChange({
                    ...draft,
                    source: {
                      ...draft.source,
                      repositoryId: event.target.value,
                    },
                  })
                }
                value={draft.source.repositoryId}
              />
            </label>
            <label className="field">
              <span>Caminho do arquivo</span>
              <input
                disabled={!canUpdate}
                onChange={(event) =>
                  onChange({
                    ...draft,
                    source: { ...draft.source, path: event.target.value },
                  })
                }
                value={draft.source.path}
              />
            </label>
          </div>
        ) : null}
      </section>
    </div>
  );
}
