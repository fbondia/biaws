import { betterAuth } from "better-auth";
import { mongodbAdapter } from "@better-auth/mongo-adapter";
import { apiKey } from "@better-auth/api-key";
import { fromNodeHeaders, toNodeHandler } from "better-auth/node";
import { admin } from "better-auth/plugins";

import { getServerConfig } from "../config.js";
import { COLLECTION_NAMES } from "../database/collectionNames.js";
import { getMongoClient, resolveDatabaseName } from "../helpers/mongoClient.js";
import { resolveUserAuthorization } from "../repositories/accessRepository.js";
import { platformPermissionsForTechnicalRole } from "./authorizationMiddleware.js";
import { ensureAuthIndexes } from "./authIndexes.js";
import { hashPassword, verifyPassword } from "./password.js";

let authPromise;

function validateConfig(config) {
  if (!config.secret || config.secret.length < 32) {
    throw new Error("BETTER_AUTH_SECRET must contain at least 32 characters.");
  }

  if (config.trustedOrigins.length === 0) {
    throw new Error(
      "BETTER_AUTH_TRUSTED_ORIGINS must contain at least one UI origin.",
    );
  }
}

export async function getAuth() {
  const serverConfig = getServerConfig();
  const config = serverConfig.auth;
  validateConfig(config);

  if (!authPromise) {
    authPromise = (async () => {
      const client = await getMongoClient();
      const database = client.db(resolveDatabaseName());
      await ensureAuthIndexes(database);

      return betterAuth({
        appName: "Bondia Workspaces",
        baseURL: config.baseUrl,
        basePath: "/api/auth",
        secret: config.secret,
        trustedOrigins: config.trustedOrigins,
        database: mongodbAdapter(database, { client }),
        user: {
          modelName: COLLECTION_NAMES.AUTH_USERS,
        },
        account: {
          modelName: COLLECTION_NAMES.AUTH_ACCOUNTS,
        },
        emailAndPassword: {
          enabled: true,
          disableSignUp: true,
          minPasswordLength: 12,
          maxPasswordLength: 128,
          password: {
            hash: hashPassword,
            verify: verifyPassword,
          },
        },
        session: {
          modelName: COLLECTION_NAMES.AUTH_SESSIONS,
          expiresIn: 60 * 60 * 8,
          updateAge: 60 * 60,
        },
        verification: {
          modelName: COLLECTION_NAMES.AUTH_VERIFICATIONS,
        },
        rateLimit: {
          enabled: serverConfig.rateLimit.auth.enabled,
          window: serverConfig.rateLimit.auth.windowSeconds,
          max: serverConfig.rateLimit.auth.maxRequests,
        },
        plugins: [
          admin({
            defaultRole: "user",
            adminRoles: ["admin"],
          }),
          apiKey({
            schema: {
              apikey: {
                modelName: COLLECTION_NAMES.AUTH_API_KEYS,
              },
            },
            defaultPrefix: "biaws_",
            requireName: true,
            enableMetadata: true,
            enableSessionForAPIKeys: true,
            customAPIKeyGetter(context) {
              const authorization = context.headers?.get("authorization");
              const match = authorization?.match(/^Bearer\s+(.+)$/iu);
              return match?.[1]?.trim() || null;
            },
            keyExpiration: {
              defaultExpiresIn: 90 * 24 * 60 * 60 * 1000,
              disableCustomExpiresTime: true,
            },
            rateLimit: {
              enabled: serverConfig.rateLimit.apiKey.enabled,
              timeWindow: serverConfig.rateLimit.apiKey.windowSeconds * 1_000,
              maxRequests: serverConfig.rateLimit.apiKey.maxRequests,
            },
          }),
        ],
        advanced: {
          cookiePrefix: "biaws",
          useSecureCookies: config.secureCookies,
          ipAddress: {
            trustedProxies: config.trustedProxies,
          },
        },
      });
    })();
  }

  return authPromise;
}

export async function authHandler(req, res, next) {
  try {
    const auth = await getAuth();
    return toNodeHandler(auth)(req, res);
  } catch (error) {
    next(error);
  }
}

export async function getAuthenticatedActor(req) {
  const auth = await getAuth();
  const result = await auth.api.getSession({
    headers: fromNodeHeaders(req.headers),
  });
  if (!result?.user || !result?.session || result.user.banned) return null;

  const authorization = String(req.headers.authorization || "");
  const usesApiKey = /^Bearer\s+/iu.test(authorization);
  const requestedWorkspaceId = String(
    req.headers["x-biaws-workspace-id"] || "",
  ).trim();
  const workspaceAuthorization = await resolveUserAuthorization(
    result.user.id,
    requestedWorkspaceId,
  );

  const technicalRole = result.user.role || "user";
  const platformPermissions =
    platformPermissionsForTechnicalRole(technicalRole);

  return {
    userId: result.user.id,
    email: result.user.email,
    displayName: result.user.name,
    authenticationMethod: usesApiKey ? "api-key" : "session",
    sessionId: usesApiKey ? null : result.session.id,
    apiKeyId: usesApiKey ? result.session.id : null,
    technicalRole,
    platformPermissions,
    groups: workspaceAuthorization.groups,
    permissions: workspaceAuthorization.permissions,
    workspaceId: workspaceAuthorization.workspaceId,
    workspaces: workspaceAuthorization.workspaces,
    permissionScopes: workspaceAuthorization.permissionScopes,
  };
}
