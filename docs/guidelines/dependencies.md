# Dependências

O catálogo abaixo registra intenção arquitetural, não apenas o conteúdo atual de
`package.json`. Antes de adicionar uma biblioteca, confirme que a plataforma ou
uma dependência existente não cobre o caso.

## Stack preferencial

| Responsabilidade   | Solução atual                                         |
| ------------------ | ----------------------------------------------------- |
| runtime            | Node.js 20.19 ou superior; Node.js 22 LTS recomendado |
| módulos            | ES Modules                                            |
| HTTP               | Express                                               |
| autenticação       | Better Auth e plugin de API key                       |
| persistência       | driver oficial do MongoDB, sem ORM                    |
| validação de senha | Argon2 pelo pacote `@node-rs/argon2`                  |
| EML                | `mailparser`                                          |
| uploads HTTP       | `multer` com limites explícitos                       |
| UI                 | React e Vite                                          |
| ícones             | Lucide React                                          |
| gráficos           | Recharts                                              |
| topologia          | XYFlow                                                |
| testes             | `node:test` e `node:assert`                           |
| formatação         | Prettier                                              |
| execução local     | Docker Compose e scripts POSIX                        |

## Regras

1. Prefira APIs nativas do Node.js e do navegador para necessidades simples.
2. Não adicione duas bibliotecas com a mesma responsabilidade sem plano de
   consolidação.
3. Uma dependência de UI não deve vazar para modelos puros ou `shared/`.
4. Uma dependência exclusiva de desenvolvimento fica em `devDependencies`.
5. Fixe versões de componentes sensíveis à segurança ou compatibilidade quando
   atualização implícita representar risco; mantenha a estratégia atual do
   módulo.
6. Atualize `package-lock.json` somente pelo gerenciador de pacotes.
7. Nunca copie uma biblioteca para o repositório para contornar o processo de
   dependências.

## Avaliação de uma nova biblioteca

Registre no pull request:

- necessidade concreta e alternativas avaliadas;
- módulo consumidor e impacto no bundle/runtime;
- maturidade, licença e manutenção do pacote;
- superfície de segurança, especialmente parsing, uploads e execução de código;
- como será testada e removida se a decisão mudar.

Para uma função pequena e estável, código local claro costuma ser preferível a
uma dependência. Para protocolos, criptografia e formatos complexos, prefira uma
implementação mantida e especializada a uma solução própria.

## Atualizações

- execute os testes e o build do módulo afetado;
- revise notas de incompatibilidade e requisitos de runtime;
- execute `npm audit` conforme a política da CI;
- não aceite uma atualização apenas porque o lockfile foi gerado com sucesso;
- dependências de autenticação, upload, banco e build exigem atenção ao fluxo
  integrado, não apenas testes unitários.

O Dependabot cobre atualmente API, UI e GitHub Actions. Ao adicionar dependências
de runtime ao MCP ou CLI, avalie estender essa cobertura.
