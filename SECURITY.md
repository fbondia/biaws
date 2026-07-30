# Política de segurança

## Versões suportadas

O projeto está em fase alpha. Somente a versão mais recente do branch `main`
recebe correções de segurança.

| Versão | Suporte |
| --- | --- |
| `main` / última `0.x` | Sim |
| versões anteriores | Não |

## Relato responsável

Não abra uma issue pública para vulnerabilidades, credenciais expostas ou dados
sensíveis.

Use **GitHub Security Advisories → Report a vulnerability** no repositório. Se
esse recurso não estiver disponível, contate o mantenedor por um canal privado
indicado no perfil do GitHub, sem incluir o segredo na primeira mensagem.

Inclua, quando possível:

- componente e versão afetados;
- impacto e pré-condições;
- passos mínimos de reprodução;
- evidências sanitizadas;
- sugestão de mitigação;
- indicação de que a informação pode ser divulgada após a correção.

Uma confirmação inicial será buscada em até sete dias. Prazos de correção e
divulgação serão definidos conforme impacto, complexidade e disponibilidade do
mantenedor. Este projeto não oferece SLA.

## Segredos

Nunca envie:

- arquivos `.env`;
- senhas ou chaves de API;
- strings de conexão com credenciais;
- dumps de MongoDB;
- EMLs, anexos ou dados operacionais reais.

Se um segredo for commitado, revogue-o primeiro. Remover o arquivo em um commit
novo não elimina o segredo do histórico; o histórico também deverá ser limpo e
revalidado antes de tornar o repositório público.
