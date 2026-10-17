import { randomBytes } from "node:crypto";
import { COLLECTION_NAMES } from "../database/collectionNames.js";
import { getMongoDatabase } from "../helpers/mongoClient.js";
import { requireOAuthGrant, resolveOAuthGrantActor } from "./oauthGrants.js";
import { oauthError } from "./oauthGrantPolicy.js";
import { DELEGATION_PREFIX, hashDelegation, mcpSubjectClaims } from "./oauthDelegationPolicy.js";

interface Delegation {
  hash: string;
  grantId: string;
  userId: string;
  clientId: string;
  workspaceId: string;
  scopes: string[];
  expiresAt: Date;
  audience: "biaws-domain-api";
}
async function delegations() {
  return (await getMongoDatabase()).collection<Delegation>(COLLECTION_NAMES.OAUTH_DELEGATIONS);
}
export async function ensureOAuthDelegationIndexes() {
  const c = await delegations();
  await Promise.all([
    c.createIndex({ hash: 1 }, { unique: true }),
    c.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
  ]);
}
export async function issueMcpDelegation(claims: Record<string, unknown>, resource: string) {
  const subject = mcpSubjectClaims(claims, resource);
  const grant = await requireOAuthGrant(subject.grantId, subject.userId, subject.scopes);
  if (grant.clientId !== subject.clientId || grant.workspaceId !== subject.workspaceId)
    throw oauthError("MCP_GRANT_MISMATCH");
  await resolveOAuthGrantActor(grant, subject.scopes);
  const token = DELEGATION_PREFIX + randomBytes(32).toString("base64url");
  await (await delegations()).insertOne({ ...subject, hash: hashDelegation(token), audience: "biaws-domain-api" });
  return {
    accessToken: token,
    expiresAt: subject.expiresAt.toISOString(),
    workspaceId: grant.workspaceId,
    grantId: grant.id,
    scopes: subject.scopes,
  };
}
export async function resolveMcpDelegation(token: string, requestedWorkspaceId = "") {
  if (!token.startsWith(DELEGATION_PREFIX) || token.length > 128) throw oauthError("INVALID_DELEGATION");
  const delegation = await (
    await delegations()
  ).findOne({ hash: hashDelegation(token), audience: "biaws-domain-api", expiresAt: { $gt: new Date() } });
  if (!delegation) throw oauthError("INVALID_DELEGATION");
  if (requestedWorkspaceId && requestedWorkspaceId !== delegation.workspaceId)
    throw oauthError("DELEGATION_WORKSPACE_MISMATCH", 403);
  const grant = await requireOAuthGrant(delegation.grantId, delegation.userId, delegation.scopes);
  if (grant.workspaceId !== delegation.workspaceId || grant.clientId !== delegation.clientId)
    throw oauthError("DELEGATION_GRANT_MISMATCH");
  return resolveOAuthGrantActor(grant, delegation.scopes);
}
