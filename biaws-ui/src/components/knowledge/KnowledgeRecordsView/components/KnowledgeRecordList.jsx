import {
  ArchiveRestore,
  BookMarked,
  FileText,
  GripVertical,
  Trash2,
} from "lucide-react";

import { IllustratedEmptyState } from "../../../shared/IllustratedEmptyState.jsx";
import { DOCUMENT_TYPES, statusLabel } from "../model.js";

function formatDefinedAt(value) {
  if (!value) return "Data não informada";

  const [year, month, day] = String(value).slice(0, 10).split("-");
  if (!year || !month || !day) return value;
  return `${day}/${month}/${year}`;
}

function KnowledgeRecordCard({
  canArchive,
  onDelete,
  onOpen,
  onRestore,
  onToggleSelection,
  record,
  selected,
}) {
  const config = DOCUMENT_TYPES[record.documentType];
  const TypeIcon = config?.icon || FileText;
  return (
    <article
      className={
        selected
          ? "procedureCard knowledgeRecordCard bulkSelectedCard"
          : "procedureCard knowledgeRecordCard"
      }
    >
      <button
        aria-label={`Abrir ${record.title}`}
        className="knowledgeRecordOpenButton"
        onClick={() => onOpen(record)}
        type="button"
      />
      <header>
        <div className="knowledgeRecordCardTitle">
          <input
            aria-label={
              record.identifier
                ? `Selecionar ${record.title} para replicação`
                : `${record.title} não pode ser replicado sem identificador`
            }
            checked={selected}
            className="bulkSelectionCheckbox knowledgeRecordSelectionCheckbox"
            disabled={!record.identifier}
            onChange={() => onToggleSelection(record.id)}
            onClick={(event) => event.stopPropagation()}
            title={
              record.identifier
                ? undefined
                : "Defina um identificador antes de replicar este documento"
            }
            type="checkbox"
          />
          <GripVertical aria-hidden="true" size={15} />
          <TypeIcon aria-hidden="true" size={18} />
          <div className="knowledgeRecordCardHeading">
            <h2>{record.title}</h2>
            <code
              className={
                record.identifier ? "" : "knowledgeRecordMissingIdentifier"
              }
              title={record.identifier || "Documento sem identificador"}
            >
              {record.identifier || "Sem identificador"}
            </code>
          </div>
        </div>
        <div className="knowledgeRecordCardHeaderMeta">
          <span
            className={`documentTypeBadge documentType-${record.documentType}`}
          >
            {config?.label || record.documentType}
          </span>
          {canArchive && record.status === "archived" ? (
            <div className="knowledgeRecordLifecycleActions">
              <button
                className="iconButton"
                onClick={(event) => {
                  event.stopPropagation();
                  onRestore(record);
                }}
                title="Desarquivar"
                type="button"
              >
                <ArchiveRestore size={16} />
              </button>
              <button
                className="iconButton dangerIconButton"
                onClick={(event) => {
                  event.stopPropagation();
                  onDelete(record);
                }}
                title="Excluir definitivamente"
                type="button"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ) : null}
        </div>
      </header>
      <p className="knowledgeRecordCardSummary">{record.summary}</p>
      <footer className="knowledgeRecordCardFooter">
        <span
          className={`knowledgeRecordStatusChip knowledgeRecordStatus-${record.status}`}
        >
          {statusLabel(record)}
        </span>
        <time
          className="knowledgeRecordDefinedAt"
          dateTime={record.definedAt || undefined}
        >
          Definido em {formatDefinedAt(record.definedAt)}
        </time>
      </footer>
    </article>
  );
}

export function KnowledgeRecordList({
  canArchive,
  loading,
  onDelete,
  onOpen,
  onRestore,
  onToggleSelection,
  records,
  selectedRecordIds,
}) {
  return (
    <section className="resourceCollectionContent">
      {loading ? (
        <div className="loadingLine">Carregando documentos...</div>
      ) : null}
      {!loading && !records.length ? (
        <IllustratedEmptyState
          description="Crie o primeiro documento para registrar conhecimento governado do workspace."
          icon={BookMarked}
          title="Nenhum documento encontrado"
        />
      ) : null}
      <div className="procedureCards">
        {records.map((record) => (
          <KnowledgeRecordCard
            canArchive={canArchive}
            key={record.id}
            onDelete={onDelete}
            onOpen={onOpen}
            onRestore={onRestore}
            onToggleSelection={onToggleSelection}
            record={record}
            selected={selectedRecordIds.includes(record.id)}
          />
        ))}
      </div>
    </section>
  );
}
