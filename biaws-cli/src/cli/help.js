import { Args, Help } from "@oclif/core";

import { LocalInstanceCommand } from "../baseCommands.js";

function overview(context) {
  return `Bondia Workspaces (BIAWS)

O BIAWS organiza o contexto operacional de aplicações, melhorias, issues,
conhecimento e agentes. Este CLI permite administrar uma instalação, configurar
o acesso global e trabalhar com o workspace associado à pasta atual.

NÍVEIS DE USO
  admin      instala, diagnostica e opera instalação e instâncias da plataforma
  config     gerencia URLs, perfis e credenciais globais
  workspace  associa a pasta e acessa os recursos do workspace

BIAWS CLI
  Raiz da instalação: ${context.repositoryRoot}
  Diretório de instâncias: ${context.instancesDirectory}
  Diretório do CLI: ${context.toolDirectory}

  Configure caminhos persistentes com as variáveis de ambiente:

    BIAWS_ROOT           raiz da release ou checkout BIAWS; deve conter
                         compose.yaml, scripts/ e os demais arquivos da plataforma
                         e é normalmente o diretório onde foi feito o git clone

    BIAWS_INSTANCES_DIR  diretório que conterá uma subpasta por instância,
                         com seu arquivo .env e dados de configuração, normalmente
                         é o uma pasta instances dentro do BIAWS_ROOT

  Exemplo:
    export BIAWS_ROOT=/opt/biaws
    export BIAWS_INSTANCES_DIR=/var/lib/biaws/instances

PRIMEIROS PASSOS
  biaws config init
  biaws workspace init
  biaws workspace applications list

AJUDA
  biaws help admin
  biaws help config
  biaws help workspace issues

PROJETO
  Saiba mais sobre o projeto (e contribua se quiser):
  https://github.com/fbondia/biaws`;
}

export default class HelpCommand extends LocalInstanceCommand {
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
      const context = await this.localContext();
      this.log(overview(context));
      return;
    }
    await new Help(this.config).showHelp(subject);
  }
}
