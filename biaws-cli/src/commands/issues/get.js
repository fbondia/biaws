import { Args } from "@oclif/core";
import { connectionFlags, ReadCommand } from "../../domain/readCommand.js";
export default class IssueGet extends ReadCommand {
  static description = "Obtém uma issue por ID ou código";
  static args = { id: Args.string({ required: true }) };
  static flags = connectionFlags;
  async run() {
    const { args, flags } = await this.parse(IssueGet);
    const result = await this.read(flags, (api) => api.issue(args.id), {
      resource: "issue",
      operation: "get",
      requireWorkspace: true,
    });
    this.emit(flags, result, (p) => JSON.stringify(p.issue || p, null, 2));
  }
}
