import { useEffect, useMemo, useRef, useState } from "react";

import {
  fetchIssueDetails,
  fetchIssues,
  fetchIssueTaxonomy,
  fetchRuntimeOptionLists,
  fetchSummary,
  updateIssue,
} from "../../api.js";
import {
  configureIssueConstants,
  DEFAULT_FILTERS,
} from "../../constants/issues.js";
import { configureRequestConstants } from "../../data/requestConstants.js";
import { hasPermission } from "../../permissions.js";
import { compactParams } from "../../utils/issues.js";
import {
  APP_VIEWS,
  buildMonthSummaryParams,
  DEFAULT_ISSUE_SORT,
  GROUPED_VIEWS,
  ISSUES_PER_PAGE,
  NAVIGATION_GROUPS,
} from "../model.js";

function allowedNavigationView(actor) {
  return ({ permission }) => !permission || hasPermission(actor, permission);
}

function navigationSection(actor, section) {
  return {
    ...section,
    views: section.views.filter(allowedNavigationView(actor)),
  };
}

function navigationGroup(actor, group) {
  return {
    ...group,
    sections: group.sections
      .map((section) => navigationSection(actor, section))
      .filter(({ views }) => views.length),
  };
}

export function useApp(actor) {
  const [activeView, setActiveView] = useState(() => {
    if (
      !actor.workspaceId &&
      actor.platformPermissions?.includes("platform.workspaces.manage")
    ) {
      return "workspace-admin";
    }
    return (
      [...APP_VIEWS, ...GROUPED_VIEWS].find(
        ({ permission, platformPermission }) =>
          !platformPermission &&
          (!permission || hasPermission(actor, permission)),
      )?.key || "account"
    );
  });
  const [draftFilters, setDraftFilters] = useState(DEFAULT_FILTERS);
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [page, setPage] = useState(1);
  const [issueSort, setIssueSort] = useState(DEFAULT_ISSUE_SORT);
  const [issuesResult, setIssuesResult] = useState(null);
  const [summary, setSummary] = useState(null);
  const [activeAggregate, setActiveAggregate] = useState("byDate");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedIssue, setSelectedIssue] = useState(null);
  const [issueDetails, setIssueDetails] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [taxonomyPackage, setTaxonomyPackage] = useState(null);
  const [updatingIssueField, setUpdatingIssueField] = useState("");
  const [selectedMonthTaxonomy, setSelectedMonthTaxonomy] = useState(null);
  const [monthTaxonomySummary, setMonthTaxonomySummary] = useState(null);
  const [monthTaxonomyLoading, setMonthTaxonomyLoading] = useState(false);
  const [monthTaxonomyError, setMonthTaxonomyError] = useState("");
  const [runtimeOptionsVersion, setRuntimeOptionsVersion] = useState(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const monthTaxonomyRequestId = useRef(0);
  const availableViews = useMemo(
    () =>
      APP_VIEWS.filter(
        ({ permission, platformPermission }) =>
          Boolean(actor.workspaceId) &&
          (!permission || hasPermission(actor, permission)) &&
          (!platformPermission ||
            actor.platformPermissions?.includes(platformPermission)),
      ),
    [actor],
  );
  const availableNavigationGroups = useMemo(() => {
    if (!actor.workspaceId) return [];
    return NAVIGATION_GROUPS.map((group) =>
      navigationGroup(actor, group),
    ).filter(({ sections }) => sections.length);
  }, [actor]);
  const params = useMemo(
    () =>
      compactParams(
        { ...filters, limit: ISSUES_PER_PAGE, sort: issueSort },
        page,
      ),
    [filters, issueSort, page],
  );

  async function loadData() {
    setLoading(true);
    setError("");

    try {
      const [issuesPayload, summaryPayload] = await Promise.all([
        fetchIssues(params),
        fetchSummary(params),
      ]);
      setIssuesResult(issuesPayload);
      setSummary(summaryPayload);
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (activeView === "issues") {
      loadData();
    }
  }, [activeView, params]);

  useEffect(() => {
    monthTaxonomyRequestId.current += 1;
    setSelectedMonthTaxonomy(null);
    setMonthTaxonomySummary(null);
    setMonthTaxonomyLoading(false);
    setMonthTaxonomyError("");
  }, [filters]);

  useEffect(() => {
    let active = true;

    fetchIssueTaxonomy()
      .then((payload) => {
        if (active) setTaxonomyPackage(payload.taxonomy);
      })
      .catch(() => {
        if (active) setTaxonomyPackage(null);
      });

    return () => {
      active = false;
    };
  }, []);

  async function loadRuntimeOptionLists() {
    const payload = await fetchRuntimeOptionLists();
    configureRequestConstants(payload.items || []);
    configureIssueConstants(payload.items || []);
    setRuntimeOptionsVersion((current) => current + 1);
  }

  useEffect(() => {
    loadRuntimeOptionLists().catch(() => {
      // Build-time defaults remain available if the runtime catalog cannot be loaded.
    });
  }, []);

  useEffect(() => {
    if (!selectedIssue?.id) return undefined;

    let active = true;
    setIssueDetails(null);
    setDetailError("");
    setDetailLoading(true);

    fetchIssueDetails(selectedIssue.id)
      .then((payload) => {
        if (active) setIssueDetails(payload);
      })
      .catch((loadError) => {
        if (active) setDetailError(loadError.message);
      })
      .finally(() => {
        if (active) setDetailLoading(false);
      });

    return () => {
      active = false;
    };
  }, [selectedIssue]);

  function updateDraft(field, value) {
    setDraftFilters((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function submitFilters(event) {
    event.preventDefault();
    setPage(1);
    setFilters(draftFilters);
  }

  function clearFilters() {
    setDraftFilters(DEFAULT_FILTERS);
    setFilters(DEFAULT_FILTERS);
    setPage(1);
  }

  function sortIssues(field) {
    setIssueSort((current) => {
      const currentField = current.startsWith("-") ? current.slice(1) : current;
      if (currentField !== field) return field;
      return current.startsWith("-") ? field : `-${field}`;
    });
    setPage(1);
  }

  function closeIssue() {
    setSelectedIssue(null);
    setIssueDetails(null);
    setDetailError("");
  }

  function applyUpdatedIssue(updatedIssue) {
    if (!updatedIssue?.id) return;

    setIssuesResult((current) => {
      if (!current) return current;

      return {
        ...current,
        items: current.items.map((currentIssue) =>
          currentIssue.id === updatedIssue.id
            ? { ...currentIssue, ...updatedIssue }
            : currentIssue,
        ),
      };
    });

    setSelectedIssue((current) =>
      current?.id === updatedIssue.id
        ? { ...current, ...updatedIssue }
        : current,
    );
    setIssueDetails((current) =>
      current?.issue?.id === updatedIssue.id
        ? { ...current, issue: { ...current.issue, ...updatedIssue } }
        : current,
    );
  }

  async function updateIssueAfterClassification(updatedIssue) {
    applyUpdatedIssue(updatedIssue);
    await loadData();
  }

  async function updateIssueDetails(payload) {
    if (!payload?.issue) return;
    applyUpdatedIssue(payload.issue);
    setIssueDetails(payload);
    await loadData();
  }

  async function updateIssueField(issue, field, value) {
    if (!issue?.id || issue[field] === value) return;

    const updateKey = `${issue.id}:${field}`;
    setUpdatingIssueField(updateKey);
    setError("");

    try {
      const payload = await updateIssue(issue.id, { [field]: value });
      const updatedIssue = payload.issue;
      applyUpdatedIssue(updatedIssue);
      await loadData();
    } catch (updateError) {
      setError(updateError.message);
    } finally {
      setUpdatingIssueField("");
    }
  }

  async function selectMonthTaxonomy(monthItem) {
    const monthKey = String(monthItem?.key || "");
    const monthParams = buildMonthSummaryParams(filters, monthKey);

    if (!monthParams) return;

    const requestId = monthTaxonomyRequestId.current + 1;
    monthTaxonomyRequestId.current = requestId;
    setSelectedMonthTaxonomy(monthItem);
    setMonthTaxonomySummary(null);
    setMonthTaxonomyError("");
    setMonthTaxonomyLoading(true);

    try {
      const payload = await fetchSummary(monthParams);

      if (monthTaxonomyRequestId.current === requestId) {
        setMonthTaxonomySummary(payload);
      }
    } catch (loadError) {
      if (monthTaxonomyRequestId.current === requestId) {
        setMonthTaxonomyError(loadError.message);
      }
    } finally {
      if (monthTaxonomyRequestId.current === requestId) {
        setMonthTaxonomyLoading(false);
      }
    }
  }

  function clearMonthTaxonomy() {
    monthTaxonomyRequestId.current += 1;
    setSelectedMonthTaxonomy(null);
    setMonthTaxonomySummary(null);
    setMonthTaxonomyLoading(false);
    setMonthTaxonomyError("");
  }

  const items = issuesResult?.items || [];
  const meta = issuesResult?.meta || {
    page,
    totalPages: 1,
    total: 0,
    returned: 0,
  };
  const totalPages = meta.totalPages || 1;
  const issuesProps = {
    actor,
    activeAggregate,
    dateField: filters.dateField,
    detailError,
    detailLoading,
    draftFilters,
    error,
    items,
    loading,
    meta,
    onAggregateChange: setActiveAggregate,
    onClearFilters: clearFilters,
    onCloseIssue: closeIssue,
    onFilterChange: updateDraft,
    onIssueUpdated: updateIssueAfterClassification,
    onIssueDetailsUpdated: updateIssueDetails,
    onImportCompleted: loadData,
    onClearMonthTaxonomy: clearMonthTaxonomy,
    onNextPage: () => setPage((current) => Math.min(totalPages, current + 1)),
    onOpenIssue: setSelectedIssue,
    onPreviousPage: () => setPage((current) => Math.max(1, current - 1)),
    onRefresh: loadData,
    onSelectMonthTaxonomy: selectMonthTaxonomy,
    onSort: sortIssues,
    onSubmitFilters: submitFilters,
    onUpdateIssueField: updateIssueField,
    page,
    selectedIssue,
    selectedIssueDetails: issueDetails,
    selectedMonthTaxonomy,
    summary,
    sort: issueSort,
    monthTaxonomyError,
    monthTaxonomyLoading,
    monthTaxonomySummary,
    taxonomyPackage,
    totalPages,
    updatingIssueField,
  };

  return {
    activeView,
    setActiveView,
    availableNavigationGroups,
    availableViews,
    mobileMenuOpen,
    setMobileMenuOpen,
    issuesProps,
    loadRuntimeOptionLists,
    runtimeOptionsVersion,
  };
}
