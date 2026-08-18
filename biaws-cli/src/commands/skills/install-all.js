import { Flags } from "@oclif/core";
import { createSkillsCommand } from "../../compatibilityCommands.js";

export default createSkillsCommand("install-all", {
  description: "instala todas as skills publicadas",
  flags: {
    target: Flags.string({ description: "diretório de instalação" }),
    force: Flags.boolean({
      char: "f",
      description: "atualiza instalações existentes",
    }),
  },
});
