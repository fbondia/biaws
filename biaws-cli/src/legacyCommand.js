import { Args } from "@oclif/core";

import { AuthenticatedApiCommand, TOOL_DIRECTORY } from "./baseCommands.js";
import { parseArgs } from "./args.js";

export const TOOL_DIR = TOOL_DIRECTORY;

export class LegacyCommand extends AuthenticatedApiCommand {
  static args = {
    arguments: Args.string({
      description: "Argumentos e opções aceitos pelo comando legado",
      multiple: true,
    }),
  };

  static strict = false;

  async legacyContext() {
    const [action, ...rawArgs] = this.argv;
    const { positional, options } = parseArgs(rawArgs);
    const context = await this.authenticatedContext({
      apiKey: options["api-key"],
      apiUrl: options["api-url"],
      workspace: options.workspace,
    });

    return {
      action,
      ...context,
      options,
      positional,
    };
  }
}
