import { Flags } from "@oclif/core";
import { AuthenticatedApiCommand } from "../baseCommands.js";
import { asCliError, DomainReadService, readEnvelope } from "./readService.js";

export const connectionFlags = {
  "api-url": Flags.string({ description: "URL da API" }),
  instance: Flags.string({ description: "instância local configurada" }),
  json: Flags.boolean({ description: "emite somente JSON v1 em stdout" }),
  profile: Flags.string({ description: "perfil global da API" }),
  workspace: Flags.string({ description: "ID do workspace" }),
};

export const listFlags = {
  limit: Flags.integer({ min: 1, description: "quantidade por página" }),
  page: Flags.integer({ min: 1, description: "página" }),
  search: Flags.string({ description: "busca textual" }),
  status: Flags.string({ description: "filtra por status" }),
};

export class ReadCommand extends AuthenticatedApiCommand {
  async read(flags, operation, options = {}) {
    try {
      const context = await this.authenticatedContext(
        {
          apiUrl: flags["api-url"],
          instance: flags.instance,
          profile: flags.profile,
          workspace: flags.workspace,
        },
        { requireWorkspace: Boolean(options.requireWorkspace) },
      );
      const service = new DomainReadService(context.api);
      const payload = await operation(service, context);
      return {
        context,
        envelope: readEnvelope(
          options.resource,
          options.operation,
          payload,
          options.scope?.(context) || { workspaceId: context.workspaceId },
        ),
        payload,
      };
    } catch (error) {
      throw asCliError(error, options.resource);
    }
  }

  emit(flags, result, human) {
    if (flags.json) {
      this.output({ json: true }).result(result.envelope);
      return;
    }
    const lines = [human(result.payload)];
    const scope = result.envelope.scope;
    lines.push(
      `Escopo: workspace=${scope.workspaceId || "não informado"}${scope.applicationId ? ` application=${scope.applicationId}` : ""}${scope.requestId ? ` demand=${scope.requestId}` : ""}`,
    );
    if (result.envelope.pagination) {
      const page = result.envelope.pagination;
      lines.push(
        `Paginação: page=${page.page ?? "não informada"} limit=${page.limit ?? "não informado"} returned=${page.returned ?? "desconhecido"} total=${page.total ?? "desconhecido"} truncated=${page.truncated}`,
      );
    }
    this.output().result(lines.join("\n"));
  }
}
