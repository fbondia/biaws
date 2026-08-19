import { Args, Flags } from "@oclif/core";

import { AuthenticatedApiCommand } from "../baseCommands.js";
import { CliError } from "../core/errors.js";

export default class WorkspaceApiCommand extends AuthenticatedApiCommand {
  static description = "executa uma requisição autenticada no workspace atual";
  static args = {
    method: Args.string({
      options: ["GET", "POST", "PUT", "PATCH", "DELETE"],
      required: true,
    }),
    path: Args.string({
      description: "caminho iniciado por /",
      required: true,
    }),
  };
  static flags = {
    body: Flags.string({ description: "corpo JSON da requisição" }),
    "api-url": Flags.string({ description: "URL da API" }),
    profile: Flags.string({ description: "perfil global da API" }),
    workspace: Flags.string({ description: "ID do workspace" }),
  };

  async run() {
    const { args, flags } = await this.parse(this.constructor);
    if (!args.path.startsWith("/")) {
      throw new CliError("O caminho da API deve começar com /.", {
        code: "INVALID_API_PATH",
        exitCode: 2,
      });
    }
    let body;
    if (flags.body) {
      try {
        body = JSON.stringify(JSON.parse(flags.body));
      } catch {
        throw new CliError("--body deve conter JSON válido.", {
          code: "INVALID_JSON_BODY",
          exitCode: 2,
        });
      }
    }
    const context = await this.authenticatedContext(
      {
        apiUrl: flags["api-url"],
        profile: flags.profile,
        workspace: flags.workspace,
      },
      { requireWorkspace: true },
    );
    const result = await context.api.request(args.path, {
      method: args.method,
      ...(body ? { body } : {}),
    });
    this.output({ json: true }).result(result);
  }
}
