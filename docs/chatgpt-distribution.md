# Conexão no ChatGPT e distribuição futura

Decisão final de CHATGPT-PLUGIN: implementação concluída com aceite do usuário
para uso por servidor MCP personalizado. Publicação no catálogo adiada, com
P17/P27 aguardando decisão. O [guia do usuário](chatgpt.md) é o ponto de partida;
o cadastro não exige ZIP ou publicação.

A conexão atual liga o ChatGPT diretamente à URL HTTPS da instalação do
cliente, com OAuth. Em ChatGPT Plugins,
adicionar um MCP personalizado com o endpoint `/mcp` da instância e instalar a
conexão no contexto pessoal ou workspace permitido. Disponibilidade e políticas
dependem da conta/workspace do usuário.

O pacote local preservado tem identidade estável, skills portáteis e onboarding. Seu build de
teste recebe explicitamente a URL de uma instância; isso não constitui
um plugin universal nem permite substituir o servidor de uma listagem pública
arbitrariamente. As skills não fazem o registro OAuth no lugar do cliente.

## Etapa futura: pacotes e catálogo

Preparar raiz portátil `plugin.json`, `mcp.json`, `skills/` e `assets/`. Gerar
artefato determinístico e checksum. A configuração contém apenas endpoints e
preferências de autenticação, nunca credenciais, tokens ou um identificador de
conexão pessoal `plugin_asdk_app`.

Para o catálogo remoto, o fluxo documentado é **With MCP**, com endpoint HTTPS
estável, domínio verificável e autenticação testada. Upload de skills apenas
não substitui a conexão MCP remota. Manter separados o pacote para testar uma
instância e os materiais de futura submissão.

URLs por template (por exemplo um subdomínio de cliente) são restritas a
desenvolvedores com relacionamento estabelecido com a OpenAI. Não se presume
elegibilidade do BIAWS, suporte a domínio arbitrário ou campo de URL por usuário
em toda instalação de plugin público. Essa restrição não bloqueia a conexão
direta personalizada.

## Pendências da futura submissão

- Aprovação da estratégia de endpoints para a listagem pública, inclusive
  confirmação da elegibilidade a templates quando aplicável.
- Identidade verificada do publicador e acesso Apps Management ao portal.
- Domínio HTTPS de revisão, challenge de domínio, páginas reais de produto,
  suporte, privacidade e termos.
- Conta demonstrativa fornecida apenas pelo canal seguro do portal, scans e
  revisão final da OpenAI.

Gateway central exigiria outra arquitetura e decisão de produto. Não está
incluído nesta implementação. Não publicar nem enviar solicitações a terceiros
como consequência de gerar o pacote.

## Referências

- [Conexão direta](https://developers.openai.com/api/docs/guides/custom-mcp-server#how-to-use)
- [Formato portátil](https://developers.openai.com/plugins/build/plugins#plugin-structure)
- [URLs por template](https://developers.openai.com/plugins/deploy/app-review#template-mcp-server-urls)
- [Requisitos de submissão](https://developers.openai.com/plugins/deploy/submission-errors#final-directory-submission)
