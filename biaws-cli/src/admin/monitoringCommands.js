import path from "node:path";

import { Args, Flags } from "@oclif/core";

import { LocalInstanceCommand } from "../baseCommands.js";

const contextFlags = {
  instance: Flags.string({
    char: "i",
    description: "nome da instância",
    required: true,
  }),
  root: Flags.string({ description: "raiz da instalação" }),
};

const descriptions = {
  build: "constrói a imagem dos executores de monitoramento",
  logs: "acompanha os logs dos executores de monitoramento",
  start: "inicia os executores de monitoramento",
  status: "exibe o estado dos executores de monitoramento",
  stop: "interrompe os executores de monitoramento",
  validate: "valida arquivos, segredos e a configuração dos executores",
};

export function createAdminMonitoringCommand(action) {
  return class AdminMonitoringAction extends LocalInstanceCommand {
    static description = descriptions[action];
    static args = {
      workspace: Args.string({
        description: "identificadores locais dos workspaces",
        multiple: true,
      }),
    };
    static flags = contextFlags;

    async run() {
      const { args, flags } = await this.parse(this.constructor);
      const context = await this.localContext({
        instance: flags.instance,
        root: flags.root,
      });
      const script = path.join(
        context.repositoryRoot,
        "scripts",
        "manage-monitoring-workspaces.sh",
      );
      await this.adapters.processRunner.run("bash", [
        script,
        "--instance",
        flags.instance,
        action,
        ...(args.workspace || []),
      ]);
    }
  };
}

export class AdminMonitoringProvisionCommand extends LocalInstanceCommand {
  static description =
    "provisiona a identidade técnica de monitoramento de um workspace";
  static args = {
    workspace: Args.string({
      description: "identificador local do workspace",
      required: true,
    }),
  };
  static flags = contextFlags;

  async run() {
    const { args, flags } = await this.parse(this.constructor);
    const context = await this.localContext({
      instance: flags.instance,
      root: flags.root,
    });
    const script = path.join(
      context.repositoryRoot,
      "scripts",
      "provision-monitoring-workspace.mjs",
    );
    await this.adapters.processRunner.run("node", [
      script,
      "--instance",
      flags.instance,
      "--workspace",
      args.workspace,
    ]);
  }
}
