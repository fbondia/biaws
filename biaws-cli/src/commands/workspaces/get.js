import { Args } from "@oclif/core";
import { connectionFlags, ReadCommand } from "../../domain/readCommand.js";
export default class WorkspaceGet extends ReadCommand {
  static description = "Obtém um workspace por ID";
  static args = { id: Args.string({ required: true }) };
  static flags = connectionFlags;
  async run() {
    const { args, flags } = await this.parse(WorkspaceGet);
    const result = await this.read(flags, (api) => api.workspace(args.id), {
      resource: "workspace",
      operation: "get",
    });
    this.emit(flags, result, (p) => JSON.stringify(p.workspace || p, null, 2));
  }
}
