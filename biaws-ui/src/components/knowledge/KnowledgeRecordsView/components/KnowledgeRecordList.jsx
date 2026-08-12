import {
  Archive,
  ArchiveRestore,
  BookMarked,
  FileText,
  GripVertical,
  Trash2,
} from "lucide-react";

import { IllustratedEmptyState } from "../../../shared/IllustratedEmptyState.jsx";
import { DOCUMENT_TYPES, statusLabel } from "../model.js";

function KnowledgeRecordCard({
  canArchive,
  onArchive,
  onDelete,
  onOpen,
  onRestore,
  record,
}) {
  const config = DOCUMENT_TYPES[record.documentType];
  const TypeIcon = config?.icon || FileText;
  return (
    <article className="procedureCard knowledgeRecordCard">
      <button
        aria-label={`Abrir ${record.title}`}
        className="knowledgeRecordOpenButton"
        onClick={() => onOpen(record)}
        type="button"
      />
      <header>
        <div>
          <GripVertical size={15} />
          <TypeIcon size={18} />
          <h2>{record.title}</h2>
          <span
            className={`documentTypeBadge documentType-${record.documentType}`}
          >
            {config?.label || record.documentType}
          </span>
        </div>
        <div>
          {canArchive && record.status !== "archived" ? (
            <button
              className="iconButton dangerIconButton"
              onClick={(event) => {
                event.stopPropagation();
                onArchive(record);
              }}
              title="Arquivar"
              type="button"
            >
              <Archive size={16} />
            </button>
          ) : null}
          {canArchive && record.status === "archived" ? (
            <>
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
            </>
          ) : null}
        </div>
      </header>
      <p>{record.summary}</p>
      <p className="procedureCardSummary">
        {statusLabel(record)} · definida em{" "}
        {record.definedAt || "data não informada"}
      </p>
    </article>
  );
}

export function KnowledgeRecordList({
  canArchive,
  loading,
  onArchive,
  onDelete,
  onOpen,
  onRestore,
  records,
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
            onArchive={onArchive}
            onDelete={onDelete}
            onOpen={onOpen}
            onRestore={onRestore}
            record={record}
          />
        ))}
      </div>
    </section>
  );
}
