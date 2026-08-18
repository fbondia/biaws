import { Flags } from "@oclif/core";
import { createSkillsCommand } from "../../compatibilityCommands.js";

export default createSkillsCommand("publish", {
  description: "publica uma versão de skill",
  flags: {
    dir: Flags.string({ description: "diretório da skill", required: true }),
    version: Flags.string({ description: "versão semântica", required: true }),
    changelog: Flags.string({ description: "notas da versão" }),
  },
});
