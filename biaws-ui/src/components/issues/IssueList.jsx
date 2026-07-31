import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Crown,
  Plus,
  Upload,
} from "lucide-react";

import {
  ALL_STATUS_OPTIONS,
  ALL_TYPE_OPTIONS,
  DEFAULT_TAG_GROUP_COLOR,
  STATUS_OPTIONS,
  TYPE_OPTIONS,
} from "../../constants/issues.js";
import {
  formatDate,
  formatTaxonomyPath,
  issueDate,
  statusClass,
  textPreview,
} from "../../utils/issues.js";

function buildTagGroupsById(taxonomyPackage) {
  return Object.fromEntries(
    (taxonomyPackage?.tagGroups || []).map((group) => [group.id, group]),
  );
}

function buildTaxonomyItemsById(nodes = [], path = []) {
  return nodes.reduce((itemsById, node) => {
    const currentPath = [...path, node.label];

    return {
      ...itemsById,
      [node.id]: {
        id: node.id,
        label: node.label,
        path: currentPath,
      },
      ...buildTaxonomyItemsById(node.children || [], currentPath),
    };
  }, {});
}

function taxonomyItem(taxonomyId, taxonomyItemsById) {
  return (
    taxonomyItemsById[taxonomyId] || {
      id: taxonomyId,
      label: taxonomyId,
      path: [taxonomyId],
    }
  );
}

function issueTaxonomyItems(issue, taxonomyItemsById) {
  const primaryTaxonomyId = issue.classification?.primaryTaxonomyId || "";
  const taxonomyIds = [
    primaryTaxonomyId,
    ...(Array.isArray(issue.classification?.secondaryTaxonomyIds)
      ? issue.classification.secondaryTaxonomyIds
      : []),
  ].filter(Boolean);

  return [...new Set(taxonomyIds)].map((taxonomyId) => ({
    ...taxonomyItem(taxonomyId, taxonomyItemsById),
    isPrimary: taxonomyId === primaryTaxonomyId,
  }));
}

function issueTagItems(issue, tagGroupsById) {
  const tags = issue.classification?.tags || {};

  return Object.entries(tags).flatMap(([groupId, tagIds]) => {
    const group = tagGroupsById[groupId] || {
      id: groupId,
      label: groupId,
      color: DEFAULT_TAG_GROUP_COLOR,
    };

    return (Array.isArray(tagIds) ? tagIds : []).map((tagId) => ({
      group,
      tagId,
    }));
  });
}

function optionLabel(options, value) {
  return (
    options.find((option) => option.value === value)?.label || value || "-"
  );
}

function SortableHeader({ field, label, loading, onSort, sort }) {
  const activeField = sort.startsWith("-") ? sort.slice(1) : sort;
  const active = activeField === field;
  const descending = active && sort.startsWith("-");
  const Icon = active ? (descending ? ArrowDown : ArrowUp) : ArrowUpDown;

  return (
    <th
      className="sortableTableHeader"
      aria-sort={active ? (descending ? "descending" : "ascending") : "none"}
    >
      <button
        className={
          active
            ? "sortableColumnHeader activeSortableColumnHeader"
            : "sortableColumnHeader"
        }
        disabled={loading}
        onClick={() => onSort(field)}
        title={`Ordenar por ${label.toLowerCase()}`}
        type="button"
      >
        {label}
        <Icon aria-hidden="true" size={14} />
      </button>
    </th>
  );
}

export function IssueList({
  applications = [],
  dateField,
  items,
  loading,
  meta,
  onNextPage,
  onOpenCreate,
  onOpenImport,
  onOpenIssue,
  onPreviousPage,
  onSort,
  onUpdateIssueField,
  page,
  taxonomyPackage,
  totalPages,
  sort,
  updatingIssueField,
}) {
  const applicationsById = Object.fromEntries(
    applications.map((application) => [application.id, application]),
  );
  const tagGroupsById = buildTagGroupsById(taxonomyPackage);
  const taxonomyItemsById = buildTaxonomyItemsById(
    taxonomyPackage?.taxonomy || [],
  );
  const editableTypeOptions = TYPE_OPTIONS.filter((option) => option.value);
  const editableStatusOptions = STATUS_OPTIONS.filter((option) => option.value);

  return (
    <section className="tableBand" aria-busy={loading}>
      <div className="tableHeader">
        <div>
          <h2>Chamados e Solicitações</h2>
          <span>
            Página {meta.page || page} de {totalPages}
          </span>
        </div>
        <div className="pagination">
          {onOpenCreate ? (
            <button
              className="primaryButton"
              onClick={onOpenCreate}
              type="button"
            >
              <Plus size={16} />
              Incluir issue
            </button>
          ) : null}
          {onOpenImport ? (
            <button
              className="secondaryButton"
              onClick={onOpenImport}
              type="button"
            >
              <Upload size={16} />
              Importar
            </button>
          ) : null}
          <button
            className="iconButton"
            disabled={loading || page <= 1}
            onClick={onPreviousPage}
            title="Página anterior"
            type="button"
          >
            <ChevronLeft size={18} />
          </button>
          <button
            className="iconButton"
            disabled={loading || page >= totalPages}
            onClick={onNextPage}
            title="Próxima página"
            type="button"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      <div className="tableWrap">
        <table className="issueTable">
          <thead>
            <tr>
              <SortableHeader
                field="id"
                label="Código"
                loading={loading}
                onSort={onSort}
                sort={sort}
              />
              <SortableHeader
                field="type"
                label="Tipo"
                loading={loading}
                onSort={onSort}
                sort={sort}
              />
              <SortableHeader
                field="status"
                label="Status"
                loading={loading}
                onSort={onSort}
                sort={sort}
              />
              <SortableHeader
                field="date"
                label="Data"
                loading={loading}
                onSort={onSort}
                sort={sort}
              />
              <SortableHeader
                field="title"
                label="Título"
                loading={loading}
                onSort={onSort}
                sort={sort}
              />
              <th>Aplicação</th>
              <th>Assuntos</th>
              <th>Tags</th>
              <th>Texto</th>
            </tr>
          </thead>
          <tbody>
            {items.map((issue) => {
              const tagItems = issueTagItems(issue, tagGroupsById);
              const taxonomyItems = issueTaxonomyItems(
                issue,
                taxonomyItemsById,
              );

              return (
                <tr
                  className="clickableRow"
                  key={issue.id || issue._id}
                  onClick={() => onOpenIssue(issue)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      onOpenIssue(issue);
                    }
                  }}
                  role="button"
                  tabIndex={0}
                  title="Abrir detalhes"
                >
                  <td className="codeCell" data-label="Código">
                    {issue.id || "-"}
                  </td>
                  <td data-label="Tipo">
                    <select
                      className="inlineIssueSelect"
                      disabled={
                        loading ||
                        !onUpdateIssueField ||
                        updatingIssueField === `${issue.id}:type`
                      }
                      onChange={(event) =>
                        onUpdateIssueField?.(issue, "type", event.target.value)
                      }
                      onClick={(event) => event.stopPropagation()}
                      onKeyDown={(event) => event.stopPropagation()}
                      value={
                        editableTypeOptions.some(
                          (option) => option.value === issue.type,
                        )
                          ? issue.type
                          : ""
                      }
                    >
                      {editableTypeOptions.some(
                        (option) => option.value === issue.type,
                      ) ? null : (
                        <option value="" disabled>
                          {optionLabel(ALL_TYPE_OPTIONS, issue.type)}
                        </option>
                      )}
                      {editableTypeOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td data-label="Status">
                    <select
                      className={`inlineIssueSelect inlineStatusSelect ${statusClass(issue.status)}`}
                      disabled={
                        loading ||
                        !onUpdateIssueField ||
                        updatingIssueField === `${issue.id}:status`
                      }
                      onChange={(event) =>
                        onUpdateIssueField?.(
                          issue,
                          "status",
                          event.target.value,
                        )
                      }
                      onClick={(event) => event.stopPropagation()}
                      onKeyDown={(event) => event.stopPropagation()}
                      value={
                        editableStatusOptions.some(
                          (option) => option.value === issue.status,
                        )
                          ? issue.status
                          : ""
                      }
                    >
                      {editableStatusOptions.some(
                        (option) => option.value === issue.status,
                      ) ? null : (
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
                  </td>
                  <td data-label="Data">
                    {formatDate(issueDate(issue, dateField))}
                  </td>
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
                    ) : (
                      "-"
                    )}
                  </td>
                  <td className="tagsCell" data-label="Tags">
                    {tagItems.length ? (
                      <div className="issueTagList">
                        {tagItems.map((item) => (
                          <span
                            className="issueTagPill"
                            key={`${item.group.id}-${item.tagId}`}
                            style={{
                              borderColor:
                                item.group.color || DEFAULT_TAG_GROUP_COLOR,
                            }}
                            title={item.group.label}
                          >
                            <span
                              className="tagColorSwatch"
                              style={{
                                backgroundColor:
                                  item.group.color || DEFAULT_TAG_GROUP_COLOR,
                              }}
                            />
                            {item.tagId}
                          </span>
                        ))}
                      </div>
                    ) : (
                      "-"
                    )}
                  </td>
                  <td className="textCell" data-label="Texto">
                    {textPreview(issue.text)}
                  </td>
                </tr>
              );
            })}
            {!loading && items.length === 0 ? (
              <tr>
                <td className="emptyTable" colSpan="9">
                  Nenhuma issue encontrada.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}
