---
name: biaws-discover-secret-inventory
description: Descobre nomes, escopos, consumidores e referências de segredos sem ler, copiar ou registrar seus valores, produzindo uma proposta segura de inventário para o BIAWS. Use ao mapear variáveis sensíveis, referências de Vault, secretKeyRef, CI/CD ou templates de ambiente e ao revisar cobertura e responsabilidades de segredos.
---

# Descobrir inventário de segredos

Mapeie a existência e o uso de segredos sem expor seu conteúdo. Este skill trabalha exclusivamente com metadados e referências.

## Regra inviolável

Nunca leia, revele, copie, transmita ou grave no BIAWS o valor de um segredo durante a descoberta. Não abra `.env`, arquivos de credenciais, chaves privadas, keychains ou valores de cofres e provedores de CI/CD.

Se um comando ou ferramenta puder exibir valores, não o execute. Se um valor sensível aparecer incidentalmente, não o reproduza na resposta nem em chamadas subsequentes.

## Fluxo obrigatório

1. Identifique o workspace e a aplicação de destino antes de qualquer escrita.
2. Consulte o inventário de metadados já existente pelas ferramentas MCP de domínio. Nunca acesse o banco diretamente.
3. Delimite fontes seguras e autorizadas: `.env.example`, schemas de configuração, documentação, manifests com referências, workflows que usam nomes de secrets e código que acessa variáveis por nome.
4. Ignore arquivos que possam conter valores reais, mesmo quando estiverem dentro do projeto.
5. Classifique cada referência e compare-a com o catálogo atual.
6. Apresente a proposta antes de escrever. Persista apenas metadados após solicitação ou aprovação explícita do usuário e releia o inventário alterado.

## Modelo do inventário proposto

Para cada referência, informe:

- nome ou identificador lógico;
- tipo provável, sem inferir o valor;
- aplicação, componentes, ambientes e consumidores observados;
- provedor ou mecanismo de armazenamento quando explicitamente referenciado;
- origem da evidência com arquivo e linha, quando possível;
- finalidade, proprietário e política de rotação somente quando documentados;
- correspondência existente e ação proposta;
- confiança e lacunas.

Separe configurações comuns de referências sensíveis. Em caso de dúvida, classifique como “revisar”, sem tentar acessar o conteúdo.

## Tratamento de achados perigosos

Ao detectar possível segredo hardcoded:

1. informe somente o tipo provável e a localização;
2. redija qualquer fragmento do valor;
3. recomende revogação ou rotação e remoção do histórico quando aplicável;
4. não tente validar a credencial;
5. não a registre como valor no BIAWS.

Uma solicitação posterior para armazenar um valor real exige o fluxo seguro específico de segredos, confirmação explícita e uma ferramenta que não exponha o valor em logs ou conversa. Interrompa se essas garantias não estiverem disponíveis.

## Limites de segurança

- Não use `printenv`, não leia ambientes de processos e não consulte valores em cloud, Vault ou CI/CD.
- Não faça busca ampla fora das fontes autorizadas.
- Não inclua padrões que imprimam linhas completas quando elas puderem conter valores; procure apenas nomes ou estruturas seguras.
- Não escreva no BIAWS durante uma solicitação de análise, diagnóstico ou proposta.

## Resultado esperado

Entregue a cobertura do inventário, referências encontradas, consumidores, duplicidades e lacunas. Após uma escrita aprovada, confirme somente os metadados registrados e preserve todos os valores fora da conversa e do relatório.
