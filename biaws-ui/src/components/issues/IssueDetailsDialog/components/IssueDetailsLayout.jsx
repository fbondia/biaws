import { X } from "lucide-react";

import { ALL_STATUS_OPTIONS } from "../../../../constants/issues.js";
import { formatDate, statusClass } from "../../../../utils/issues.js";
import {
  DETAIL_TABS,
  getTaxonomyDisplayValue,
  optionLabel,
} from "./ClassificationControls.jsx";
import { EntityIdentifier } from "../../../shared/EntityIdentifier/index.jsx";

export function IssueDetailsLayout({
  activeTab,
  children,
  closeOnBackdrop,
  editableStatusOptions,
  error,
  issue,
  loading,
  onClose,
  onUpdateIssueField,
  persistedClassification,
  selectedTagEntries,
  setActiveTab,
  taxonomyById,
  TypeIcon,
  typeLabel,
  updatingIssueField,
}) {
  const hasCurrentStatus = editableStatusOptions.some(
    (option) => option.value === issue.status,
  );
  return (
    <div className="dialogBackdrop" onMouseDown={closeOnBackdrop}>
      <section
        aria-labelledby="issue-dialog-title"
        aria-modal="true"
        className="issueDialog"
        role="dialog"
      >
        <header className="dialogHeader">
          <div className="dialogTitleBlock">
            <div className="dialogKicker">
              <EntityIdentifier
                fallback="Issue"
                label="Código do issue"
                value={issue.id}
                variant="chip"
              />
              <span className="typeBadge">
                <TypeIcon size={14} />
                {typeLabel}
              </span>
              <select
                aria-label="Status do issue"
                className={`dialogStatusSelect inlineIssueSelect inlineStatusSelect ${statusClass(issue.status)}`}
                disabled={
                  loading ||
                  updatingIssueField === `${issue.id}:status` ||
                  !onUpdateIssueField
                }
                onChange={(event) =>
                  onUpdateIssueField?.(issue, "status", event.target.value)
                }
                value={hasCurrentStatus ? issue.status : ""}
              >
                {hasCurrentStatus ? null : (
                  <option value="" disabled>
                    {optionLabel(ALL_STATUS_OPTIONS, issue.status)}
                  </option>
                )}
                {editableStatusOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <h2 id="issue-dialog-title">
              {issue.title || "Detalhes do issue"}
            </h2>
          </div>
          <button
            className="iconButton"
            type="button"
            onClick={onClose}
            title="Fechar"
          >
            <X size={18} />
          </button>
        </header>

        <div className="dialogBody">
          {error ? <div className="errorBox dialogError">{error}</div> : null}
          {loading ? (
            <div className="loadingLine">Carregando detalhes...</div>
          ) : null}

          <section className="detailGrid" aria-label="Dados do issue">
            <div>
              <span>Recebimento</span>
              <strong>{formatDate(issue.dates?.receivedEmailAt)}</strong>
            </div>
            <div>
              <span>Criação</span>
              <strong>{formatDate(issue.dates?.issueCreatedAt)}</strong>
            </div>
            <div>
              <span>Atualização</span>
              <strong>{formatDate(issue.updatedAt)}</strong>
            </div>
            <div>
              <span>Fechamento</span>
              <strong>{formatDate(issue.dates?.closedAt)}</strong>
            </div>
            <div className="detailTaxonomyCard">
              <span>Assunto principal</span>
              <strong>
                {getTaxonomyDisplayValue(
                  taxonomyById,
                  persistedClassification.primaryTaxonomyId,
                )}
              </strong>
            </div>
            <div className="detailTaxonomyCard">
              <span>Assuntos secundários</span>
              <strong>
                {persistedClassification.secondaryTaxonomyIds.length
                  ? persistedClassification.secondaryTaxonomyIds
                      .map((taxonomyId) =>
                        getTaxonomyDisplayValue(taxonomyById, taxonomyId),
                      )
                      .join("; ")
                  : "Sem classificação"}
              </strong>
            </div>
            <div className="detailTaxonomyCard detailTagsCard">
              <span>Tags</span>
              {selectedTagEntries.length ? (
                <div className="detailTagList">
                  {selectedTagEntries.map((tag) => (
                    <span
                      className="issueTagPill"
                      key={`${tag.groupLabel}-${tag.tagId}`}
                    >
                      <span
                        className="tagColorSwatch"
                        style={{ backgroundColor: tag.color }}
                      />
                      {tag.groupLabel}: {tag.tagId}
                    </span>
                  ))}
                </div>
              ) : (
                <strong>Sem tags</strong>
              )}
            </div>
          </section>

          <div
            className="detailTabs"
            role="tablist"
            aria-label="Conteúdo do issue"
          >
            {DETAIL_TABS.map((tab) => (
              <button
                aria-selected={activeTab === tab.key}
                className={
                  activeTab === tab.key
                    ? "detailTab activeDetailTab"
                    : "detailTab"
                }
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                role="tab"
                type="button"
              >
                {tab.label}
              </button>
            ))}
          </div>

          {children}
        </div>
      </section>
    </div>
  );
}
