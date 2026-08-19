import path from "node:path";

import { Args, Flags } from "@oclif/core";

import { ProjectCommand } from "../../baseCommands.js";
import {
  configureContextFlags,
  configureContextInput,
} from "../../configure/command.js";
import { CliError } from "../../core/errors.js";
import { runSkillsCommand } from "../skills.js";

export default class ConfigureSkills extends ProjectCommand {
  static description = "lista, instala, atualiza e verifica skills do projeto";
  static args = {
    action: Args.string({
      description: "operação sobre as skills",
      options: ["list", "install", "update", "verify"],
      required: true,
    }),
    skill: Args.string({ description: "ID da skill", required: false }),
  };
  static flags = {
    ...configureContextFlags,
    client: Flags.string({
      description: "diretório padrão do cliente",
      options: ["codex", "claude"],
      default: "codex",
    }),
    all: Flags.boolean({ description: "instala todas as skills publicadas" }),
  };

  async run() {
    const { args, flags } = await this.parse(ConfigureSkills);
    const context = await this.projectContext(configureContextInput(flags), {
      requireWorkspace: true,
    });
    const target = path.join(
      context.projectDirectory,
      flags.client === "claude" ? ".claude" : ".agents",
      "skills",
    );
    let action = args.action;
    let positional = args.skill ? [args.skill] : [];
    if (action === "install" && flags.all) action = "install-all";
    if (action === "install" && !args.skill) {
      if (!context.isInteractive) {
        throw new CliError(
          "Informe o ID da skill ou use --all em modo não interativo.",
          { code: "SKILL_SELECTION_REQUIRED", exitCode: 2 },
        );
      }
      const catalog = await context.api.list();
      if (!catalog.items.length)
        throw new CliError("Nenhuma skill publicada no catálogo.", {
          code: "SKILL_CATALOG_EMPTY",
        });
      const selected = await this.adapters.prompts.ask({
        name: "skill",
        type: "select",
        message: "Skill a instalar",
        choices: catalog.items.map((item) => ({
          name: `${item.skillId}@${item.latestVersion}`,
          value: item.skillId,
        })),
      });
      positional = [selected];
    }
    if (action === "verify") action = "status";
    await runSkillsCommand(context.api, action, positional, {
      force: flags.force,
      json: flags.json,
      target,
    });
  }
}
