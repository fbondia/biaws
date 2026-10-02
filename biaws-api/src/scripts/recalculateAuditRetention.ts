#!/usr/bin/env node

import { closeMongoClient } from "../helpers/mongoClient.js";
import { recalculateAuditExpiration } from "../repositories/audit/index.js";

const args = process.argv.slice(2);
if (args.includes("--help")) {
  console.log("Uso: recalculateAuditRetention [--apply]\nLê BIAWS_AUDIT_RETENTION_DAYS; sem --apply, apenas simula.");
} else if (args.some((arg) => arg !== "--apply")) {
  console.error("Opção desconhecida. Use --apply ou --help.");
  process.exitCode = 2;
} else {
  try {
    console.log(JSON.stringify(await recalculateAuditExpiration({ apply: args.includes("--apply") })));
  } finally {
    await closeMongoClient();
  }
}
