# Integração entre módulos

Esta suíte verifica contratos que dependem de mais de um módulo. Ela roda
separadamente das suítes internas da API e do MCP e possui um job próprio na CI.

Na raiz do repositório, com as dependências da API e do MCP instaladas:

```bash
node scripts/test-integration.mjs
```

O runner compila o MCP e carrega a API TypeScript com o `tsx` instalado na API.
Nenhum serviço ou banco de dados é necessário para esse inventário.

`resourceRoutesInventory.test.mjs` compara os endpoints do catálogo compilado
do MCP com as rotas GET registradas pela API. A dependência entre implementações
fica restrita a esta suíte; o build e os testes internos da API não importam nem
copiam o catálogo MCP. O teste detecta rotas ausentes, mas não valida respostas
HTTP, autenticação ou persistência, que possuem cobertura própria na API.

A unicidade das URIs anunciadas é verificada pela suíte de resources do MCP,
usando sua função de descoberta.
