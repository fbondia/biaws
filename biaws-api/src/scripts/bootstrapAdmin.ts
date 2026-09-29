#!/usr/bin/env node

import { getAuth } from "../auth/auth.js";
import { bootstrapAdmin } from "../auth/bootstrapAdmin.js";
import { closeMongoClient, getMongoDatabase } from "../helpers/mongoClient.js";
import { errorMessage } from "../helpers/error.js";
import { setUserGroups } from "../repositories/access/index.js";
import { ensureDefaultWorkspace } from "../repositories/catalog/index.js";

function requireValue(name: string) {
  const value = String(process.env[name] || "").trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

async function run() {
  const email = requireValue("BIAWS_BOOTSTRAP_ADMIN_EMAIL").toLowerCase();
  const password = requireValue("BIAWS_BOOTSTRAP_ADMIN_PASSWORD");
  const name = requireValue("BIAWS_BOOTSTRAP_ADMIN_NAME");

  const database = await getMongoDatabase();
  const auth = await getAuth();
  const result = await bootstrapAdmin({
    auth,
    database,
    email,
    password,
    name,
    assignAdministration: (userId) =>
      setUserGroups(userId, ["administration"], { userId }),
  });
  const workspace = await ensureDefaultWorkspace({
    userId: result.user._id?.toString?.() || result.user.id,
    email: result.user.email,
  });
  console.log(`BIAWS_BOOTSTRAP_ADMIN_CREATED=${result.created}`);
  console.log(`Default workspace ready: ${workspace.name} (${workspace.id})`);
}

run()
  .catch((error: unknown) => {
    console.error(errorMessage(error));
    process.exitCode = 1;
  })
  .finally(closeMongoClient);
