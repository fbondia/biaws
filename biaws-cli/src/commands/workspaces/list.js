import { connectionFlags, ReadCommand } from "../../domain/readCommand.js";
import { table } from "../../domain/readService.js";
export default class WorkspaceList extends ReadCommand {
  static description = "lista workspaces autorizados";
  static flags = connectionFlags;
  async run() {
    const { flags } = await this.parse(WorkspaceList);
    const result = await this.read(flags, (api) => api.workspaces(), {
      resource: "workspaces",
      operation: "list",
    });
    this.emit(flags, result, (p) =>
      table(p.items || [], [
        ["ID", (x) => x.id],
        ["NOME", (x) => x.name],
        ["STATUS", (x) => x.status],
      ]),
    );
  }
}
