import {
  DEPLOYMENT_STATUSES,
  ENVIRONMENTS,
  PUBLICATION_STATUSES,
} from "../constants.js";
import {
  EntityFieldGroup,
  HistoryItems,
  SelectField,
  TextField,
} from "./Fields.jsx";

function formatDate(value) {
  if (!value) return "Data não informada";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

export function DeploymentFields({
  activeSection,
  addPublication,
  draft,
  editing,
  kind,
  options,
  publicationDraft,
  setPublicationDraft,
  update,
}) {
  return (
    <>
      <EntityFieldGroup
        active={kind === "deployment" && activeSection === "basic"}
      >
        <>
          {!editing ? (
            <SelectField
              label="Componente"
              name="componentId"
              onChange={update}
              options={(options.components || []).map(({ id, name }) => ({
                value: id,
                label: name,
              }))}
              required
              value={draft.componentId}
            />
          ) : null}
          <SelectField
            label="Ambiente"
            name="environment"
            onChange={update}
            options={ENVIRONMENTS}
            required
            value={draft.environment}
          />
          <SelectField
            label="Repositório"
            name="repositoryId"
            onChange={update}
            options={(options.repositories || []).map(({ id, name }) => ({
              value: id,
              label: name,
            }))}
            value={draft.repositoryId}
          />
          <SelectField
            label="Status"
            name="status"
            onChange={update}
            options={DEPLOYMENT_STATUSES}
            required
            value={draft.status}
          />
        </>
      </EntityFieldGroup>

      <EntityFieldGroup
        active={kind === "deployment" && activeSection === "publications"}
      >
        <div className="catalogHistorySection catalogWideField">
          <div className="catalogHistoryComposer">
            <TextField
              label="Versão"
              name="publicationVersion"
              onChange={(_name, value) =>
                setPublicationDraft((current) => ({
                  ...current,
                  version: value,
                }))
              }
              value={publicationDraft.version}
            />
            <TextField
              label="Revisão"
              name="publicationRevision"
              onChange={(_name, value) =>
                setPublicationDraft((current) => ({
                  ...current,
                  revision: value,
                }))
              }
              value={publicationDraft.revision}
            />
            <TextField
              label="Publicado em"
              name="publicationDate"
              onChange={(_name, value) =>
                setPublicationDraft((current) => ({
                  ...current,
                  publishedAt: value,
                }))
              }
              type="datetime-local"
              value={publicationDraft.publishedAt}
            />
            <SelectField
              label="Status"
              name="publicationStatus"
              onChange={(_name, value) =>
                setPublicationDraft((current) => ({
                  ...current,
                  status: value,
                }))
              }
              options={PUBLICATION_STATUSES}
              required
              value={publicationDraft.status}
            />
            <label className="field catalogHistoryDescription">
              <span>Descrição da publicação</span>
              <textarea
                onChange={(event) =>
                  setPublicationDraft((current) => ({
                    ...current,
                    description: event.target.value,
                  }))
                }
                rows={3}
                value={publicationDraft.description}
              />
            </label>
            <button
              className="secondaryButton"
              disabled={!publicationDraft.version.trim()}
              onClick={addPublication}
              type="button"
            >
              Adicionar publicação
            </button>
          </div>
          <HistoryItems
            empty="Nenhuma publicação registrada."
            items={[...(draft.publications || [])].reverse()}
            renderItem={(publication) => (
              <>
                <strong>{publication.version}</strong>
                <SelectField
                  label="Status da publicação"
                  name={`publicationStatus-${publication.id}`}
                  onChange={(_name, status) =>
                    update(
                      "publications",
                      (draft.publications || []).map((item) =>
                        item.id === publication.id ? { ...item, status } : item,
                      ),
                    )
                  }
                  options={PUBLICATION_STATUSES}
                  required
                  value={publication.status || "deployed"}
                />
                <small>
                  {formatDate(publication.publishedAt)}
                  {publication.revision ? ` · ${publication.revision}` : ""}
                </small>
                {publication.description ? (
                  <p>{publication.description}</p>
                ) : null}
              </>
            )}
          />
        </div>
      </EntityFieldGroup>
    </>
  );
}
