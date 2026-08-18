# Taxonomia de comandos do BIAWS CLI

O executável `biaws` organiza os comandos em três contextos canônicos:

- `biaws instance ...`: administração local de instâncias. Não exige API key.
- `biaws configure ...`: configuração de projeto, Codex, Claude e skills.
- `biaws api ...`: leitura e escrita autenticadas em recursos do BIAWS.

Durante a migração, `skills`, `agent` e `monitoring` continuam disponíveis como
rotas de compatibilidade. Seus argumentos e opções são encaminhados às
implementações existentes; a substituição por comandos oclif específicos será
feita incrementalmente.

## Convenções

- nomes de comandos e flags usam kebab-case;
- ajuda e versão são fornecidas pelo oclif;
- erros de uso retornam código 2 e falhas operacionais retornam código 1;
- `--json` reserva stdout para JSON e envia diagnósticos para stderr;
- aliases `get` e `set` só serão adicionados quando não reduzirem a descoberta;
- rotas antigas devem emitir depreciação antes de serem removidas.

## Árvore planejada

```text
biaws
├── instance setup|list|show|status|start|stop|backup|restore|remove
├── configure codex|claude|skills|doctor
├── workspaces list|get
├── applications list|get
├── demands list|get|tasks|task-status|complete-task
├── issues list|get|transition
├── skills ...       (compatibilidade)
├── agent ...        (compatibilidade)
└── monitoring ...   (compatibilidade)
```
