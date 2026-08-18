import { Args } from "@oclif/core";
import { connectionFlags, ReadCommand } from "../../domain/readCommand.js";
export default class ApplicationGet extends ReadCommand {
  static description = "Obtém uma aplicação por ID";
  static args = { id: Args.string({ required: true }) };
  static flags = connectionFlags;
  async run() {
    const { args, flags } = await this.parse(ApplicationGet);
    const result = await this.read(flags, (api) => api.application(args.id), {
      resource: "application",
      operation: "get",
    });
    this.emit(flags, result, (p) =>
      JSON.stringify(p.application || p, null, 2),
    );
  }
}
