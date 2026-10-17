---
name: setup
description: Orientar a conexão direta à instância BIAWS por OAuth e confirmar o contexto autorizado, sem pedir credenciais na conversa.
---

# Conectar sua instância

Ajude o usuário a localizar a URL HTTPS pública da própria instância BIAWS.
A conexão MCP remota deve ser criada no ChatGPT com essa origem seguida de
`/mcp` e autenticação OAuth. O pacote gerado para uma instância já aponta para
sua URL; não existe troca de servidor por uma ferramenta de domínio.

O usuário autentica no navegador da instância com sua conta habitual, escolhe
um workspace acessível e consente os acessos. Nunca solicite senha, token,
client secret ou chave de API na conversa. Não capture credenciais nem peça
para desabilitar a autenticação.

Depois da conexão, use `applications_list` e, quando necessário,
`applications_get_context` para confirmar a aplicação. A concessão já está
vinculada a um workspace. Um header, ID informado na conversa ou mudança na
sessão web não troca esse vínculo. Para outro workspace, oriente uma nova
autorização. Conexões podem ser revogadas em Minha conta no BIAWS.

Se não houver ferramentas conectadas, explique como criar a conexão e retomar.
Erros 401 exigem reconexão no fluxo OAuth; 403 pode indicar permissão atual
insuficiente, workspace incorreto ou concessão revogada. Não contorne esses erros.

A instalação de um pacote local não representa publicação no catálogo.
A estratégia pública de várias instâncias depende da elegibilidade do publicador.
