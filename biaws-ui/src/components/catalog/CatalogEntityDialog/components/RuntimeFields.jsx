import { Eye, FolderTree } from "lucide-react";

import { MarkdownEditor } from "../../../shared/MarkdownEditor/index.jsx";
import {
  DOCUMENT_PURPOSES,
  RUNTIME_KINDS,
  RUNTIME_STATUSES,
} from "../constants.js";
import { EntityFieldGroup, SelectField, TextField } from "./Fields.jsx";
import {
  RuntimeMonitoringConfiguration,
  RuntimeMonitoringHistory,
  RuntimeMonitoringTabs,
} from "../../../monitoring/runtime/index.js";

export function RuntimeFields({
  activeSection,
  controller,
  entity,
  kind,
  options,
}) {
  const {
    draft,
    editing,
    relatedDocuments,
    relatedDocumentsLoading,
    setDocumentSelectorOpen,
    setSelectedDocument,
    update,
    updateDocumentPurpose,
  } = controller;
  return (
    <>
      <EntityFieldGroup
        active={kind === "runtime" && activeSection === "basic"}
      >
        <>
          <SelectField
            label="Tipo"
            name="kind"
            onChange={update}
            options={RUNTIME_KINDS}
            required
            value={draft.kind}
          />
          <SelectField
            label="Servidor"
            name="serverId"
            onChange={update}
            options={(options.servers || []).map(({ id, name }) => ({
              value: id,
              label: name,
            }))}
            value={draft.serverId}
          />
          <SelectField
            label="Status"
            name="status"
            onChange={update}
            options={RUNTIME_STATUSES}
            required
            value={draft.status}
          />
        </>
      </EntityFieldGroup>

      <EntityFieldGroup
        active={kind === "runtime" && activeSection === "service"}
      >
        <>
          <TextField
            label="Endpoint"
            name="endpoint"
            onChange={update}
            type="url"
            value={draft.endpoint}
          />
          <TextField
            label="Porta"
            name="port"
            onChange={update}
            type="number"
            value={draft.port}
          />
          <TextField
            label="Namespace"
            name="namespace"
            onChange={update}
            value={draft.namespace}
          />
          <TextField
            label="Nome no runtime"
            name="runtimeName"
            onChange={update}
            value={draft.runtimeName}
          />
          <label className="field catalogWideField">
            <span>Metadata JSON sem segredos</span>
            <textarea
              onChange={(event) => update("metadataText", event.target.value)}
              rows={5}
              value={draft.metadataText}
            />
          </label>
        </>
      </EntityFieldGroup>

      <EntityFieldGroup
        active={kind === "runtime" && activeSection === "monitoring"}
      >
        <RuntimeMonitoringTabs
          configuration={
            <RuntimeMonitoringConfiguration
              controller={controller}
              draft={draft}
              editing={editing}
              options={options}
              update={update}
            />
          }
          history={
            <RuntimeMonitoringHistory
              controller={controller}
              editing={editing}
              entity={entity}
              options={options}
            />
          }
        />
      </EntityFieldGroup>

      <EntityFieldGroup
        active={kind === "runtime" && activeSection === "documents"}
      >
        <>
          {options.canReadDocuments ? (
            <div className="catalogWideField runtimeProcedureSection">
              <div className="runtimeProcedureSelectionField">
                <div>
                  <strong>Documentos relacionados</strong>
                  <span>
                    {(draft.documentLinks || []).length
                      ? `${draft.documentLinks.length} documento(s) selecionado(s)`
                      : "Nenhum documento selecionado"}
                  </span>
                </div>
                <button
                  className="secondaryButton"
                  onClick={() => setDocumentSelectorOpen(true)}
                  type="button"
                >
                  <FolderTree size={16} /> Selecionar documentos
                </button>
              </div>
              {relatedDocumentsLoading ? (
                <div className="catalogColumnEmpty">Carregando…</div>
              ) : null}
              {!relatedDocumentsLoading && relatedDocuments.length ? (
                <div className="runtimeRelatedProcedureList">
                  {relatedDocuments.map((document) => (
                    <article key={document.id}>
                      <div>
                        <strong>{document.title}</strong>
                        <span>
                          {document.loadError
                            ? document.loadError
                            : document.summary || "Sem sumário"}
                        </span>
                      </div>
                      <select
                        aria-label={`Finalidade de ${document.title}`}
                        disabled={Boolean(document.loadError)}
                        onChange={(event) =>
                          updateDocumentPurpose(document.id, event.target.value)
                        }
                        value={
                          (draft.documentLinks || []).find(
                            ({ documentId }) => documentId === document.id,
                          )?.purpose || "reference"
                        }
                      >
                        {DOCUMENT_PURPOSES.map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                      <button
                        className="secondaryButton"
                        disabled={Boolean(document.loadError)}
                        onClick={() => setSelectedDocument(document)}
                        type="button"
                      >
                        <Eye size={16} /> Abrir dados
                      </button>
                    </article>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
          <label className="field catalogWideField catalogProcedureField">
            <span>Instruções complementares (Markdown)</span>
            <MarkdownEditor
              onChange={(value) => update("operationalNotesMarkdown", value)}
              value={draft.operationalNotesMarkdown || ""}
            />
            <small>
              Use este campo para instruções específicas deste runtime ou quando
              não quiser criar um documento reutilizável.
            </small>
          </label>
        </>
      </EntityFieldGroup>
    </>
  );
}
