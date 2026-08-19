import { Help } from "@oclif/core";

import { LocalInstanceCommand } from "../baseCommands.js";

export default class Instance extends LocalInstanceCommand {
  static description =
    "Instala, configura e opera instâncias locais do Bondia Workspaces";
  static examples = [
    "<%= config.bin %> instance setup",
    "<%= config.bin %> instance status",
    "<%= config.bin %> instance update",
    "<%= config.bin %> instance backup",
  ];

  async run() {
    await this.parse(Instance);
    await new Help(this.config).showHelp(["instance"]);
  }
}
