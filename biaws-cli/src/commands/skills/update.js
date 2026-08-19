import { Flags } from "@oclif/core";
import {
  createSkillsCommand,
  optionalSkillArgument,
} from "../../commandFactories.js";

export default createSkillsCommand("update", {
  description: "atualiza uma ou todas as skills instaladas",
  args: { skill: optionalSkillArgument },
  flags: { target: Flags.string({ description: "diretório de instalação" }) },
  positional: (args) => (args.skill ? [args.skill] : []),
});
