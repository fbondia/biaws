import { fetchJson, sendJson } from "./client.js";

export function fetchHomeDashboard() {
  return fetchJson("/api/home");
}

export function updateHomeConfiguration(widgets) {
  return sendJson("/api/home/configuration", { widgets }, undefined, "PUT");
}
