import { Flags } from "@oclif/core";
import { createSkillsCommand } from "../../compatibilityCommands.js";

export default createSkillsCommand("status", {
  description: "verifica integridade e atualização das skills instaladas",
  flags: { target: Flags.string({ description: "diretório de instalação" }) },
});
