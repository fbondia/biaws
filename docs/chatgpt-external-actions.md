# Operação atual e futura publicação — CHATGPT-PLUGIN

A implementação foi encerrada por aceite do usuário em 2026-10-17: 25 tarefas
concluídas e P17/P27 aguardando decisão para o catálogo. As PRs #22 e #25 foram
mergeadas; as publicações npm MCP 0.15.0 e CLI 0.6.0 foram confirmadas. O
[relatório de entrega](chatgpt-delivery.md) preserva versões e evidências.

## Para usar agora

Siga [BIAWS no ChatGPT por servidor MCP personalizado](chatgpt.md). Cadastre a
URL HTTPS da sua instância **com `/mcp`**, use OAuth/CIMD, autentique no BIAWS,
escolha o workspace e confira as ferramentas. Instale a conexão e selecione-a
com `@` na conversa. Não é necessário gerar ou importar um ZIP.

## Para administrar uma instância

1. Escolha a instância e uma janela de manutenção. Mantenha DNS/TLS públicos
   válidos e a origem correta em `BIAWS_PUBLIC_URL`.
2. Use CLI 0.6.0 ou posterior e checkout atualizado. Habilite MCP pelo update
   com `--mcp-http`, seguindo o [runbook](chatgpt-operations.md), com backup.
   O procedimento prepara MongoDB em replica set e o segredo dedicado.
3. Confira saúde/login e o diagnóstico a partir de uma máquina externa:

   ```sh
   biaws workspace agent configure chatgpt --url https://SUA-INSTANCIA --diagnose --json
   ```

   Aqui o argumento é a origem, sem `/mcp`; no ChatGPT é o endpoint completo.
   O diagnóstico não habilita serviços nem executa login OAuth e não comprova
   o acesso autenticado pela infraestrutura do ChatGPT.
4. Após atualizar o servidor, use Atualizar ferramentas no ChatGPT e valide em
   uma conversa nova. Para falhas após login, veja o
   [diagnóstico de delegação CIMD](chatgpt-operations.md#oauth-conclui-mas-a-descoberta-de-ferramentas-falha).
5. Registre deployments somente após implantação real, com alvo, versão,
   revisão e data comprovados; publicação npm não é implantação da plataforma.

## Se a publicação no catálogo for retomada — P17/P27

Essa etapa está adiada e não bloqueia o uso atual. Antes de submeter:

- Revalide os requisitos oficiais e a elegibilidade de URLs independentes por
  template. Não se presume suporte universal a qualquer domínio de cliente.
- Prepare identidade/domínio, páginas reais de produto, suporte, privacidade e
  termos, acesso de revisão pelo canal seguro, vídeo, casos e scans atuais.
- Gere o candidato com o endpoint HTTPS de revisão confirmado:

  ```sh
  node scripts/chatgpt/consolidate-candidate.mjs --url https://SUA-INSTANCIA/mcp
  ```

  O ZIP fica em `plugins/dist/chatgpt-plugin/plugin-candidate/`. Loopback é
  apenas teste offline. O comando não publica pacotes nem cria a conexão.
- Após mudanças nos metadados, reconstrua o ZIP e vincule a evidência à versão,
  ao checksum e ao endpoint exatos em `plugins/catalog/readiness.json`.
  Execute o gate com o arquivo final:

  ```sh
  node plugins/scripts/catalog-readiness.mjs --archive /caminho/biaws-plugin-0.1.0-rc.1.zip --require-ready
  ```

O [dossiê](../plugins/catalog/review-guide.md) detalha essa preparação. Um gate
local aprovado não equivale à aprovação da OpenAI. Submissão e publicação
dependem de decisão própria e evidências reais.
