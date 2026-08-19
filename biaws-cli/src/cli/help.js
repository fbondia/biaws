import { Args, Command, Help } from "@oclif/core";

const OVERVIEW = `Bondia Workspaces (BIAWS)

O BIAWS organiza o contexto operacional de aplicações, melhorias, issues,
conhecimento e agentes. Este CLI permite administrar uma instalação, configurar
o acesso global e trabalhar com o workspace associado à pasta atual.

NÍVEIS
  admin      instala, diagnostica e opera instâncias da plataforma
  config     gerencia URLs, perfis e credenciais globais
  workspace  associa a pasta e acessa os recursos do workspace

PRIMEIROS PASSOS
  biaws config init
  biaws workspace init
  biaws workspace applications list

AJUDA
  biaws help admin
  biaws help config
  biaws help workspace issues

PROJETO
  https://github.com/fbondia/biaws`;

export default class HelpCommand extends Command {
  static description = "explica o BIAWS ou exibe a ajuda de um comando";
  static strict = false;
  static args = {
    command: Args.string({
      description: "caminho do comando",
      multiple: true,
    }),
  };

  async run() {
    const { args } = await this.parse(this.constructor);
    const subject = args.command || [];
    if (!subject.length) {
      this.log(OVERVIEW);
      return;
    }
    await new Help(this.config).showHelp(subject);
  }
}
