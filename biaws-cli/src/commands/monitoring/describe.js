import { Flags } from "@oclif/core";
import { createMonitoringCommand } from "../../compatibilityCommands.js";

export default createMonitoringCommand("describe", {
  description: "descreve um contrato de monitoramento versionado",
  flags: {
    template: Flags.string({ description: "ID do template", required: true }),
    "template-version": Flags.string({
      description: "versão do template",
      required: true,
    }),
  },
});
