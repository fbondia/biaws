# Aceite e roteiro de validação no ChatGPT

Em 2026-10-17, o usuário aceitou a implementação para uso por **servidor MCP
personalizado** e solicitou o encerramento da melhoria e das tarefas, exceto
P17/P27, relacionadas à futura submissão ao catálogo. Esse aceite não é
apresentado como execução individual de todos os cenários abaixo no ChatGPT.

Para configurar uma conexão, comece pelo [guia do usuário](chatgpt.md).
O roteiro abaixo serve para validar novas instâncias e alterações de versão.
Não exige pacote ZIP para a conexão personalizada.

## Validar a conexão e as ferramentas

1. Disponibilize a instância atualizada com HTTPS confiável, MCP HTTP/OAuth
   habilitado e dados de teste. Confira discovery e diagnóstico do administrador.
2. No ChatGPT pela web, adicione um servidor MCP personalizado com a URL
   completa `/mcp` e OAuth/CIMD. Use uma conta ChatGPT com essa opção permitida.
3. Autentique com a conta BIAWS existente, confira o cliente e os acessos,
   selecione o workspace BIAWS e consinta. Confirme a descoberta das ferramentas.
4. Instale/selecione a conexão com `@` em uma conversa nova. Consulte uma
   aplicação, melhoria e issue conhecidas. Confirme a instância e o escopo.
5. Crie ou altere um registro sintético permitido, confira o estado persistido
   e a autoria na auditoria. Verifique negativa com conta somente leitura e
   aplicação fora do escopo.
6. Recuse um consentimento, revogue a conexão em Minha conta, confira a
   negativa e conecte novamente. Valide renovação e outra autorização para
   um workspace diferente.
7. Após atualizar o servidor, atualize as ferramentas no ChatGPT e confirme a
   nova definição. Registre as capacidades efetivamente usadas, incluindo
   resources/links/streaming quando disponíveis no cliente.

## Registrar a evidência

Anote versão/revisão da instância, cenário, resultado, horário e configuração
de conta/workspace, sem credenciais. Testes automatizados em infraestrutura
descartável não substituem evidência de cada cenário no cliente real.

O histórico da entrega inclui os testes API/UI/MCP/CLI e integração TLS/SDK,
a correção de delegação CIMD da PR #25 e o aceite humano para o escopo atual.
Consulte o [relatório](chatgpt-delivery.md) e as notas de P16 no BIAWS.

## Testar o pacote de marketplace em uma etapa futura

A instalação offline do ZIP foi automatizada. Quando a etapa de catálogo for
retomada, gere o candidato para o endpoint HTTPS escolhido e execute:

```sh
node plugins/scripts/verify-install.mjs CAMINHO/biaws-plugin-VERSAO.zip
```

O teste verifica checksum, extrai em diretório vazio, valida os manifestos,
referências, seis skills e conteúdo permitido e remove a cópia. Não cria nem
autentica uma conexão pessoal no ChatGPT. A skill setup é uma orientação
textual, não um botão de login.

Teste então skills e ferramentas em conjunto pelo fluxo de distribuição
aplicável, em conversa nova e existente. Registre versão/checksum do ZIP,
capturas e vídeo sanitizados quando exigidos pela revisão. Revalide os
requisitos no [dossiê de catálogo](../plugins/catalog/review-guide.md).
Não inclua senhas/tokens no ZIP, Git, capturas ou notas das tarefas.
