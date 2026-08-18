import { Command } from "@oclif/core";
export default class Issues extends Command {
  static description = "Consulta incidentes e issues pela API";
  async run() {
    await this.config.runCommand("help", ["issues"]);
  }
}
