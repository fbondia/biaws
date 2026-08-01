import cors from "cors";
import express from "express";
import { accessSync, constants, mkdirSync } from "fs";

import { authHandler, getAuthenticatedActor } from "./auth/auth.js";
import {
  requireAuthentication,
  requireWorkspaceContext,
} from "./auth/authenticationMiddleware.js";
import { getIssueBaseDir } from "./helpers/issueStorage.js";
import { getServerConfig } from "./config.js";
import { createAttachmentStorage } from "./storage/attachmentStorage.js";
import { createApiRateLimitMiddleware } from "./rateLimit/apiRateLimitMiddleware.js";
import { apiLogger } from "./logging/logger.js";
import {
  createErrorHandler,
  createRequestLoggingMiddleware,
} from "./logging/httpLogging.js";
import { issuesRouter } from "./routes/issues.js";
import { requestsRouter } from "./routes/requests.js";
import { proceduresRouter } from "./routes/procedures.js";
import { skillsRouter } from "./routes/skills.js";
import { accessRouter } from "./routes/access.js";
import { identityRouter } from "./routes/identity.js";
import { auditRouter } from "./routes/audit.js";
import { optionListsRouter } from "./routes/optionLists.js";
import { catalogRouter } from "./routes/catalog.js";
import { catalogTopologyRouter } from "./routes/catalogTopology.js";
import { monitoringRouter } from "./routes/monitoring.js";
import { homeRouter } from "./routes/home.js";
import {
  rejectDatabaseOverride,
  requireIdentityAdminOperation,
  requireAllPermissions,
} from "./auth/authorizationMiddleware.js";

const config = getServerConfig();

function ensureIssueStorage() {
  const issueDir = getIssueBaseDir({});
  mkdirSync(issueDir, { recursive: true });
  accessSync(issueDir, constants.R_OK | constants.W_OK);
  return issueDir;
}

export function createApp({ logger = apiLogger } = {}) {
  ensureIssueStorage();
  createAttachmentStorage();
  const app = express();

  app.disable("x-powered-by");
  app.use(
    createRequestLoggingMiddleware(logger, {
      includeHealthChecks: config.logging.includeHealthChecks,
    }),
  );

  app.use(
    cors({
      origin: config.auth.trustedOrigins,
      credentials: true,
    }),
  );

  // Better Auth needs the original request body and must be mounted before
  // express.json(). Express 5 names the wildcard parameter.
  app.get("/api/auth/me", async (req, res, next) => {
    try {
      const actor = await getAuthenticatedActor(req);
      if (!actor) {
        res.status(401).json({
          error: {
            code: "UNAUTHENTICATED",
            message: "A valid Better Auth session is required",
          },
        });
        return;
      }

      res.json({ actor });
    } catch (error) {
      next(error);
    }
  });

  app.use(
    "/api/auth/admin",
    requireAuthentication,
    requireWorkspaceContext,
    requireIdentityAdminOperation,
  );
  app.use(
    "/api/auth/api-key",
    requireAuthentication,
    requireWorkspaceContext,
    requireAllPermissions("api_keys.manage.self"),
  );
  app.all("/api/auth/*splat", authHandler);

  app.use(express.json({ limit: config.maxJsonBytes }));

  app.get("/api/health", (req, res) => {
    res.json({
      status: "ok",
      service: "biaws-api",
      issueStorage: "ready",
    });
  });

  const protectedRoute = [
    requireAuthentication,
    createApiRateLimitMiddleware(config.rateLimit.api),
    requireWorkspaceContext,
    rejectDatabaseOverride,
  ];
  app.use("/api/issues", ...protectedRoute, issuesRouter);
  app.use("/api/home", ...protectedRoute, homeRouter);
  app.use("/api/requests", ...protectedRoute, requestsRouter);
  app.use("/api/procedures", ...protectedRoute, proceduresRouter);
  app.use("/api/skills", ...protectedRoute, skillsRouter);
  app.use("/api/access", ...protectedRoute, accessRouter);
  app.use("/api/identity", ...protectedRoute, identityRouter);
  app.use("/api/audit", ...protectedRoute, auditRouter);
  app.use("/api/option-lists", ...protectedRoute, optionListsRouter);
  app.use("/api/monitoring", ...protectedRoute, monitoringRouter);
  app.use(
    "/api/catalog",
    ...protectedRoute,
    catalogRouter,
    catalogTopologyRouter,
  );

  app.use((req, res) => {
    res.status(404).json({
      error: {
        code: "NOT_FOUND",
        message: `Route not found: ${req.method} ${req.path}`,
      },
    });
  });

  app.use(createErrorHandler(logger));

  return app;
}
