import { Command } from "@oclif/core";
export default class Workspaces extends Command {
  static description = "Consulta workspaces autorizados pela API";
  async run() {
    await this.config.runCommand("help", ["workspaces"]);
  }
}
