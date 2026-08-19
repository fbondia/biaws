import { ProjectCommand } from "../../baseCommands.js";
import {
  configureContextFlags,
  interactiveConfigureInput,
  legacyAgentContext,
} from "../../configure/command.js";
import { runAgentCommand } from "../agent.js";

export default class ConfigureCodex extends ProjectCommand {
  static description =
    "configura MCP e skills do Codex sem persistir credenciais no projeto";
  static flags = configureContextFlags;

  async run() {
    const { flags } = await this.parse(ConfigureCodex);
    const input = await interactiveConfigureInput(this, flags);
    const context = await this.projectContext(input);
    await runAgentCommand(
      context.api,
      "configure",
      ["codex"],
      {
        ...flags,
        interactive: input.interactive,
        project: context.projectDirectory,
        prompts: this.adapters.prompts,
      },
      legacyAgentContext(context),
    );
  }
}
