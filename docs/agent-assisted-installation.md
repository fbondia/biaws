# Instalação assistida por um agente

Esta rota serve para Codex, Claude Code e outros agentes capazes de operar um
terminal local. O usuário fornece um único pedido e aprova as ações privilegiadas
quando solicitado; o agente executa os comandos e valida o resultado.

## Prompt pronto

Copie e envie este texto ao agente:

```text
Instale o Bondia Workspaces neste computador e conecte-o ao projeto atual.

Trabalhe de ponta a ponta: não me peça para copiar ou digitar comandos. Você pode
inspecionar o ambiente e executar operações locais reversíveis. Peça minha
aprovação antes de instalar pacotes, iniciar ou configurar serviços, usar
privilégios administrativos ou escrever fora do projeto e do diretório escolhido
para a instalação.

1. Detecte o sistema operacional e a arquitetura. No Windows, use exclusivamente
   WSL2 com uma distribuição Linux e integração do Docker Desktop; não tente
   executar o instalador por PowerShell, Prompt de Comando, Git Bash, MSYS2 ou
   Cygwin. Se WSL2 ou a integração ainda não existir, prepare o que puder, peça as
   aprovações necessárias e explique somente a interação de sistema que eu
   realmente precisar concluir.
2. Verifique Git, Bash, Node.js 20.19 ou superior (prefira Node.js 22 LTS), curl,
   OpenSSL, Docker e o plugin Docker Compose. Instale apenas o que estiver faltando,
   usando os canais oficiais indicados no QUICKSTART do repositório.
3. Clone https://github.com/fbondia/biaws.git em um diretório apropriado do usuário
   (por padrão ~/Source/biaws). Se ele já existir, preserve mudanças locais e apenas
   atualize quando isso for seguro. No WSL2, mantenha o clone e os dados no
   filesystem Linux, nunca em /mnt/c.
4. Leia README.md e QUICKSTART.md do clone antes de continuar. Execute
   ./scripts/check-prerequisites.sh --include-git e corrija os problemas encontrados.
5. Use o cliente de agente desta conversa (codex ou claude), derive um nome de
   instância válido a partir do projeto atual e execute ./scripts/setup-local.sh
   com --instance, --client e o caminho absoluto de --project. Use volumes
   Docker gerenciados, portas automáticas e dados de demonstração, salvo se o
   contexto do projeto indicar claramente outra escolha. Não transforme esta
   instalação local em um servidor compartilhado; essa é uma rota separada.
6. Não exiba nem copie a chave técnica do .env. Preserve os arquivos de credenciais
   fora do Git. Não desabilite controles de segurança e não use opções destrutivas.
7. Confirme o health check da API, a UI, os containers e o diagnóstico/handshake MCP.
   Se o cliente solicitar confiança no MCP local, mostre o caminho exato para eu
   aprovar.
8. Ao terminar, informe a URL da UI, a instância criada, onde ficou o clone, quais
   arquivos locais foram configurados e qualquer interação restante. Mostre a senha
   inicial somente se o próprio setup a tiver criado e instrua a trocá-la no primeiro
   acesso.

Se uma etapa falhar, investigue logs e tente alternativas seguras dentro desse
escopo. Pare apenas quando precisar de uma decisão minha, de uma aprovação que eu
recusei ou de uma interação inevitável do sistema operacional.
```

## Limites da automação

O agente pode executar todo o fluxo no terminal, mas o sistema operacional ainda
pode exigir uma aprovação administrativa, reinicialização, primeiro acesso ao WSL2
ou abertura inicial do Docker Desktop. Essas interações não devem ser contornadas.

O prompt autoriza a instalação local do BIAWS; não autoriza publicação, exposição
na internet, remoção de dados, alteração de firewall ou uso de credenciais externas.
Para uma implantação compartilhada, siga [shared-server.md](shared-server.md) e
trate proxy, DNS, TLS e provisionamento de identidades como decisões explícitas.
