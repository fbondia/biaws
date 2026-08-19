import { wizardFlags, collectWizardValues } from "../../core/wizard.js";
import { ProjectCommand } from "../../baseCommands.js";
import {
  clientArgument,
  configureContextFlags,
  configureContextInput,
  legacyAgentContext,
} from "../../configure/command.js";
import { runAgentCommand } from "../agent.js";

const definition = {
  kind: "configure.doctor",
  questions: [
    {
      name: "client",
      type: "select",
      message: "Cliente a diagnosticar",
      choices: [
        { name: "Codex", value: "codex" },
        { name: "Claude", value: "claude" },
      ],
    },
  ],
};

export default class ConfigureDoctor extends ProjectCommand {
  static description = "diagnostica configuração, autenticação, MCP e skills";
  static args = { client: clientArgument };
  static flags = { ...configureContextFlags, ...wizardFlags };

  async run() {
    const { args, flags } = await this.parse(ConfigureDoctor);
    const context = await this.projectContext(configureContextInput(flags), {
      requireWorkspace: true,
    });
    const collected = await collectWizardValues(definition, {
      environment: context.env,
      flags: { client: args.client },
      options: flags,
      promptAdapter: this.adapters.prompts,
      terminal: this.adapters.terminal,
    });
    await runAgentCommand(
      context.api,
      "doctor",
      [collected.values.client],
      { ...flags, project: context.projectDirectory },
      legacyAgentContext(context),
    );
  }
}
