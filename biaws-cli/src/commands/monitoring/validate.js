import { Flags } from "@oclif/core";
import { createMonitoringCommand } from "../../compatibilityCommands.js";

export default createMonitoringCommand("validate", {
  description: "valida um payload sem persistir sinal",
  flags: {
    template: Flags.string({ description: "ID do template", required: true }),
    "template-version": Flags.string({
      description: "versão do template",
      required: true,
    }),
    payload: Flags.string({ description: "payload JSON", required: true }),
  },
});
