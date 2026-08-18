import { Flags } from "@oclif/core";
import {
  connectionFlags,
  listFlags,
  ReadCommand,
} from "../../domain/readCommand.js";
import { table } from "../../domain/readService.js";
export default class DemandList extends ReadCommand {
  static description = "Lista melhorias no escopo informado";
  static flags = {
    ...connectionFlags,
    ...listFlags,
    application: Flags.string({ description: "ID da aplicação" }),
    component: Flags.string({ description: "ID do componente" }),
  };
  async run() {
    const { flags } = await this.parse(DemandList);
    const result = await this.read(
      flags,
      (api, c) =>
        api.demands({
          workspaceId: c.workspaceId,
          applicationId: flags.application,
          componentId: flags.component,
          status: flags.status,
          text: flags.search,
          page: flags.page,
          limit: flags.limit,
        }),
      {
        resource: "demands",
        operation: "list",
        requireWorkspace: true,
        scope: (c) => ({
          workspaceId: c.workspaceId,
          applicationId: flags.application,
        }),
      },
    );
    this.emit(flags, result, (p) =>
      table(p.items || [], [
        ["CÓDIGO", (x) => x.clientCode || x.id],
        ["TÍTULO", (x) => x.title],
        ["STATUS", (x) => x.status],
      ]),
    );
  }
}
