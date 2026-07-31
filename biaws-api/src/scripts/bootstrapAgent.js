#!/usr/bin/env node

import { randomBytes } from "node:crypto";

import { getAuth } from "../auth/auth.js";
import { bootstrapAgent } from "../auth/bootstrapAgent.js";
import { getServerConfig } from "../config.js";
import { closeMongoClient, getMongoDatabase } from "../helpers/mongoClient.js";
import { setUserGroups } from "../repositories/accessRepository.js";
import { ensureDefaultWorkspace } from "../repositories/catalogRepository.js";

async function run() {
  const serverConfig = getServerConfig();
  const database = await getMongoDatabase();
  const auth = await getAuth();
  const email = String(
    process.env.BIAWS_BOOTSTRAP_AGENT_EMAIL || "agent@localhost.invalid",
  ).toLowerCase();
  const name = String(
    process.env.BIAWS_BOOTSTRAP_AGENT_NAME || "Bondia Workspaces Agent",
  );
  const password = randomBytes(32).toString("base64url");
  const workspace = await ensureDefaultWorkspace();

  const result = await bootstrapAgent({
    auth,
    database,
    email,
    password,
    name,
    existingApiKey: String(
      process.env.BIAWS_BOOTSTRAP_AGENT_API_KEY || "",
    ).trim(),
    rateLimit: serverConfig.rateLimit.apiKey,
    assignAgent: (userId) =>
      setUserGroups(
        userId,
        ["agent-operator"],
        { userId: "bootstrap-agent", workspaceId: workspace.id },
        { workspaceId: workspace.id },
      ),
  });

  console.log(`BIAWS_AGENT_API_KEY=${result.apiKey.key}`);
  console.log(`BIAWS_AGENT_WORKSPACE_ID=${workspace.id}`);
}

run()
  .catch((error) => {
    console.error(error?.message || error);
    process.exitCode = 1;
  })
  .finally(closeMongoClient);
