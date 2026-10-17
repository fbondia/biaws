import type { IncomingHttpHeaders } from "node:http";
import { getAuth } from "./auth.js";
import { oauthError, oauthFlow } from "./oauthGrantPolicy.js";
import { prepareOAuthGrant } from "./oauthGrants.js";
import { getServerConfig } from "../config.js";
import type { Actor } from "../types/http.js";

function sessionHeaders(headers: IncomingHttpHeaders) {
  return new Headers({ cookie: headers.cookie || "", origin: new URL(getServerConfig().auth.baseUrl).origin });
}
async function providerCall(headers: IncomingHttpHeaders, path: string, body?: Record<string, unknown>) {
  const auth = await getAuth();
  const base = new URL(getServerConfig().auth.baseUrl).origin;
  const h = sessionHeaders(headers);
  if (body) h.set("content-type", "application/json");
  const response = await auth.handler(
    new Request(base + "/api/auth" + path, {
      method: body ? "POST" : "GET",
      headers: h,
      body: body ? JSON.stringify(body) : undefined,
    }),
  );
  if (!response.ok) throw oauthError("OAUTH_CONTINUATION_REJECTED", response.status >= 500 ? 503 : 400);
  return response.json() as Promise<Record<string, unknown>>;
}
export async function oauthConsentContext(headers: IncomingHttpHeaders, query: string) {
  const flow = oauthFlow(query);
  const client = await providerCall(headers, "/oauth2/public-client?client_id=" + encodeURIComponent(flow.clientId));
  return {
    clientId: flow.clientId,
    clientName: typeof client.client_name === "string" ? client.client_name : flow.clientId,
    scopes: flow.scopes,
  };
}
export async function decideOAuthConsent(
  actor: Actor,
  headers: IncomingHttpHeaders,
  input: { query: string; accept: boolean; workspaceId?: string },
) {
  oauthFlow(input.query);
  let query = input.query;
  if (input.accept) {
    if (!input.workspaceId) throw oauthError("SESSION_AND_WORKSPACE_REQUIRED", 400);
    await prepareOAuthGrant(actor, query, input.workspaceId);
    const continued = await providerCall(headers, "/oauth2/continue", { postLogin: true, oauth_query: query });
    const next = new URL(String(continued.redirect_uri ?? continued.url), getServerConfig().auth.baseUrl);
    const base = new URL(getServerConfig().auth.baseUrl);
    if (next.origin !== base.origin || next.pathname !== "/oauth/connect") {
      // Only provider-validated redirects are ever returned to the browser.
      return { redirectUrl: next.toString() };
    }
    query = next.searchParams.toString();
  }
  const result = await providerCall(headers, "/oauth2/consent", { accept: input.accept, oauth_query: query });
  const redirect = new URL(String(result.redirect_uri ?? result.url));
  if (!["https:", "http:"].includes(redirect.protocol)) throw oauthError("INVALID_OAUTH_REDIRECT", 400);
  return { redirectUrl: redirect.toString() };
}
