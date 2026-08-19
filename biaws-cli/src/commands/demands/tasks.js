import { Args, Flags } from "@oclif/core";
import { connectionFlags, ReadCommand } from "../../domain/readCommand.js";
import { readEnvelope, table } from "../../domain/readService.js";
export default class DemandTasks extends ReadCommand {
  static description = "lista tarefas de uma melhoria";
  static args = { demand: Args.string({ required: true }) };
  static flags = {
    ...connectionFlags,
    status: Flags.string({ description: "filtra por status" }),
  };
  async run() {
    const { args, flags } = await this.parse(DemandTasks);
    const result = await this.read(
      flags,
      async (api, c) => {
        const payload = await api.demand(args.demand, {
          workspaceId: c.workspaceId,
        });
        const request = payload.request || payload;
        const items = (request.tasks || []).filter(
          (x) => !flags.status || x.status === flags.status,
        );
        return { items, meta: { total: items.length } };
      },
      {
        resource: "tasks",
        operation: "list",
        requireWorkspace: true,
        scope: (c) => ({ workspaceId: c.workspaceId, requestId: args.demand }),
      },
    );
    result.envelope = readEnvelope("tasks", "list", result.payload, {
      workspaceId: result.context.workspaceId,
      requestId: args.demand,
    });
    this.emit(flags, result, (p) =>
      table(p.items, [
        ["CÓDIGO", (x) => x.code || x.id],
        ["TÍTULO", (x) => x.title],
        ["STATUS", (x) => x.status],
      ]),
    );
  }
}
