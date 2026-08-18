import path from "node:path";
import { fileURLToPath } from "node:url";

import { Args, Command } from "@oclif/core";

import { loadEnv } from "../../shared/index.js";
import { createApiClient } from "./apiClient.js";
import { parseArgs } from "./args.js";

export const TOOL_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

export class LegacyCommand extends Command {
  static args = {
    arguments: Args.string({
      description: "Argumentos e opções aceitos pelo comando legado",
      multiple: true,
    }),
  };

  static strict = false;

  async legacyContext() {
    loadEnv(TOOL_DIR);
    const [action, ...rawArgs] = this.argv;
    const { positional, options } = parseArgs(rawArgs);
    const apiUrl =
      options["api-url"] ||
      process.env.ISSUE_API_URL ||
      process.env.ISSUE_API_BASE_URL ||
      "http://127.0.0.1:3100";
    const apiKey = options["api-key"] || process.env.ISSUE_API_KEY;
    const workspaceId =
      options.workspace || process.env.ISSUE_WORKSPACE_ID || "";

    if (!apiKey) {
      this.error(
        "Chave da API ausente. Defina ISSUE_API_KEY ou informe --api-key.",
        { exit: 2 },
      );
    }

    return {
      action,
      api: createApiClient(apiUrl, apiKey, workspaceId),
      apiKey,
      apiUrl: apiUrl.replace(/\/+$/u, ""),
      options,
      positional,
      workspaceId,
    };
  }
}
