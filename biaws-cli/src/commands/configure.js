import { Help } from "@oclif/core";

import { ProjectCommand } from "../baseCommands.js";

export default class Configure extends ProjectCommand {
  static description =
    "Configura projetos, clientes de agentes e skills de desenvolvimento";
  static examples = [
    "<%= config.bin %> configure codex",
    "<%= config.bin %> configure claude",
    "<%= config.bin %> configure skills list",
    "<%= config.bin %> configure doctor codex",
  ];

  async run() {
    await this.parse(Configure);
    await new Help(this.config).showHelp(["configure"]);
  }
}
