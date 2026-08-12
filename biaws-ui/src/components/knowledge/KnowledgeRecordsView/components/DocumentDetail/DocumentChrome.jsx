import {
  Archive,
  CopyPlus,
  Download,
  Save,
  Settings2,
  Trash2,
  X,
} from "lucide-react";

import { MarkdownPreview } from "../../../../shared/MarkdownEditor/index.jsx";
import { DOCUMENT_TABS } from "../../model.js";

function DocumentActionButtons({ onExport, onReplicate }) {
  return (
    <>
      <button
        aria-label="Exportar documento"
        className="iconButton"
        onClick={onExport}
        title="Exportar"
        type="button"
      >
        <Download aria-hidden="true" size={16} />
      </button>
      {onReplicate ? (
        <button
          aria-label="Replicar documento"
          className="iconButton"
          onClick={onReplicate}
          title="Replicar"
          type="button"
        >
          <CopyPlus aria-hidden="true" size={16} />
        </button>
      ) : null}
    </>
  );
}

export function KnowledgeRecordHeader({
  canUpdate,
  config,
  draft,
  onClose,
  onExport,
  onReplicate,
  onSave,
  saving,
  titleId,
}) {
  const TypeIcon = config.icon;
  return (
    <header className="knowledgeRecordHeader">
      <div className="knowledgeRecordTitle">
        <TypeIcon className="knowledgeDocumentTypeIcon" size={44} />
        <div>
          <span
            className={`documentTypeBadge documentType-${draft.documentType}`}
          >
            {config.label}
          </span>
          <h2 id={titleId}>{draft.title || config.label}</h2>
        </div>
      </div>
      <div className="knowledgeRecordActions">
        {draft.id ? (
          <DocumentActionButtons
            onExport={onExport}
            onReplicate={onReplicate}
          />
        ) : null}
        {canUpdate ? (
          <button
            className="primaryButton"
            disabled={saving}
            onClick={() => onSave()}
            type="button"
          >
            <Save size={16} /> {saving ? "Salvando..." : "Salvar"}
          </button>
        ) : null}
        {draft.id ? (
          <button
            aria-label="Fechar detalhes"
            className="iconButton knowledgeDocumentModeButton"
            data-dialog-close
            onClick={onClose}
            type="button"
          >
            <X size={18} />
          </button>
        ) : null}
      </div>
    </header>
  );
}

export function KnowledgeRecordFooter({
  canArchive,
  canDelete,
  draft,
  onArchive,
  onDelete,
}) {
  if (!draft.id || (!canArchive && !canDelete)) return null;

  const archived = draft.status === "archived";
  return (
    <footer className="knowledgeRecordFooter">
      {archived && canDelete ? (
        <button className="dangerButton" onClick={onDelete} type="button">
          <Trash2 aria-hidden="true" size={16} /> Excluir definitivamente
        </button>
      ) : null}
      {!archived && canArchive ? (
        <button className="secondaryButton" onClick={onArchive} type="button">
          <Archive aria-hidden="true" size={16} /> Arquivar
        </button>
      ) : null}
    </footer>
  );
}

export function KnowledgeDocumentReading({
  config,
  contentRef,
  draft,
  onExport,
  onReplicate,
  onShowDetails,
}) {
  const TypeIcon = config.icon;
  return (
    <section className="resourceCollectionContent knowledgeRecordDetail knowledgeDocumentReading">
      <header className="knowledgeRecordHeader knowledgeDocumentReadingHeader">
        <div className="knowledgeRecordTitle">
          <TypeIcon className="knowledgeDocumentTypeIcon" size={44} />
          <div>
            <span
              className={`documentTypeBadge documentType-${draft.documentType}`}
            >
              {config.label}
            </span>
            <h2>{draft.title}</h2>
          </div>
        </div>
        <div className="knowledgeRecordActions">
          {/*
            <DocumentActionButtons
              onExport={onExport}
              onReplicate={onReplicate}
            />
          */}
          <button
            className="primaryButton"
            onClick={onShowDetails}
            type="button"
          >
            <Settings2 size={15} />
            Detalhes
          </button>
        </div>
      </header>
      <article className="knowledgeDocumentMarkdown" ref={contentRef}>
        <MarkdownPreview value={draft.markdown} />
      </article>
    </section>
  );
}

export function KnowledgeRecordTabs({
  canReadAttachments,
  documentId,
  onSelect,
  tab,
}) {
  const visibleTabs = documentId
    ? DOCUMENT_TABS.filter(([key]) => key !== "files" || canReadAttachments)
    : DOCUMENT_TABS.filter(
        ([key]) =>
          !["files", "observations", "revisions", "history"].includes(key),
      );
  return (
    <nav
      aria-label="Detalhes do documento"
      className="detailTabs knowledgeRecordTabs"
    >
      {visibleTabs.map(([key, label]) => (
        <button
          className={tab === key ? "detailTab activeDetailTab" : "detailTab"}
          key={key}
          onClick={() => onSelect(key)}
          type="button"
        >
          {label}
        </button>
      ))}
    </nav>
  );
}
