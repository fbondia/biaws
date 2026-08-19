import { Flags } from "@oclif/core";
import {
  createMonitoringCommand,
  runtimeArgument,
} from "../../commandFactories.js";

export default createMonitoringCommand("signals", {
  description: "lista sinais recebidos por um runtime",
  args: { runtime: runtimeArgument },
  flags: {
    limit: Flags.integer({ description: "quantidade máxima" }),
    page: Flags.integer({ description: "página" }),
    status: Flags.string({ description: "filtra por estado" }),
    source: Flags.string({ description: "filtra por origem" }),
  },
  positional: (args) => [args.runtime],
});
