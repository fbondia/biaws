# Plugin BIAWS

Pacote remoto portátil em `biaws/`, preparado para teste por instância.
Versão candidata `0.1.0-rc.1`; [histórico](CHANGELOG.md) e
[compatibilidade mínima](compatibility.json) são independentes da versão npm.
Identidade e licença vêm do repositório; autoria não comprova verificação do
publicador no portal. Nenhuma URL jurídica ou credencial foi inventada.

```sh
npm --prefix biaws-mcp ci
npm --prefix biaws-mcp run build
npm --prefix plugins ci
npm --prefix plugins test
npm --prefix plugins run build -- --url https://instancia.example/mcp --out /tmp/biaws-plugin
```

O build exige endpoint explícito. `--allow-loopback` libera HTTP local somente
para testes. Nunca distribua o source `mcp.json` com instance.invalid: o build
substitui o endpoint e rejeita esse placeholder no resultado.

O ZIP contém manifesto, mcp.json, seis skills, ícone PNG já usado pela UI e
licença Apache-2.0. Arquivos ordenados, timestamps fixos e ZIP sem compressão
produzem o mesmo SHA-256 em entradas idênticas. O relatório inclui inventário,
endpoint, versão e checksum. Não há scripts de instalação, hooks, .app.json,
dados de cliente, ambiente ou token. Arquivos extras/symlinks são rejeitados.
Os detectores de segredo são uma defesa adicional; não certificam ausência de
qualquer formato de segredo desconhecido.
O contrato BIAWS restringe o servidor a `streamable-http` e recusa headers
estáticos, inclusive Cookie e chaves com nomes arbitrários. Essa restrição vale
no build e na instalação; a autenticação deve vir do OAuth por usuário.

O pacote usa Agent Plugins 1.0.0 e a extensão OAuth CIMD descrita pela OpenAI.
**Diferença entre fontes:** o schema MCP 1.0.0 hoje omite extensions nas entradas
de servidor, embora a documentação OpenAI configure auth nesse campo.
O validador preserva os schemas oficiais sem alterações, valida a projeção do
núcleo e valida separadamente a extensão documentada. O relatório explicita
esse perfil; não alega validação integral pelo schema base. Revalidar no host
e antes de submissão. Schemas vendorizados em schemas/ permitem build offline.

Para instalação de teste, use o fluxo documentado de plugin/MCP personalizado
e siga a skill setup. Nenhuma conexão pessoal plugin_asdk_app é embutida.
A instalação real no ChatGPT e a acessibilidade externa são evidências de P16.
O portal público usa **With MCP**, com HTTPS e domínio verificáveis; um ZIP
não torna arbitrárias URLs de clientes elegíveis no catálogo. Não existe
endpoint universal nem gateway central neste escopo.

Referências oficiais consultadas em 2026-10-17:

- [Formato e autenticação](https://developers.openai.com/plugins/build/plugins)
- [OAuth](https://developers.openai.com/plugins/build/auth)
- [Schema plugin](https://agent-plugins.org/schemas/1.0.0/plugin.schema.json)
- [Schema MCP](https://agent-plugins.org/schemas/1.0.0/mcp.schema.json)
