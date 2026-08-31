import {
  COMPONENT_TYPES,
  REPOSITORY_PROVIDERS,
  SERVER_STATUSES,
} from "../constants.js";
import { MarkdownEditor } from "../../../shared/MarkdownEditor/index.jsx";
import {
  EntityFieldGroup,
  MultiSelectField,
  SelectField,
  TextField,
} from "./Fields.jsx";

export function BasicFields({
  activeSection,
  draft,
  editing,
  entity,
  kind,
  options,
  sections,
  update,
}) {
  const basicActive = !sections.length || activeSection === "basic";
  return (
    <>
      <EntityFieldGroup active={basicActive}>
        <TextField
          label="Identificador"
          name="key"
          onChange={update}
          placeholder="exemplo-estavel"
          required
          value={draft.key}
        />
      </EntityFieldGroup>
      <EntityFieldGroup active={kind !== "repository" && basicActive}>
        <TextField
          label="Nome"
          name="name"
          onChange={update}
          required
          value={draft.name}
        />
      </EntityFieldGroup>

      <EntityFieldGroup active={kind === "application"}>
        <>
          <TextField
            label="Equipe responsável"
            name="ownerTeam"
            onChange={update}
            value={draft.ownerTeam}
          />
          <TextField
            label="Contato"
            name="ownerContact"
            onChange={update}
            value={draft.ownerContact}
          />
          <TextField
            label="Tags, separadas por vírgula"
            name="tagsText"
            onChange={update}
            value={draft.tagsText}
          />
        </>
      </EntityFieldGroup>

      <EntityFieldGroup active={kind === "component"}>
        <>
          <SelectField
            label="Tipo"
            name="type"
            onChange={update}
            options={COMPONENT_TYPES}
            required
            value={draft.type}
          />
          <TextField
            label="Tags, separadas por vírgula"
            name="tagsText"
            onChange={update}
            value={draft.tagsText}
          />
          <MultiSelectField
            label="Repositórios"
            name="repositoryIds"
            onChange={update}
            options={options.repositories || []}
            value={draft.repositoryIds}
          />
          <MultiSelectField
            label="Dependências"
            name="dependencyIds"
            onChange={update}
            options={(options.components || []).filter(
              ({ id }) => id !== entity?.id,
            )}
            value={draft.dependencyIds}
          />
        </>
      </EntityFieldGroup>

      <EntityFieldGroup active={kind === "integration"}>
        {!editing ? (
          <SelectField
            label="Aplicação integrada"
            name="targetApplicationId"
            onChange={update}
            options={(options.applications || []).map(({ id, name }) => ({
              value: id,
              label: name,
            }))}
            required
            value={draft.targetApplicationId}
          />
        ) : (
          <TextField
            disabled
            label="Aplicação integrada"
            name="targetApplicationName"
            onChange={() => {}}
            value={
              (options.applications || []).find(
                ({ id }) => id === draft.targetApplicationId,
              )?.name || draft.targetApplicationId
            }
          />
        )}
      </EntityFieldGroup>

      <EntityFieldGroup active={kind === "repository"}>
        <div className="catalogRepositoryForm">
          <TextField
            className="catalogRepositoryPrimaryField"
            label="Nome"
            name="name"
            onChange={update}
            required
            value={draft.name}
          />
          <TextField
            className="catalogRepositoryPrimaryField"
            label="URL HTTP(S), sem credenciais"
            name="url"
            onChange={update}
            required
            type="url"
            value={draft.url}
          />
          <SelectField
            className="catalogRepositorySecondaryField"
            label="Provedor"
            name="provider"
            onChange={update}
            options={REPOSITORY_PROVIDERS}
            required
            value={draft.provider}
          />
          <TextField
            className="catalogRepositorySecondaryField"
            label="Branch padrão"
            name="defaultBranch"
            onChange={update}
            value={draft.defaultBranch}
          />
          <TextField
            className="catalogRepositorySecondaryField"
            label="Organização"
            name="organization"
            onChange={update}
            value={draft.organization}
          />
        </div>
      </EntityFieldGroup>

      <EntityFieldGroup active={kind === "server"}>
        <>
          <TextField
            label="Hostname"
            name="hostname"
            onChange={update}
            value={draft.hostname}
          />
          <TextField
            label="Provedor"
            name="provider"
            onChange={update}
            value={draft.provider}
          />
          <TextField
            label="Localização"
            name="location"
            onChange={update}
            value={draft.location}
          />
          <TextField
            label="Sistema operacional"
            name="operatingSystem"
            onChange={update}
            value={draft.operatingSystem}
          />
          <TextField
            label="Finalidade"
            name="purpose"
            onChange={update}
            value={draft.purpose}
          />
          <SelectField
            label="Status"
            name="status"
            onChange={update}
            options={SERVER_STATUSES}
            required
            value={draft.status}
          />
          <TextField
            label="Tags, separadas por vírgula"
            name="tagsText"
            onChange={update}
            value={draft.tagsText}
          />
          <label className="field catalogWideField">
            <span>Endereços, um por linha</span>
            <textarea
              onChange={(event) => update("addressesText", event.target.value)}
              rows={3}
              value={draft.addressesText}
            />
          </label>
        </>
      </EntityFieldGroup>

      <EntityFieldGroup
        active={[
          "application",
          "component",
          "integration",
          "repository",
          "server",
        ].includes(kind)}
      >
        <label className="field catalogWideField">
          <span>Descrição</span>
          {kind === "server" ? (
            <MarkdownEditor
              onChange={(value) => update("description", value)}
              value={draft.description || ""}
            />
          ) : (
            <textarea
              onChange={(event) => update("description", event.target.value)}
              rows={4}
              value={draft.description || ""}
            />
          )}
        </label>
      </EntityFieldGroup>
    </>
  );
}
