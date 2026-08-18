import { Command } from "@oclif/core";
export default class Applications extends Command {
  static description = "Consulta aplicações autorizadas pela API";
  async run() {
    await this.config.runCommand("help", ["applications"]);
  }
}
