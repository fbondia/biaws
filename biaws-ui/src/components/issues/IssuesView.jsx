import { BarChart3, Filter, FilterX, RefreshCw, Table2 } from "lucide-react";
import { useState } from "react";

import "../../styles/features/issues/index.css";

import { IssueDetailsDialog } from "./IssueDetailsDialog/index.jsx";
import { CreateIssueDialog } from "./CreateIssueDialog.jsx";
import { ImportEmlDialog } from "./ImportEmlDialog/index.jsx";
import { IssueFilters } from "./IssueFilters/index.jsx";
import { IssueList } from "./IssueList/index.jsx";
import { IssueSummary } from "./IssueSummary.jsx";
import { hasPermission } from "../../permissions.js";
import { useCatalogOptions } from "../catalog/CatalogContextFields/index.jsx";

const ISSUE_TABS = [
  { key: "results", label: "Resultados", icon: Table2 },
  { key: "summary", label: "Sumário", icon: BarChart3 },
];

function IssueViewTabs({ activeTab, loading, onRefresh, onSelect }) {
  return (
    <div className="issueViewNavigation">
      <div
        className="issueSectionTabs"
        role="tablist"
        aria-label="Visualização de chamados"
      >
        {ISSUE_TABS.map((tab) => (
          <IssueViewTab
            active={activeTab === tab.key}
            key={tab.key}
            onSelect={onSelect}
            tab={tab}
          />
        ))}
      </div>
      <button
        aria-label="Atualizar chamados"
        className="iconButton issueRefreshButton"
        disabled={loading}
        onClick={onRefresh}
        title="Atualizar chamados"
        type="button"
      >
        <RefreshCw className={loading ? "spinIcon" : undefined} size={18} />
      </button>
    </div>
  );
}

function IssueViewTab({ active, onSelect, tab }) {
  const Icon = tab.icon;
  return (
    <button
      aria-controls={`issues-panel-${tab.key}`}
      aria-selected={active}
      className={
        active ? "issueSectionTab activeIssueSectionTab" : "issueSectionTab"
      }
      id={`issues-tab-${tab.key}`}
      onClick={() => onSelect(tab.key)}
      role="tab"
      type="button"
    >
      <Icon size={16} />
      {tab.label}
    </button>
  );
}

function authorizedUpdater(
  canUpdateIssue,
  canUpdateStatus,
  onUpdateIssueField,
) {
  if (!canUpdateIssue && !canUpdateStatus) return undefined;
  return (issue, field, value) => {
    const allowed = field === "status" ? canUpdateStatus : canUpdateIssue;
    if (allowed) onUpdateIssueField(issue, field, value);
  };
}

function IssuesPanel({ activeTab, listProps, summaryProps }) {
  if (activeTab === "results") return <IssueList {...listProps} />;
  return <IssueSummary {...summaryProps} />;
}

function canReadIssueCatalog(actor) {
  return (
    hasPermission(actor, "applications.read") &&
    hasPermission(actor, "components.read")
  );
}

function IssueFiltersControl({ filtersVisible, onToggle }) {
  return (
    <button
      aria-controls="issue-filters"
      aria-expanded={filtersVisible}
      className={
        filtersVisible
          ? "secondaryButton activeFiltersButton"
          : "secondaryButton"
      }
      onClick={onToggle}
      type="button"
    >
      {filtersVisible ? <FilterX size={16} /> : <Filter size={16} />}
      {filtersVisible ? "Ocultar filtros" : "Mostrar filtros"}
    </button>
  );
}

function IssueOverlays({
  canClassify,
  canCreate,
  canCreateComment,
  canImport,
  canConfigureImport,
  canUpdateComment,
  canUpdateIssue,
  canUpdateStatus,
  catalog,
  classificationScope,
  createOpen,
  detailError,
  detailLoading,
  importOpen,
  onCloseCreate,
  onCloseImport,
  onCloseIssue,
  onCreateCompleted,
  onImportCompleted,
  onIssueDetailsUpdated,
  onIssueUpdated,
  onUpdateIssueField,
  selectedIssue,
  selectedIssueDetails,
  taxonomyPackage,
  updatingIssueField,
}) {
  return (
    <>
      {selectedIssue ? (
        <IssueDetailsDialog
          applications={catalog.applications}
          canEditContext={canUpdateIssue}
          canCreateComment={canCreateComment}
          canUpdateComment={canUpdateComment}
          components={catalog.components}
          details={selectedIssueDetails}
          error={detailError}
          loading={detailLoading}
          onClose={onCloseIssue}
          onIssueUpdated={onIssueUpdated}
          onIssueDetailsUpdated={onIssueDetailsUpdated}
          onUpdateIssueField={canUpdateStatus ? onUpdateIssueField : undefined}
          preview={selectedIssue}
          updatingIssueField={updatingIssueField}
        />
      ) : null}
      {canCreate && createOpen ? (
        <CreateIssueDialog
          applications={catalog.applications}
          components={catalog.components}
          onClose={onCloseCreate}
          onCreated={onCreateCompleted}
        />
      ) : null}
      {canImport && importOpen ? (
        <ImportEmlDialog
          applications={catalog.applications}
          canClassify={canClassify}
          canConfigureSanitization={canConfigureImport}
          classificationScope={classificationScope}
          components={catalog.components}
          taxonomyPackage={taxonomyPackage}
          workspace={catalog.workspace}
          onClose={onCloseImport}
          onImported={onImportCompleted}
        />
      ) : null}
    </>
  );
}

export function IssuesView({
  actor,
  activeAggregate,
  dateField,
  detailError,
  detailLoading,
  draftFilters,
  error,
  items,
  loading,
  meta,
  monthTaxonomyError,
  monthTaxonomyLoading,
  monthTaxonomySummary,
  onAggregateChange,
  onClearFilters,
  onClearMonthTaxonomy,
  onCloseIssue,
  onIssueDetailsUpdated,
  onFilterChange,
  onIssueUpdated,
  onImportCompleted,
  onNextPage,
  onOpenIssue,
  onPreviousPage,
  onRefresh,
  onSelectMonthTaxonomy,
  onSort,
  onSubmitFilters,
  onUpdateIssueField,
  page,
  selectedIssue,
  selectedIssueDetails,
  selectedMonthTaxonomy,
  summary,
  sort,
  taxonomyPackage,
  totalPages,
  updatingIssueField,
}) {
  const [activeTab, setActiveTab] = useState("results");
  const [filtersVisible, setFiltersVisible] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const canCreate = hasPermission(actor, "issues.create");
  const canClassify = hasPermission(actor, "issues.classification.update");
  const classificationScope =
    actor?.permissionScopes?.["issues.classification.update"] || null;
  const canCreateComment = hasPermission(actor, "issues.comment.create");
  const canUpdateComment = hasPermission(actor, "issues.comment.update");
  const canImport = hasPermission(actor, "issues.import.eml");
  const canConfigureImport =
    actor?.permissionScopes?.["issues.import.eml"]?.workspace === true;
  const canReadCatalog = canReadIssueCatalog(actor);
  const catalog = useCatalogOptions(canReadCatalog, actor.workspaceId);
  const canUpdateIssue = hasPermission(actor, "issues.update");
  const canUpdateStatus = hasPermission(actor, "issues.status.update");
  const onAuthorizedUpdate = authorizedUpdater(
    canUpdateIssue,
    canUpdateStatus,
    onUpdateIssueField,
  );
  const listProps = {
    applications: catalog.applications,
    dateField,
    items,
    loading,
    meta,
    onNextPage,
    onOpenCreate: canCreate ? () => setCreateOpen(true) : undefined,
    onOpenImport: canImport ? () => setImportOpen(true) : undefined,
    onOpenIssue,
    onPreviousPage,
    onSort,
    onUpdateIssueField: onAuthorizedUpdate,
    page,
    taxonomyPackage,
    totalPages,
    sort,
    updatingIssueField,
  };
  const summaryProps = {
    activeAggregate,
    monthTaxonomyError,
    monthTaxonomyLoading,
    monthTaxonomySummary,
    meta,
    onAggregateChange,
    onClearMonthTaxonomy,
    onOpenIssue,
    onSelectMonthTaxonomy,
    selectedMonthTaxonomy,
    summary,
    taxonomyPackage,
  };

  return (
    <>
      <section className="issueViewControls contentBand">
        <IssueViewTabs
          activeTab={activeTab}
          loading={loading}
          onRefresh={onRefresh}
          onSelect={setActiveTab}
        />
        <IssueFiltersControl
          filtersVisible={filtersVisible}
          onToggle={() => setFiltersVisible((current) => !current)}
        />
      </section>

      {filtersVisible ? (
        <IssueFilters
          draftFilters={draftFilters}
          id="issue-filters"
          onChange={onFilterChange}
          onClear={onClearFilters}
          onSubmit={onSubmitFilters}
          applications={catalog.applications}
          components={catalog.components}
          taxonomyPackage={taxonomyPackage}
        />
      ) : null}

      {error ? (
        <div className="errorBox" role="alert">
          {error}
        </div>
      ) : null}

      <div
        aria-labelledby={`issues-tab-${activeTab}`}
        id={`issues-panel-${activeTab}`}
        role="tabpanel"
      >
        <IssuesPanel
          activeTab={activeTab}
          listProps={listProps}
          summaryProps={summaryProps}
        />
      </div>

      <IssueOverlays
        canClassify={canClassify}
        canCreate={canCreate}
        canCreateComment={canCreateComment}
        canConfigureImport={canConfigureImport}
        canImport={canImport}
        canUpdateComment={canUpdateComment}
        canUpdateIssue={canUpdateIssue}
        canUpdateStatus={canUpdateStatus}
        catalog={catalog}
        classificationScope={classificationScope}
        createOpen={createOpen}
        detailError={detailError}
        detailLoading={detailLoading}
        importOpen={importOpen}
        onCloseCreate={() => setCreateOpen(false)}
        onCloseImport={() => setImportOpen(false)}
        onCloseIssue={onCloseIssue}
        onCreateCompleted={onImportCompleted}
        onImportCompleted={onImportCompleted}
        onIssueDetailsUpdated={onIssueDetailsUpdated}
        onIssueUpdated={onIssueUpdated}
        onUpdateIssueField={onUpdateIssueField}
        selectedIssue={selectedIssue}
        selectedIssueDetails={selectedIssueDetails}
        taxonomyPackage={taxonomyPackage}
        updatingIssueField={updatingIssueField}
      />
    </>
  );
}
