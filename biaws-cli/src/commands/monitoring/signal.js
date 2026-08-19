import { Flags } from "@oclif/core";
import {
  createMonitoringCommand,
  runtimeArgument,
} from "../../commandFactories.js";

export default createMonitoringCommand("signal", {
  description: "registra um sinal idempotente de saúde do runtime",
  args: { runtime: runtimeArgument },
  flags: {
    source: Flags.string({ description: "origem do sinal", required: true }),
    status: Flags.string({
      options: ["unknown", "healthy", "degraded", "unavailable", "stopped"],
    }),
    "signal-id": Flags.string({ description: "identificador idempotente" }),
    "observed-at": Flags.string({ description: "instante observado" }),
    message: Flags.string({ description: "mensagem do sinal" }),
    metadata: Flags.string({ description: "objeto JSON de metadados" }),
    "metadata-profile": Flags.string({ description: "perfil dos metadados" }),
    template: Flags.string({ description: "ID do template" }),
    "template-version": Flags.string({ description: "versão do template" }),
    payload: Flags.string({ description: "payload JSON do template" }),
  },
  positional: (args) => [args.runtime],
});
