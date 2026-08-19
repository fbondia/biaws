import { Args } from "@oclif/core";
import { connectionFlags, ReadCommand } from "../../domain/readCommand.js";
export default class DemandGet extends ReadCommand {
  static description = "obtém uma melhoria por ID ou código";
  static args = { id: Args.string({ required: true }) };
  static flags = connectionFlags;
  async run() {
    const { args, flags } = await this.parse(DemandGet);
    const result = await this.read(
      flags,
      (api, c) => api.demand(args.id, { workspaceId: c.workspaceId }),
      { resource: "demand", operation: "get", requireWorkspace: true },
    );
    this.emit(flags, result, (p) => JSON.stringify(p.request || p, null, 2));
  }
}
