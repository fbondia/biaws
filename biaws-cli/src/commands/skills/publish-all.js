import { Flags } from "@oclif/core";
import { createSkillsCommand } from "../../compatibilityCommands.js";

export default createSkillsCommand("publish-all", {
  description: "publica as skills contidas em um diretório",
  flags: {
    dir: Flags.string({ description: "diretório do catálogo" }),
    "initial-version": Flags.string({
      description: "versão inicial",
      required: true,
    }),
    changelog: Flags.string({ description: "notas da versão" }),
  },
});
