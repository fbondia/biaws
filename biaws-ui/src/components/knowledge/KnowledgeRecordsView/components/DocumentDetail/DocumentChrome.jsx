import { Archive, Save, Settings2, X } from "lucide-react";

import { MarkdownPreview } from "../../../../shared/MarkdownEditor/index.jsx";
import { DOCUMENT_TABS } from "../../model.js";

export function KnowledgeRecordHeader({
  canArchive,
  canUpdate,
  config,
  draft,
  onArchive,
  onClose,
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
        {draft.id && canArchive ? (
          <button className="secondaryButton" onClick={onArchive} type="button">
            <Archive size={16} /> Arquivar
          </button>
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

export function KnowledgeDocumentReading({ config, draft, onShowDetails }) {
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
        <button
          className="knowledgeDetailsButton"
          onClick={onShowDetails}
          type="button"
        >
          <Settings2 size={15} />
          Detalhes
        </button>
      </header>
      <article className="knowledgeDocumentMarkdown">
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
