import { fetchJson, sendJson } from "./client.js";

export function fetchHomeDashboard() {
  return fetchJson("/api/home");
}

export function fetchHomePendingTasks(params) {
  return fetchJson("/api/home/pending-tasks", params);
}

export function updateHomeConfiguration(widgets) {
  return sendJson("/api/home/configuration", { widgets }, undefined, "PUT");
}
