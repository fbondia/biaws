import { Args, Flags } from "@oclif/core";
import { WriteCommand, writeFlags } from "../../domain/writeCommand.js";
import { findTask } from "../../domain/writeService.js";

export default class DemandTaskStatus extends WriteCommand {
  static description = "Altera o status de uma tarefa por ação específica";
  static args = {
    demand: Args.string({ required: true }),
    task: Args.string({ required: true }),
  };
  static flags = {
    ...writeFlags,
    status: Flags.string({ description: "novo status" }),
  };

  async run() {
    const { args, flags } = await this.parse(DemandTaskStatus);
    const status = flags.status || this.constructor.defaultStatus;
    if (!status) {
      this.error("Informe --status para alterar a tarefa.", {
        code: "MISSING_STATUS",
        exit: 2,
      });
    }
    return this.write(
      flags,
      "task",
      async (service) => {
        const { request, task } = findTask(
          await service.demand(args.demand),
          args.task,
        );
        return {
          resource: "task",
          operation: "status.update",
          requestId: request.id || args.demand,
          applicationId: request.applicationId || task.applicationId || null,
          taskId: task.id || task._id || task.code,
          currentStatus: task.status,
          status,
          label: `Tarefa ${task.code || task.id || task._id}`,
          entity: task,
        };
      },
      (service, plan) =>
        service.updateTaskStatus(plan.requestId, plan.taskId, plan.status),
    );
  }
}
