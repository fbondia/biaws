import { fetchJson, sendJson } from "./client.js";

export function fetchIssues(params) {
  return fetchJson("/api/issues", params);
}

export function fetchIssueDetails(issueId) {
  return fetchJson(`/api/issues/${encodeURIComponent(issueId)}`);
}

export function createIssue(issue, params) {
  return sendJson("/api/issues", issue, params, "POST");
}

export function createIssueComment(issueId, comment, params) {
  return sendJson(
    `/api/issues/${encodeURIComponent(issueId)}/comments`,
    comment,
    params,
    "POST",
  );
}

export function saveIssueComment(issueId, commentId, comment, params) {
  return sendJson(
    `/api/issues/${encodeURIComponent(issueId)}/comments/${encodeURIComponent(commentId)}`,
    comment,
    params,
  );
}

export function fetchSummary(params) {
  return fetchJson("/api/issues/summary", params);
}

export function fetchIssueTaxonomy(params) {
  return fetchJson("/api/issues/taxonomy", params);
}

export function saveIssueTaxonomy(taxonomyPackage, params) {
  return sendJson("/api/issues/taxonomy", taxonomyPackage, params);
}

export function saveIssueClassification(issueId, classification, params) {
  return sendJson(
    `/api/issues/${encodeURIComponent(issueId)}/classification`,
    classification,
    params,
  );
}

export function updateIssue(issueId, patch, params) {
  return sendJson(
    `/api/issues/${encodeURIComponent(issueId)}`,
    patch,
    params,
    "PATCH",
  );
}
