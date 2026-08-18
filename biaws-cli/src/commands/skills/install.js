import { Args, Flags } from "@oclif/core";
import { createSkillsCommand } from "../../compatibilityCommands.js";

export default createSkillsCommand("install", {
  description: "instala uma skill publicada",
  args: { skill: Args.string({ description: "ID da skill", required: true }) },
  flags: {
    target: Flags.string({ description: "diretório de instalação" }),
    version: Flags.string({ description: "versão da skill" }),
    force: Flags.boolean({
      char: "f",
      description: "substitui a instalação existente",
    }),
  },
  positional: (args) => [args.skill],
});
