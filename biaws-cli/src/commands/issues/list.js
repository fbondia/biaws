import { Flags } from "@oclif/core";
import {
  connectionFlags,
  listFlags,
  ReadCommand,
} from "../../domain/readCommand.js";
import { table } from "../../domain/readService.js";
export default class IssueList extends ReadCommand {
  static description = "Lista issues no escopo informado";
  static flags = {
    ...connectionFlags,
    ...listFlags,
    application: Flags.string({ description: "ID da aplicação" }),
    component: Flags.string({ description: "ID do componente" }),
    severity: Flags.string({ description: "filtra por severidade" }),
  };
  async run() {
    const { flags } = await this.parse(IssueList);
    const result = await this.read(
      flags,
      (api, c) =>
        api.issues({
          workspaceId: c.workspaceId,
          applicationId: flags.application,
          componentId: flags.component,
          status: flags.status,
          severity: flags.severity,
          q: flags.search,
          page: flags.page,
          limit: flags.limit,
        }),
      {
        resource: "issues",
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
        ["ID", (x) => x.clientCode || x.id],
        ["TÍTULO", (x) => x.title || x.summary],
        ["STATUS", (x) => x.status],
        ["SEVERIDADE", (x) => x.severity],
      ]),
    );
  }
}
