import { STATUS_OPTIONS, TYPE_OPTIONS } from "../../../constants/issues.js";
import { IssueListHeader } from "./components/IssueListHeader.jsx";
import { IssueTable } from "./components/IssueTable.jsx";
import { buildTagGroupsById, buildTaxonomyItemsById } from "./model.js";

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
      <IssueListHeader
        loading={loading}
        meta={meta}
        onNextPage={onNextPage}
        onOpenCreate={onOpenCreate}
        onOpenImport={onOpenImport}
        onPreviousPage={onPreviousPage}
        page={page}
        totalPages={totalPages}
      />
      <IssueTable
        applicationsById={applicationsById}
        dateField={dateField}
        editableStatusOptions={editableStatusOptions}
        editableTypeOptions={editableTypeOptions}
        items={items}
        loading={loading}
        onOpenIssue={onOpenIssue}
        onSort={onSort}
        onUpdateIssueField={onUpdateIssueField}
        sort={sort}
        tagGroupsById={tagGroupsById}
        taxonomyItemsById={taxonomyItemsById}
        updatingIssueField={updatingIssueField}
      />
    </section>
  );
}
