# Dossiê de revisão — CHATGPT-PLUGIN/P17

Material preparado; nenhuma submissão ou publicação foi realizada.

O manifesto contém base em inglês, tradução pt-BR, três prompts únicos,
ícone 138×138 existente e exatamente cinco casos positivos/três negativos.
Esses casos têm prompts, ferramentas esperadas e resultados observáveis.
tool-justifications.json fornece justificativa separada para cada hint de cada
tool remota. O título, texto curto e demais campos são validados pelos limites
atuais; catalog-readiness.mjs --require-ready falha enquanto faltar evidência.

## Dataset e walkthrough

O operador deve preparar uma instância de revisão com dados sintéticos:
Review Application, Review sample improvement e Review classification issue,
taxonomia/tags válidas e duas contas com permissões de escrita e somente leitura.
Esses nomes são uma receita de fixture, não IDs ou registros já criados.
Criar os dados depois de confirmar a instância, sem alterar uma instalação real.

Gravar uma jornada que conecte por OAuth, execute os cinco casos positivos e os
três negativos do manifesto, confira autoria/persistência, mostre revogação e
nova conexão. Testar nas superfícies anunciadas e usar a versão/checksum exatos.
Vídeo e conta de revisão ainda não foram produzidos. Não incluir credenciais
nem instruções de acesso em plugin.json; usar o formulário seguro do portal.

## URLs e identidade

- Produto: https://github.com/fbondia/biaws — repositório público confirmado.
- Suporte: https://github.com/fbondia/biaws/issues — canal existente confirmado.
- Privacidade e termos: pendentes de conteúdo/URL publicados e revisão do
  responsável. Não foram criadas URLs fictícias nem declarada aceitação jurídica.
- Autoria Fabiano Bondia vem do projeto; a identidade do publicador ainda deve
  ser verificada no portal com as permissões Apps Management apropriadas.

A documentação de privacidade deverá explicar o fluxo direto
ChatGPT → instância do cliente, dados de domínio enviados por tools,
OAuth/tokens/revogação, retenção e responsabilidade de cada operador. O
conteúdo definitivo depende das práticas e políticas reais do publicador.
Os termos devem refletir o serviço efetivamente oferecido e seus limites.

## Endpoint, domínio e elegibilidade

A conexão direta personalizada continua utilizável por instância.
A listagem pública não oferece automaticamente um campo livre de URL para cada
cliente. Templates são restritos a publicadores com relacionamento elegível
com a OpenAI; essa elegibilidade não foi confirmada. Não foi criado gateway.

O portal With MCP exige endpoint HTTPS real e scan atual. Hospedar o challenge
exato fornecido pelo portal no domínio/parent permitido, sem substituir token
de outro plugin, e comprovar Verify Domain. Não enviar placeholder como URL
de exemplo. Declarar recursos, callbacks e CIMD segundo a conexão gerenciada.
O challenge e o domínio só podem ser configurados com alvo real autorizado.

## Gate externo pendente

readiness.json mantém explicitamente false/null para identidade, domínio,
template elegível, cliente ChatGPT, URLs jurídicas revisadas, vídeo, execução
dos casos e scans de skills/tools. Atualizar somente com evidência real.
Capturas são necessárias somente se o scan encontrar UI MCP customizada; o
plugin atual usa resultados estruturados e não anuncia output templates de UI.

As evidências também devem identificar `pluginVersion` e `artifactSha256`.
Executar o gate com o ZIP definitivo e seu arquivo `.sha256`:

```sh
node plugins/scripts/catalog-readiness.mjs --archive /caminho/biaws-plugin-0.1.0-rc.1.zip --require-ready
```

O comando verifica a instalação/checksum do ZIP e exige correspondência entre
manifesto atual, versão, checksum aprovado e `reviewEndpoint`. Flags de uma
versão anterior não bastam. Endpoint de loopback, URL de teste e credenciais
embutidas não são aceitos para prontidão pública. Depois de alterar o pacote,
repetir os testes/scans pertinentes e registrar a evidência referente ao novo
checksum. Esse vínculo local não substitui os scans ou a revisão do portal.

Referências oficiais revalidadas em 2026-10-17:

- [Submissão e campos](https://developers.openai.com/plugins/deploy/submission)
- [Limites finais](https://developers.openai.com/plugins/deploy/submission-errors#final-directory-submission)
- [Templates de URL](https://developers.openai.com/plugins/deploy/app-review#template-mcp-server-urls)

Revalidar novamente antes do envio: regras e disponibilidade podem mudar.
O perfil de schema OpenAI do pacote está documentado em ../README.md.
