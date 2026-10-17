import { randomUUID } from "node:crypto";
import { ObjectId } from "mongodb";
import { getMongoDatabase } from "../helpers/mongoClient.js";
import { COLLECTION_NAMES } from "../database/collectionNames.js";
import { resolveUserAuthorization } from "../repositories/access/index.js";
import type { Actor } from "../types/http.js";
import {
  oauthError,
  oauthFlow,
  restrictOAuthActor,
} from "./oauthGrantPolicy.js";

export interface OAuthGrant {
  id: string;
  userId: string;
  sessionId: string;
  flowKey: string;
  clientId: string;
  workspaceId: string;
  scopes: string[];
  state: "prepared" | "authorized" | "revoked";
  createdAt: Date;
  updatedAt: Date;
  expiresAt?: Date;
}
async function grants() {
  return (await getMongoDatabase()).collection<OAuthGrant>(
    COLLECTION_NAMES.OAUTH_GRANTS,
  );
}
export async function ensureOAuthGrantIndexes() {
  const c = await grants();
  await Promise.all([
    c.createIndex({ id: 1 }, { unique: true }),
    c.createIndex({ userId: 1, sessionId: 1, flowKey: 1 }, { unique: true }),
    c.createIndex({ userId: 1, createdAt: -1, id: 1 }),
    c.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
  ]);
}
export async function prepareOAuthGrant(
  actor: Actor,
  query: string,
  workspaceId: string,
) {
  if (
    actor.authenticationMethod !== "session" ||
    !actor.sessionId ||
    !workspaceId
  )
    throw oauthError("SESSION_AND_WORKSPACE_REQUIRED", 403);
  await resolveUserAuthorization(actor.userId, workspaceId);
  const flow = oauthFlow(query),
    c = await grants();
  const existing = await c.findOne({
    userId: actor.userId,
    sessionId: actor.sessionId,
    flowKey: flow.key,
  });
  if (existing && existing.state !== "prepared")
    throw oauthError("OAUTH_FLOW_ALREADY_USED", 409);
  const now = new Date();
  const grant: OAuthGrant = {
    id: randomUUID(),
    userId: actor.userId,
    sessionId: actor.sessionId,
    flowKey: flow.key,
    clientId: flow.clientId,
    workspaceId,
    scopes: flow.scopes,
    state: "prepared",
    createdAt: now,
    updatedAt: now,
    expiresAt: new Date(now.getTime() + 10 * 60 * 1000),
  };
  if (existing) {
    const result = await c.updateOne(
      { id: existing.id, state: "prepared" },
      { $set: { workspaceId, updatedAt: now, expiresAt: grant.expiresAt } },
    );
    if (!result.matchedCount) throw oauthError("OAUTH_FLOW_ALREADY_USED", 409);
    return { ...grant, id: existing.id };
  }
  try {
    await c.insertOne(grant);
  } catch (error) {
    if ((error as { code?: number }).code === 11000)
      throw oauthError("OAUTH_FLOW_CONFLICT", 409);
    throw error;
  }
  return grant;
}
export async function findOAuthFlowGrant(
  userId: string,
  sessionId: string,
  query: string,
) {
  const { key } = oauthFlow(query);
  return (await grants()).findOne({
    userId,
    sessionId,
    flowKey: key,
    state: "prepared",
    expiresAt: { $gt: new Date() },
  });
}
export async function authorizeOAuthGrant(
  id: string,
  userId: string,
  scopes: string[],
) {
  const c = await grants();
  const grant = await c.findOne({
    id,
    userId,
    state: { $in: ["prepared", "authorized"] },
  });
  if (
    !grant ||
    (grant.expiresAt && grant.expiresAt <= new Date()) ||
    scopes.some((s) => !grant.scopes.includes(s))
  )
    throw oauthError("OAUTH_GRANT_INVALID");
  await resolveOAuthGrantActor(grant, scopes);
  const result = await c.updateOne(
    { id, userId, state: { $in: ["prepared", "authorized"] } },
    {
      $set: { state: "authorized", updatedAt: new Date() },
      $unset: { expiresAt: "" },
    },
  );
  if (!result.matchedCount) throw oauthError("OAUTH_GRANT_REVOKED");
  return grant;
}
export async function requireOAuthGrant(
  id: string,
  userId: string,
  scopes: string[],
) {
  const grant = await (
    await grants()
  ).findOne({ id, userId, state: "authorized" });
  if (!grant || scopes.some((s) => !grant.scopes.includes(s)))
    throw oauthError("OAUTH_GRANT_INVALID");
  return grant;
}
export async function resolveOAuthGrantActor(
  grant: OAuthGrant,
  scopes: string[],
) {
  const db = await getMongoDatabase();
  const users = db.collection<{
    _id: ObjectId | string;
    id?: string;
    name?: string;
    email?: string;
    banned?: boolean;
  }>(COLLECTION_NAMES.AUTH_USERS);
  const ids: (ObjectId | string)[] = [grant.userId];
  if (ObjectId.isValid(grant.userId)) ids.push(new ObjectId(grant.userId));
  const user = await users.findOne({
    $or: [{ _id: { $in: ids } }, { id: grant.userId }],
  });
  if (!user || user.banned) throw oauthError("OAUTH_USER_INACTIVE");
  const access = await resolveUserAuthorization(
    grant.userId,
    grant.workspaceId,
  );
  return restrictOAuthActor(
    {
      userId: grant.userId,
      email: user.email,
      displayName: user.name,
      ...access,
    },
    scopes,
    grant,
  );
}
export async function listOAuthGrants(userId: string) {
  return (await grants())
    .find({ userId, state: { $ne: "revoked" } })
    .project({ _id: 0, sessionId: 0, flowKey: 0 })
    .sort({ createdAt: -1, id: 1 })
    .limit(100)
    .toArray();
}
export async function revokeOAuthGrant(id: string, userId: string) {
  const result = await (
    await grants()
  ).updateOne(
    { id, userId, state: { $ne: "revoked" } },
    {
      $set: { state: "revoked", updatedAt: new Date() },
      $unset: { expiresAt: "" },
    },
  );
  return result.matchedCount > 0;
}
