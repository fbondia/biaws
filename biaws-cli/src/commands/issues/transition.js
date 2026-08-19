import { Args, Flags } from "@oclif/core";
import { WriteCommand, writeFlags } from "../../domain/writeCommand.js";

export default class IssueTransition extends WriteCommand {
  static description = "executa uma transição suportada de status de issue";
  static args = { issue: Args.string({ required: true }) };
  static flags = {
    ...writeFlags,
    status: Flags.string({ required: true, description: "novo status" }),
  };

  async run() {
    const { args, flags } = await this.parse(IssueTransition);
    return this.write(
      flags,
      "issue",
      async (service) => {
        const payload = await service.issue(args.issue);
        const issue = payload.issue || payload;
        return {
          resource: "issue",
          operation: "status.transition",
          applicationId: issue.applicationId || null,
          currentStatus: issue.status,
          status: flags.status,
          label: `Issue ${issue.code || issue.id || issue._id || args.issue}`,
          entity: issue,
        };
      },
      (service, plan) => service.updateIssueStatus(args.issue, plan.status),
    );
  }
}
