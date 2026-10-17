# Contratos do catálogo

A matriz [tool-matrix.md](tool-matrix.md) contém cada tool, operação, hints,
transporte e justificativa. A política é explícita e exaustiva por nome;
adicionar uma tool sem classificá-la falha no TypeScript e nos testes.
Regere com `npm run build && node scripts/catalog-matrix.mjs`; a opção
`--check` compara a documentação com os contratos.

readOnly considera todos os modos aceitos pela tool: uma importação com dry-run
também pode gravar e por isso não é classificada como leitura. Atualizações,
substituições, movimentações, arquivamentos e exclusões são marcados como
potencialmente destrutivos. Criar registros e acrescentar evidência preserva
conteúdo existente. Configurar/ativar monitores recebe openWorld porque o
executor pode alcançar serviços externos ou executar scripts configurados.
Registrar uma publicação na topologia apenas armazena evidência; não publica
artefatos nem executa deployment.

Os contratos e nomes existentes foram preservados. As três consultas
issues_search, issues_summary e issues_aggregate mantêm filtros adicionais
legados/dinâmicos, validados pela API; fechar esses objetos romperia filtros
suportados. Demais objetos de entrada são fechados. Schemas internos de
amostras/metadados e mapas de tags permanecem extensíveis quando o domínio exige.
Os limites de listas/paginação e campos obrigatórios existentes continuam no
catálogo, com validação antes do dispatch e na API. O transporte HTTP acrescenta
limite de corpo de 16 MiB; anexos/base64 têm limite próprio e não se tornam
paths no servidor.

issues_analyze_eml_file e issues_import_eml_file usam diretórios locais aprovados
e permanecem no stdio. HTTP não anuncia essas duas tools e rejeita sua execução
antes de acessar arquivos, mesmo se o nome for informado diretamente.
issues_import_eml e anexos em base64 continuam disponíveis remotamente.
OAuth continua sujeito ao workspace consentido e às permissões atuais na API.

Instructions do handshake orientam contexto, escrita solicitada e leitura de
resources. O cliente SDK oficial testa resources e links nas duas eras do
protocolo. Comportamento no ChatGPT real depende da validação P16; não houve
remoção de resources nem substituição por ferramentas redundantes sem evidência.
