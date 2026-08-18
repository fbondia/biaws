import {
  connectionFlags,
  listFlags,
  ReadCommand,
} from "../../domain/readCommand.js";
import { table } from "../../domain/readService.js";
export default class ApplicationList extends ReadCommand {
  static description = "Lista aplicações do workspace";
  static flags = { ...connectionFlags, ...listFlags };
  async run() {
    const { flags } = await this.parse(ApplicationList);
    const result = await this.read(
      flags,
      (api, c) =>
        api.applications(c.workspaceId, {
          q: flags.search,
          status: flags.status,
          page: flags.page,
          limit: flags.limit,
        }),
      { resource: "applications", operation: "list", requireWorkspace: true },
    );
    this.emit(flags, result, (p) =>
      table(p.items || [], [
        ["ID", (x) => x.id],
        ["CHAVE", (x) => x.key],
        ["NOME", (x) => x.name],
        ["STATUS", (x) => x.status],
      ]),
    );
  }
}
