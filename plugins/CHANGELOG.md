# Plugin BIAWS

## 0.1.0-rc.1 — candidato local (CHATGPT-PLUGIN/P23)

- Conexão direta por instância em Streamable HTTP e OAuth CIMD/PKCE.
- Seis skills portáteis, autoria do repositório, licença Apache-2.0 e ícone
  existente da interface BIAWS.
- Build reproduzível e instalação offline verificados; a URL é uma entrada do
  build. O placeholder do source nunca deve ser distribuído como artefato final.
- Compatibilidade mínima em `compatibility.json`: plataforma 0.8.0, revisão 3, API 0.10.0,
  UI 0.8.0, MCP 0.15.0 e CLI 0.6.0. São versões preparadas localmente; consulte
  o registry antes de instalar pacotes por npm.

A versão é própria do plugin, independente do MCP, do CLI e da plataforma.
Não representa publicação, aprovação nem instalação no catálogo. Builds com
loopback são evidência técnica local e não são artefatos para submissão.
O pacote definitivo exige endpoint HTTPS real da instância, validação ChatGPT
e revisão das condições de distribuição. O suporte público a URLs variáveis
de clientes depende da elegibilidade confirmada pela OpenAI.
