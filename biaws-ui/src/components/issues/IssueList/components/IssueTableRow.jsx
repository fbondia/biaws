import { Crown } from "lucide-react";

import {
  ALL_STATUS_OPTIONS,
  ALL_TYPE_OPTIONS,
  DEFAULT_TAG_GROUP_COLOR,
} from "../../../../constants/issues.js";
import {
  formatDate,
  formatTaxonomyPath,
  issueDate,
  statusClass,
  textPreview,
} from "../../../../utils/issues.js";
import { issueTagItems, issueTaxonomyItems, optionLabel } from "../model.js";
import { EntityIdentifier } from "../../../shared/EntityIdentifier/index.jsx";

export function IssueTableRow({
  applicationsById,
  dateField,
  editableStatusOptions,
  editableTypeOptions,
  issue,
  loading,
  onOpenIssue,
  onUpdateIssueField,
  tagGroupsById,
  taxonomyItemsById,
  updatingIssueField,
}) {
  const tagItems = issueTagItems(issue, tagGroupsById);
  const taxonomyItems = issueTaxonomyItems(issue, taxonomyItemsById);

  function openIssueFromKeyboard(event) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onOpenIssue(issue);
    }
  }

  return (
    <tr
      className="clickableRow"
      onClick={() => onOpenIssue(issue)}
      onKeyDown={openIssueFromKeyboard}
      role="button"
      tabIndex={0}
      title="Abrir detalhes"
    >
      <td className="codeCell" data-label="Código">
        <EntityIdentifier
          fallback="-"
          label="Código do issue"
          value={issue.id}
        />
      </td>
      <td data-label="Tipo">
        <InlineIssueSelect
          currentValue={issue.type}
          disabled={
            loading ||
            !onUpdateIssueField ||
            updatingIssueField === `${issue.id}:type`
          }
          fallbackOptions={ALL_TYPE_OPTIONS}
          onChange={(value) => onUpdateIssueField?.(issue, "type", value)}
          options={editableTypeOptions}
        />
      </td>
      <td data-label="Status">
        <InlineIssueSelect
          className={`inlineStatusSelect ${statusClass(issue.status)}`}
          currentValue={issue.status}
          disabled={
            loading ||
            !onUpdateIssueField ||
            updatingIssueField === `${issue.id}:status`
          }
          fallbackOptions={ALL_STATUS_OPTIONS}
          onChange={(value) => onUpdateIssueField?.(issue, "status", value)}
          options={editableStatusOptions}
        />
      </td>
      <td data-label="Data">{formatDate(issueDate(issue, dateField))}</td>
      <td className="titleCell" data-label="Título">
        {issue.title || "-"}
      </td>
      <td className="applicationCell" data-label="Aplicação">
        {applicationsById[issue.applicationId]?.name ||
          issue.applicationName ||
          "-"}
      </td>
      <td className="taxonomyCell" data-label="Assuntos">
        {taxonomyItems.length ? (
          <TaxonomyPills taxonomyItems={taxonomyItems} />
        ) : (
          "-"
        )}
      </td>
      <td className="tagsCell" data-label="Tags">
        {tagItems.length ? <TagPills tagItems={tagItems} /> : "-"}
      </td>
      <td className="textCell" data-label="Texto">
        {textPreview(issue.text)}
      </td>
    </tr>
  );
}

function InlineIssueSelect({
  className = "",
  currentValue,
  disabled,
  fallbackOptions,
  onChange,
  options,
}) {
  const hasCurrentValue = options.some(
    (option) => option.value === currentValue,
  );

  return (
    <select
      className={`inlineIssueSelect ${className}`.trim()}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
      value={hasCurrentValue ? currentValue : ""}
    >
      {hasCurrentValue ? null : (
        <option value="" disabled>
          {optionLabel(fallbackOptions, currentValue)}
        </option>
      )}
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

function TaxonomyPills({ taxonomyItems }) {
  return (
    <div className="issueTaxonomyList">
      {taxonomyItems.map((taxonomy) => (
        <span
          className={
            taxonomy.isPrimary
              ? "issueTaxonomyPill primaryIssueTaxonomyPill"
              : "issueTaxonomyPill"
          }
          key={taxonomy.id}
          title={taxonomy.path.join(" / ")}
        >
          {taxonomy.isPrimary ? (
            <Crown
              className="primaryTaxonomyIcon"
              size={13}
              aria-hidden="true"
            />
          ) : null}
          {formatTaxonomyPath(taxonomy.path)}
        </span>
      ))}
    </div>
  );
}

function TagPills({ tagItems }) {
  return (
    <div className="issueTagList">
      {tagItems.map((item) => (
        <span
          className="issueTagPill"
          key={`${item.group.id}-${item.tagId}`}
          style={{
            borderColor: item.group.color || DEFAULT_TAG_GROUP_COLOR,
          }}
          title={item.group.label}
        >
          <span
            className="tagColorSwatch"
            style={{
              backgroundColor: item.group.color || DEFAULT_TAG_GROUP_COLOR,
            }}
          />
          {item.tagId}
        </span>
      ))}
    </div>
  );
}
