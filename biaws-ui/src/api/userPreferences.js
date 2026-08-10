import { buildUrl, readPayload, workspaceHeaders } from "./client.js";

function collectionNavigationPath(context) {
  return `/api/preferences/collection-navigation/${encodeURIComponent(context)}`;
}

export async function fetchCollectionNavigationPreference(context) {
  const response = await fetch(buildUrl(collectionNavigationPath(context)), {
    credentials: "include",
    headers: workspaceHeaders(),
  });
  return readPayload(response);
}

export async function updateCollectionNavigationPreference(
  context,
  collectionId,
  collapsed,
  workspaceId,
) {
  const response = await fetch(buildUrl(collectionNavigationPath(context)), {
    method: "PATCH",
    credentials: "include",
    headers: workspaceHeaders(
      { "Content-Type": "application/json" },
      workspaceId,
    ),
    body: JSON.stringify({ collectionId, collapsed }),
  });
  return readPayload(response);
}
