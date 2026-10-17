import { Router } from "express";
import { asyncHandler } from "../shared/asyncHandler.js";
import { getServerConfig } from "../../config.js";
import { oauthError } from "../../auth/oauthGrantPolicy.js";
import { getMcpOAuthConfig } from "../../auth/oauthProvider.js";
import { listOAuthGrants, revokeOAuthGrant } from "../../auth/oauthGrants.js";
import { oauthConsentContext, decideOAuthConsent } from "../../auth/oauthConsent.js";
import { recordAuditEvent } from "../../repositories/audit/index.js";

export const oauthRouter = Router();
oauthRouter.use((req, res, next) => {
  res.set("Cache-Control", "no-store");
  res.set("Referrer-Policy", "no-referrer");
  if (req.actor?.authenticationMethod !== "session") return next(oauthError("SESSION_REQUIRED", 403));
  if (req.method !== "GET") {
    const origins = new Set([...getServerConfig().auth.trustedOrigins, new URL(getServerConfig().auth.baseUrl).origin]);
    if (!origins.has(req.get("origin") || "")) return next(oauthError("ORIGIN_FORBIDDEN", 403));
  }
  next();
});
oauthRouter.get(
  "/connections",
  asyncHandler(async (req, res) => {
    const enabled = getMcpOAuthConfig(getServerConfig().auth.baseUrl).enabled;
    res.json({ enabled, items: enabled ? await listOAuthGrants(req.actor!.userId) : [] });
  }),
);
oauthRouter.use((_req, _res, next) => {
  next(getMcpOAuthConfig(getServerConfig().auth.baseUrl).enabled ? undefined : oauthError("OAUTH_DISABLED", 404));
});
oauthRouter.post(
  "/context",
  asyncHandler(async (req, res) => {
    res.json(await oauthConsentContext(req.headers, req.body.query));
  }),
);
oauthRouter.post(
  "/decision",
  asyncHandler(async (req, res) => {
    const result = await decideOAuthConsent(req.actor!, req.headers, req.body);
    await recordAuditEvent({
      actor: { ...req.actor, workspaceId: req.body.workspaceId },
      action: req.body.accept ? "oauth.consent.accept" : "oauth.consent.deny",
      target: { type: "oauth_connection", id: "consent" },
      summary: "OAuth consent decision",
    });
    res.json(result);
  }),
);
oauthRouter.delete(
  "/connections/:id",
  asyncHandler(async (req, res) => {
    const id = String(req.params.id);
    if (!(await revokeOAuthGrant(id, req.actor!.userId))) throw oauthError("OAUTH_CONNECTION_NOT_FOUND", 404);
    await recordAuditEvent({
      actor: req.actor,
      action: "oauth.connection.revoke",
      target: { type: "oauth_connection", id },
      summary: "OAuth connection revoked",
    });
    res.json({ revoked: true });
  }),
);
