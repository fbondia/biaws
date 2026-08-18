import { Flags } from "@oclif/core";
import { AuthenticatedApiCommand } from "../baseCommands.js";
import { CliError } from "../core/errors.js";
import {
  asWriteCliError,
  DomainWriteService,
  writeEnvelope,
} from "./writeService.js";

export const writeFlags = {
  "api-url": Flags.string({ description: "URL da API" }),
  instance: Flags.string({ description: "instância local configurada" }),
  json: Flags.boolean({ description: "emite somente JSON v1 em stdout" }),
  workspace: Flags.string({ description: "ID do workspace" }),
  yes: Flags.boolean({ char: "y", description: "confirma a alteração" }),
};

export class WriteCommand extends AuthenticatedApiCommand {
  async write(flags, resource, resolve, mutate) {
    try {
      const context = await this.authenticatedContext(
        {
          apiUrl: flags["api-url"],
          instance: flags.instance,
          workspace: flags.workspace,
        },
        { requireWorkspace: true },
      );
      const service = new DomainWriteService(context.api);
      const plan = await resolve(service, context);
      if (plan.currentStatus === plan.status) {
        return this.emit(flags, {
          ...plan,
          workspaceId: context.workspaceId,
          changed: false,
          previousStatus: plan.currentStatus,
          data: plan.entity,
        });
      }
      await this.confirm(flags, plan);
      const payload = await mutate(service, plan, context);
      return this.emit(flags, {
        ...plan,
        workspaceId: context.workspaceId,
        changed: true,
        previousStatus: plan.currentStatus,
        data: payload,
      });
    } catch (error) {
      throw asWriteCliError(error, resource);
    }
  }

  async confirm(flags, plan) {
    if (flags.yes) return;
    if (!this.adapters.terminal.isInteractive) {
      throw new CliError(
        "Confirmação necessária. Use --yes em modo não interativo.",
        {
          code: "CONFIRMATION_REQUIRED",
          exitCode: 2,
        },
      );
    }
    const confirmed = await this.adapters.prompts.ask({
      name: "confirmation",
      type: "confirm",
      default: false,
      message: `${plan.label}: alterar status de ${plan.currentStatus} para ${plan.status}?`,
    });
    if (!confirmed) {
      throw new CliError("Alteração cancelada.", {
        code: "OPERATION_CANCELLED",
        exitCode: 2,
      });
    }
  }

  emit(flags, result) {
    const envelope = writeEnvelope(result.resource, result.operation, result);
    if (flags.json) this.output({ json: true }).result(envelope);
    else {
      this.output().result(
        result.changed
          ? `${result.label}: ${result.previousStatus} -> ${result.status}`
          : `${result.label}: já está em ${result.status}; nenhuma alteração realizada.`,
      );
    }
    return envelope;
  }
}
