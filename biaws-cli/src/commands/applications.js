import { Command, Help } from "@oclif/core";
export default class Applications extends Command {
  static description = "Consulta aplicações autorizadas pela API";
  async run() {
    await this.parse(Applications);
    await new Help(this.config).showHelp(["applications"]);
  }
}
