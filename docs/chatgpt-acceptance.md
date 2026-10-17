# Aceite no ChatGPT — CHATGPT-PLUGIN/P16

A extração/instalação offline do ZIP foi automatizada. A jornada no ChatGPT
ainda não ocorreu: não há endpoint público de revisão autorizado, e a atualização
de instalações existentes está fora da execução automática solicitada.
O teste P15 usa HTTPS local com CA privada e SDK oficial; não substitui o cliente.

## Preparação disponível

Gere o ZIP com endpoint HTTPS confirmado usando plugins/scripts/build.mjs.
Confira SHA-256 e execute:

```sh
node plugins/scripts/verify-install.mjs CAMINHO/biaws-plugin-VERSAO.zip
```

Esse teste extrai em diretório vazio, limita o ZIP, valida os manifestos,
referências, seis skills e conteúdo permitido e remove a cópia. Não instala
uma conexão pessoal no ChatGPT nem requer configuração prévia do usuário.

## Jornada pendente do operador

1. Disponibilizar uma instância de revisão HTTPS com certificado confiável e
   dados sintéticos, usando as versões preparadas. Confirmar reachability pelo
   ChatGPT e discovery da mesma origem.
2. Usar conta/workspace ChatGPT com permissão para adicionar MCP/plugin. Criar
   uma conexão nova com a URL /mcp e OAuth, sem reaproveitar uma conexão pessoal.
   Copiar do painel o callback e o client metadata URI exatos quando necessário.
3. Instalar o pacote correspondente à instância e invocar setup em conversa
   nova e durante uma conversa existente.
4. Autenticar com conta BIAWS existente, selecionar o workspace e consentir.
   Verificar nome do cliente, acessos, retorno ao ChatGPT e workspace efetivo.
5. Consultar uma melhoria e uma issue; testar resources/links/streaming no
   cliente, anotando as capacidades efetivamente utilizadas.
6. Criar/alterar um registro sintético permitido; conferir usuário, concessão e
   estado persistido na auditoria. Testar conta somente leitura e aplicação fora
   do escopo, sem usar dados de cliente.
7. Recusar um fluxo, revogar conexão em Minha conta, testar negativa e conectar
   de novo. Exercitar refresh e nova autorização para outro workspace.
8. Registrar resultado por cenário, versão/SHA-256 do ZIP, versões dos
   componentes, configuração de conta/workspace e capturas/vídeo sanitizados.

## Registro de evidência

| Cenário                               | Evidência local                    | Cliente ChatGPT |
| ------------------------------------- | ---------------------------------- | --------------- |
| ZIP em instalação vazia e checksum    | verify-install automatizado        | Pendente        |
| Login, consentimento, PKCE e recusa   | Testes de API/UI e P15             | Pendente        |
| Leitura/escrita, permissões e autoria | Duas instâncias TLS/SDK em P15     | Pendente        |
| Resources e links                     | SDK nas duas eras                  | Pendente        |
| Refresh/replay, revogação e reconexão | Provider/API/MCP em P15            | Pendente        |
| Onboarding e seis skills              | Portabilidade/contratos em P13/P14 | Pendente        |

Não colocar credenciais, tokens, URLs com segredo ou dados reais nas capturas,
ZIP, Git ou notas BIAWS. Acessos demonstrativos do portal são fornecidos apenas
no canal seguro apropriado. Instalação local não declara publicação/aprovação.
