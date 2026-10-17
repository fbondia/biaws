# Usar o BIAWS diretamente no ChatGPT

Conecte a sua instância BIAWS como **servidor MCP personalizado** no ChatGPT.
Você entra com a conta BIAWS que já usa, escolhe um workspace e autoriza os
acessos. A conversa passa a ter ferramentas para consultar aplicações, issues,
melhorias e conhecimento, além de executar as alterações permitidas.

Esse é o caminho de uso atual. Não é necessário gerar ou importar um ZIP,
publicar um plugin no catálogo nem instalar Codex, Node.js ou o CLI na máquina
de quem vai conversar com o ChatGPT. A publicação no marketplace é uma etapa
futura, independente dessa conexão.

## Antes de conectar

- Tenha uma conta BIAWS com acesso ao workspace desejado.
- Peça ao administrador a **URL HTTPS do MCP**, incluindo `/mcp`. A instância
  precisa estar atualizada, com MCP HTTP/OAuth habilitado e acessível pelo
  ChatGPT, com certificado válido.
- Use o ChatGPT na web e uma conta/workspace que permita adicionar servidores
  MCP personalizados. Políticas da organização e restrições da conta podem
  limitar essa opção; ter uma assinatura não garante sua disponibilidade.

Para o administrador: a habilitação e o diagnóstico pelo CLI estão no
[runbook de operação](chatgpt-operations.md#instalação-e-habilitação). A pessoa
que apenas usa uma instância já preparada pode seguir direto para o cadastro.

## 1. Cadastre o servidor MCP

1. Abra [ChatGPT Plugins](https://chatgpt.com/plugins) no navegador.
2. Selecione **+ → Add custom MCP server** (adicionar servidor MCP personalizado).
3. Dê um nome à conexão, como **BIAWS da equipe**.
4. Em **Connection / Server URL**, informe o endpoint completo da sua instância:

   ```text
   https://biaws.suaempresa.com/mcp
   ```

5. Escolha autenticação **OAuth**. Se o formulário oferecer o método de
   registro do cliente, escolha **CIMD** (Client ID Metadata Document), suportado
   pelo BIAWS. A configuração padrão não exige que você forneça Client ID,
   Client Secret ou uma chave de API BIAWS. Se a tela exigir essas credenciais
   e não oferecer CIMD, confira o fluxo disponível com o administrador.
6. Leia o aviso e selecione **I understand and want to continue**, depois
   **Create as a plugin**. Os rótulos podem variar com o idioma e a interface.

**O sufixo `/mcp` é obrigatório.** `https://biaws.suaempresa.com` abre a UI;
`https://biaws.suaempresa.com/mcp` atende o protocolo e a descoberta das
ferramentas. O rótulo “Create as a plugin” cria a conexão personalizada;
ele não publica seu servidor no marketplace.

## 2. Entre no BIAWS e escolha o workspace

No fluxo OAuth, autentique no navegador com sua conta BIAWS habitual. Confira
o cliente que está pedindo acesso, escolha o workspace BIAWS e consinta os
acessos apresentados. Conclua o retorno ao ChatGPT e confira as ferramentas
descobertas. Login concluído, sozinho, não comprova que elas foram carregadas.

O workspace escolhido aqui é o **workspace BIAWS**, diferente do workspace da
conta ChatGPT. Cada autorização fica vinculada a essa escolha. Mudar o workspace
na UI do BIAWS ou informar outro ID na conversa não muda a conexão. Para usar
outro workspace BIAWS, crie outra autorização e selecione-o no consentimento.

As ferramentas seguem as permissões atuais da sua conta e os acessos
consentidos. A conexão não concede permissões administrativas adicionais.
Senhas, tokens e chaves não devem ser enviados na conversa.

## 3. Use as ferramentas na conversa

Instale a conexão criada, caso a interface solicite. Abra uma conversa nova,
digite `@` e selecione **BIAWS da equipe**. Comece com uma consulta:

```text
Liste as aplicações acessíveis nesta conexão BIAWS.
```

Depois, experimente pedidos com um alvo conhecido:

```text
Consulte a melhoria EXEMPLO-123 e resuma o escopo, as tarefas e as pendências.
Não altere os registros.
```

```text
Leia a issue EXEMPLO-456 e proponha uma classificação usando a taxonomia
da aplicação. Mostre a proposta antes de gravar.
```

```text
Na melhoria EXEMPLO-123, registre uma nota com o resultado desta investigação
e confira o conteúdo salvo.
```

Substitua os identificadores pelos registros reais aos quais você tem acesso.
Revise as confirmações de escrita apresentadas pelo ChatGPT. A inclusão do MCP
disponibiliza ferramentas; ela não instala automaticamente as skills do ZIP
nem os arquivos de configuração usados por Codex/Claude Code.

## Atualizar ferramentas, reconectar e revogar

Após uma atualização do BIAWS, abra a conexão no ChatGPT e use **Atualizar
ferramentas / Refresh**. Confira a lista e teste em uma conversa nova. Se a
conta precisar de nova autorização, refaça OAuth pelo próprio ChatGPT.

Para encerrar o acesso, abra **Minha conta → Aplicativos conectados** no BIAWS
e revogue a conexão. Uma nova conexão exige novo consentimento. A remoção de
permissões ou do vínculo com o workspace também é reavaliada nas chamadas.

## Resolver problemas

| Sintoma | O que conferir |
| --- | --- |
| A opção de servidor personalizado não aparece | Use a versão web e confira as permissões/políticas da conta e do workspace ChatGPT com seu administrador. |
| `Authentication succeeded, action discovery failed` | Confirme `/mcp` na URL cadastrada. Se já estiver correto, peça ao administrador para verificar os logs da tentativa e a versão da API; autenticação e descoberta são etapas distintas. |
| `/api/auth/oauth2/token` retorna 200, mas `/api/auth/mcp/delegate` retorna 401 | Instalações anteriores à correção CIMD da PR #25 precisam ser atualizadas. O provider da delegação deve preservar a descoberta do cliente CIMD. Veja o runbook. |
| Login concluiu, mas as ferramentas não aparecem na conversa | Confira a descoberta na conexão, a instalação/seleção com `@`, use Atualizar ferramentas e abra uma conversa nova. |
| Registro não encontrado ou acesso negado | Confira a instância, o workspace BIAWS escolhido no consentimento e as permissões da conta. Para outro workspace, use outra autorização. |
| Discovery retorna 404 | O administrador deve conferir habilitação MCP HTTP/OAuth, containers atualizados e encaminhamento de `/.well-known/` e `/mcp` no proxy. |
| `/mcp` retorna 405 quando aberto no navegador | O endpoint atende POST do protocolo; uma navegação GET não é um teste de descoberta autenticada. |

O administrador pode diagnosticar a origem pelo CLI:

```sh
biaws workspace agent configure chatgpt \
  --url https://biaws.suaempresa.com --diagnose --json
```

**Aqui `--url` recebe apenas a origem, sem `/mcp`**; o CLI calcula o endpoint.
No formulário do ChatGPT, use o endpoint completo com `/mcp`. Esse comando
somente orienta/diagnostica: não habilita o serviço, não cria a conexão no
ChatGPT e não executa OAuth. Resultado `ok: true` comprova as verificações da
máquina que executou o CLI, não o acesso autenticado pela infraestrutura do ChatGPT.

## Catálogo de plugins: etapa futura

A entrega CHATGPT-PLUGIN foi encerrada com aceite para uso por servidor MCP
personalizado. O empacotamento local foi preservado; **P17 e P27** continuam
aguardando decisão para uma eventual submissão ao catálogo. Identidade,
domínio, materiais de revisão, scans, elegibilidade e aprovação ainda dependem
de etapas próprias. Esses requisitos não são pré-requisitos para cadastrar
seu servidor personalizado.

Consulte [distribuição](chatgpt-distribution.md), [situação da entrega](chatgpt-delivery.md)
e o [material de catálogo](../plugins/catalog/review-guide.md) se essa etapa
for retomada.

## Referências

Fluxo conferido na documentação oficial da OpenAI em 2026-10-17. A interface
e as políticas de disponibilidade podem mudar:

- [Conectar e testar um MCP no ChatGPT](https://developers.openai.com/plugins/deploy/connect-chatgpt#add-the-mcp-server).
- [Servidor MCP personalizado e autenticação](https://developers.openai.com/api/docs/guides/custom-mcp-server#how-to-use).
- [Operação do BIAWS: HTTP, OAuth, backup e diagnóstico](chatgpt-operations.md).
