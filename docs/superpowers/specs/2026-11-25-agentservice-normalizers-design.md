# AgentService: normalizar nome, CNPJ e cargo (design curto)

## Intenção
Acrescentar ao grupo AgentService (enriquecimento das Planilhas) três itens ao lado de "Normalizar telefone":
normalizar nome, normalizar CNPJ e normalizar cargo. São funções puras, offline e sem custo de provedor.

## Abordagem
Um único caminho razoável: o molde do telefone. Cada item é uma ação em `src/lib/integrations/agentservice/definition.ts`,
um handler em `actions.ts` (chave `agentservice.<handler>`), uma função pura em `normalizers.ts` com teste em
`normalizers.test.ts`, e chaves nos dois idiomas em `messages/{en,pt-BR}/integrationsRegistry.json`. A coluna é de
enriquecimento com `handlerKey`; não há runner nem tipo de coluna novo. Descartado: tipo de coluna `functions` (indisponível
na UI) e fórmula (não teria validação nem saídas múltiplas).

## Itens
1. **Normalizar nome** — entrada: nome completo. Saídas: `firstName`, `lastName`. Reaproveita e unifica a lógica de
   `leads/records.ts` (`splitFullName`), `outreach/replyBridge.ts` e `whatsapp/campaigns/importMapping.ts`.
2. **Normalizar CNPJ** — entrada: CNPJ com ou sem máscara. Saídas: `cnpj` (só dígitos), `isValid` (14 dígitos, não
   repetido, dígitos verificadores corretos), `isHeadquarters` (matriz = verdadeiro quando o bloco de ordem, dígitos 9 a 12,
   é `0001`; filial = falso). Inválido: `cnpj` vazio, `isValid` falso, `isHeadquarters` vazio.
3. **Normalizar cargo** — entrada: cargo. Saída: `level`, em português e inglês, sem diferenciar acento ou maiúscula.
   Níveis, do mais alto ao mais baixo: C-level (CEO, CFO, presidente, sócio, fundador), VP, Diretor, Gerente,
   Coordenador/Supervisor, Analista/Especialista, Assistente/Estagiário, Não identificado. Cargo vazio devolve vazio.

## Metas
Saídas estáveis (valores de enum fixos no código, rótulo vem do catálogo); testes por função; textos nos dois idiomas;
CI `i18n` verde.

## Fora de escopo
Consulta de CNPJ em API externa (BrasilAPI e afins), campo de CNPJ em `companies`, classificação por IA, mudança de
coluna ou runner.

## Calls minhas (a conferir)
- Nome com prefixo ("Dr.") ou partícula ("da", "de") fica no sobrenome; sem tratamento especial além de aparar espaços.
- Cargo composto ("Diretor de Vendas e Gerente de Projetos") fica com o nível mais alto encontrado.
- Os valores de `level` são códigos estáveis em inglês (`c_level`, `vp`, `director`, `manager`, `coordinator`, `analyst`,
  `assistant`, `unknown`), com rótulo traduzido.
- Documentar os três itens em `docs/tables/agentservice.mdx`.
