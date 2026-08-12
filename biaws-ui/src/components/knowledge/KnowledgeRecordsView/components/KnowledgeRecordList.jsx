import { Archive, BookMarked, FileText, GripVertical } from "lucide-react";

import { IllustratedEmptyState } from "../../../shared/IllustratedEmptyState.jsx";
import { DOCUMENT_TYPES, statusLabel } from "../model.js";

function KnowledgeRecordCard({ canArchive, onArchive, onOpen, record }) {
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
        </div>
        <div>
          {canArchive ? (
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
        </div>
      </header>
      <span className={`documentTypeBadge documentType-${record.documentType}`}>
        {config?.label || record.documentType}
      </span>
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
  onOpen,
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
            onOpen={onOpen}
            record={record}
          />
        ))}
      </div>
    </section>
  );
}
