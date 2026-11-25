# AgentService normalizers (name, CNPJ, job title) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add three AgentService enrichment actions (normalize name, normalize CNPJ, normalize job title) next to "Normalize phone".

**Architecture:** Same mold as the phone action. A pure function in `normalizers.ts`, a handler in `actions.ts` (`agentservice.<handler>`), an `action({...})` entry in `definition.ts`, names and descriptions in both `integrationsRegistry.json` catalogs, a section in `docs/tables/agentservice.mdx`. No new runner, no new column type, no database change.

**Tech Stack:** TypeScript, bun test, next-intl catalogs.

**Spec:** `docs/superpowers/specs/2026-11-25-agentservice-normalizers-design.md`

## Global Constraints

- Files live in `src/lib/integrations/agentservice/` (`normalizers.ts`, `normalizers.test.ts`, `actions.ts`, `definition.ts`). Run from this worktree: `/root/dev/agentsdr/worktrees/agentservice-normalizers`.
- Pure functions, no I/O, no cost: handlers return through the existing `finish()` in `actions.ts`.
- Action keys: `normalize-name`, `normalize-cnpj`, `normalize-job-title`. Handler names: `normalizeName`, `normalizeCnpj`, `normalizeJobTitle` (handlerKey `agentservice.<handler>`).
- Every input needs `allowEmpty: true` (`definition.test.ts` enforces it).
- Level codes, exactly: `c_level`, `vp`, `director`, `manager`, `coordinator`, `analyst`, `assistant`, `unknown`. Empty title returns `null`.
- Text in catalogs under `agentservice.actions.<key>` in `messages/en/integrationsRegistry.json` and `messages/pt-BR/integrationsRegistry.json`: same path and order, same keys as the `definition.ts` entry (name, description, inputs.<key>.name/description, outputs.<key>.name). pt-BR must not equal the English text (more than two words).
- Do not edit `src/lib/leads/records.ts` or the other two name splitters; the normalizer is new code in `normalizers.ts`.
- Check command (per project CLAUDE.md, one at a time, never during a `docker build`):
  `docker run --rm -v "$PWD":/app -w /app oven/bun:1.3.14-alpine sh -c 'bun install --frozen-lockfile && <command>'`
- Commits: git user `fabicarvano <fabio.carvano@gmail.com>`, branch `feat/agentservice-normalizers`, end the message with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`. No push.

## Review Focus

- A spreadsheet import turns `01.234.567/0001-95` typed as a number into `1234567000195` (leading zero lost): a numeric cell shorter than 14 digits is left-padded with zeros before validating; a text cell is not.
- `11111111111111` and the other repeated-digit CNPJs pass the checksum but are invalid.
- "Assistente de Diretoria" and "Executive Assistant" are `assistant`, never `director`/`c_level`.
- "Vice-presidente" and "Vice President" are `vp`, never `c_level`; "Diretoria" alone is not a director word.
- A name with extra spaces, a single word, or only blanks: single word gives `lastName: null`; blank gives both `null`.

---

### Task 1: Normalize name

**Files:**
- Modify: `src/lib/integrations/agentservice/normalizers.ts` (append)
- Modify: `src/lib/integrations/agentservice/normalizers.test.ts` (append, add to the import)
- Modify: `src/lib/integrations/agentservice/actions.ts` (new handler, add to the import)
- Modify: `src/lib/integrations/agentservice/definition.ts` (new `action({...})` at the end of `actions`)
- Modify: `messages/en/integrationsRegistry.json`, `messages/pt-BR/integrationsRegistry.json`
- Modify: `docs/tables/agentservice.mdx`

**Interfaces:**
- Produces: `normalizeNameCell(raw: string): NameCellResult` with `type NameCellResult = { firstName: string | null; lastName: string | null }`; handler `agentservice.normalizeName`; action input key `name`, outputs `firstName`, `lastName`.

- [ ] **Step 1: Write the failing tests** in a `describe("normalizeNameCell")` block:
  - `normalizeNameCell("Ada Lovelace")` toEqual `{ firstName: "Ada", lastName: "Lovelace" }`
  - `normalizeNameCell("  Maria   da  Silva ")` toEqual `{ firstName: "Maria", lastName: "da Silva" }`
  - `normalizeNameCell("Madonna")` toEqual `{ firstName: "Madonna", lastName: null }`
  - `normalizeNameCell("   ")` and `normalizeNameCell("")` toEqual `{ firstName: null, lastName: null }`
  - `normalizeNameCell("Dr. João de Souza")` toEqual `{ firstName: "Dr.", lastName: "João de Souza" }` (documents the spec call: no prefix handling)
- [ ] **Step 2: Run** `bun test --conditions=react-server src/lib/integrations/agentservice/normalizers.test.ts` (inside the docker command). Expected: FAIL, `normalizeNameCell` not exported.
- [ ] **Step 3: Implement** `normalizeNameCell` in `normalizers.ts`: trim, split on `/\s+/`, first token is `firstName`, the rest joined by one space is `lastName`; empty parts become `null`.
- [ ] **Step 4: Add the action and handler.** `definition.ts`: key `normalize-name`, name "Normalize name", handler `normalizeName`, tags `["name", "first name", "last name", "split"]`, input `name` (valueType `text`, acceptedColumnTypes `["text"]`, required true, allowEmpty true, example "Maria da Silva"), outputs `firstName` ("First Name", text, example "Maria") and `lastName` ("Last Name", text, example "da Silva"). `actions.ts`: `"agentservice.normalizeName"` reads `context.inputs.name`, calls `normalizeNameCell`, returns `finish(context, result.firstName, result, started)`.
- [ ] **Step 5: Catalogs and docs.** Add `normalize-name` in the same position in both `integrationsRegistry.json` files (pt-BR: "Normalizar nome", description in Portuguese, outputs "Nome" / "Sobrenome"); add a `### Normalize name` section after "Normalize LinkedIn profile" in `docs/tables/agentservice.mdx`, in the style of its neighbours.
- [ ] **Step 6: Run** the AgentService tests plus `bun test --conditions=react-server src/i18n`. Expected: all PASS.
- [ ] **Step 7: Commit** `feat(agentservice): add normalize name action`.

---

### Task 2: Normalize CNPJ

**Files:** same six as Task 1 (new function appended to `normalizers.ts`, tests appended to `normalizers.test.ts`).

**Interfaces:**
- Produces: `normalizeCnpjCell(raw: string | number): CnpjCellResult` with `type CnpjCellResult = { cnpj: string | null; isValid: boolean; isHeadquarters: boolean | null }`; handler `agentservice.normalizeCnpj`; action input key `cnpj` (acceptedColumnTypes `["text", "number"]`, valueType `textOrNumber`, like the phone input), outputs `cnpj`, `isValid`, `isHeadquarters`.

- [ ] **Step 1: Write the failing tests** in `describe("normalizeCnpjCell")`, using the valid headquarters CNPJ `11.222.333/0001-81` and the valid branch CNPJ `11.222.333/0002-62`:
  - masked headquarters: toEqual `{ cnpj: "11222333000181", isValid: true, isHeadquarters: true }`
  - masked branch: toEqual `{ cnpj: "11222333000262", isValid: true, isHeadquarters: false }`
  - plain digits string `"11222333000181"` gives the same as the masked one
  - wrong check digit `"11.222.333/0001-80"`: toEqual `{ cnpj: null, isValid: false, isHeadquarters: null }`
  - repeated digits `"11111111111111"`: invalid, same shape as above
  - wrong length `"1122233300018"` as a string: invalid
  - number `191` (leading zeros lost by the spreadsheet) gives `{ cnpj: "00000000000191", isValid: true, isHeadquarters: true }`; the same value as the string `"191"` is invalid
  - `"00.000.000/0002-72"` is valid, `cnpj: "00000000000272"`, `isHeadquarters: false`
  - empty string and `"abc"`: invalid
  (check digits of all valid fixtures above were computed with the modulo-11 algorithm below)
- [ ] **Step 2: Run** the test file. Expected: FAIL, function not exported.
- [ ] **Step 3: Implement** `normalizeCnpjCell`: a number input is converted to digits and left-padded with zeros to 14; a string input is reduced to its digits and not padded. Valid means exactly 14 digits, not all the same digit, and both check digits correct (standard modulo-11 with weights `5,4,3,2,9,8,7,6,5,4,3,2` and `6,5,4,3,2,9,8,7,6,5,4,3,2`). `isHeadquarters` is `true` when digits 9 to 12 are `0001`, `false` otherwise, `null` when invalid. Invalid returns `cnpj: null`. Letters are not supported (invalid); mention it in the docs section.
- [ ] **Step 4: Add the action and handler.** key `normalize-cnpj`, name "Normalize CNPJ", handler `normalizeCnpj`, tags `["cnpj", "company", "brazil", "headquarters", "branch"]`, input example "11.222.333/0001-81", outputs `cnpj` ("Normalized CNPJ", text, example "11222333000181"), `isValid` ("Valid CNPJ", boolean), `isHeadquarters` ("Headquarters", boolean). Handler: `finish(context, result.cnpj, result, started)`.
- [ ] **Step 5: Catalogs and docs.** pt-BR names: "Normalizar CNPJ", "CNPJ normalizado", "CNPJ válido", "Matriz". Docs section `### Normalize CNPJ`: digits only, valid or not, headquarters true/false, the numeric-cell padding rule and that letters are unsupported.
- [ ] **Step 6: Run** AgentService tests plus `src/i18n`. Expected: PASS.
- [ ] **Step 7: Commit** `feat(agentservice): add normalize CNPJ action`.

---

### Task 3: Normalize job title

**Files:** same six as Task 1.

**Interfaces:**
- Produces: `type JobLevel = "c_level" | "vp" | "director" | "manager" | "coordinator" | "analyst" | "assistant" | "unknown"`; `normalizeJobTitleCell(raw: string): { level: JobLevel | null }`; handler `agentservice.normalizeJobTitle`; action input key `title` (text), output `level`.

- [ ] **Step 1: Write the failing tests** in `describe("normalizeJobTitleCell")`, table-driven (`[title, level]`):
  - c_level: "CEO", "Diretor Presidente", "Sócio", "Founder", "Chief Revenue Officer", "Fundadora", "Presidente"
  - vp: "Vice-presidente de Vendas", "VP of Sales", "Vice President", "SVP Marketing"
  - director: "Diretor Comercial", "DIRETORA DE MARKETING", "Sales Director", "Head of Growth"
  - manager: "Gerente de Contas", "Product Manager", "gerente"
  - coordinator: "Coordenador de TI", "Supervisor de Vendas", "Líder de Equipe"
  - analyst: "Analista de Marketing", "Business Analyst", "Especialista em CRM"
  - assistant: "Assistente de Diretoria", "Executive Assistant", "Estagiário de Vendas", "Auxiliar Administrativo", "Assistente de Gerente"
  - highest wins: "Gerente e Analista" gives `manager`; "Sócio-diretor" gives `c_level`
  - unknown: "Consultor de Vendas", "Product Owner", "Lead Developer"
  - empty or blank string gives `{ level: null }`
  - word boundaries: "Gerenciamento de Projetos" is `unknown`, "Diretoria" alone is `unknown`
  - accents and case are ignored ("SÓCIO" and "socio" both `c_level`)
- [ ] **Step 2: Run** the test file. Expected: FAIL, function not exported.
- [ ] **Step 3: Implement** in `normalizers.ts` with a small rules table (level plus keyword regexes), checked in this order on the title lowercased and stripped of accents: (1) assistant words (`assistente`, `assistant`, `estagiari[oa]`, `intern`, `trainee`, `auxiliar`) return `assistant` immediately; (2) match `vp` words (`vice[- ]?president[e]?`, `vp`, `svp`, `evp`) and remove them from the text; (3) among the remaining text, return the highest level whose whole-word keywords match, in this order: `c_level` (`ceo cfo cto coo cmo cio chief presidente president socio fundador fundadora founder cofundador dono proprietario`), `director` (`diretor diretora director head`), `manager` (`gerente manager`), `coordinator` (`coordenador coordenadora coordinator supervisor supervisora lider`), `analyst` (`analista analyst especialista specialist`); (4) if step 2 matched and nothing higher matched, `vp`; (5) otherwise `unknown`. Whole-word means a `\b`-style boundary on the stripped text, so "gerenciamento" and "diretoria" do not match. Note the deliberate omissions in a comment (`owner`, `partner`, `lead` collide with product titles and the Lead entity). Blank input returns `{ level: null }`.
- [ ] **Step 4: Add the action and handler.** key `normalize-job-title`, name "Normalize job title", handler `normalizeJobTitle`, tags `["job title", "seniority", "level", "role", "cargo"]`, input `title` ("Job Title", text, acceptedColumnTypes `["text"]`, example "Gerente de Vendas"), output `level` ("Seniority Level", text, example "manager"). Handler: `finish(context, result.level, result, started)`.
- [ ] **Step 5: Catalogs and docs.** pt-BR: "Normalizar cargo", output "Nível hierárquico". Docs section `### Normalize job title`: the eight codes, the highest-level rule, the assistant rule, the omissions. State that the cell holds the stable English code, not a translated label.
- [ ] **Step 6: Run** AgentService tests plus `src/i18n`. Expected: PASS.
- [ ] **Step 7: Commit** `feat(agentservice): add normalize job title action`.

---

### Task 4: Gate

**Files:** none new (fixes only if the gate fails).

- [ ] **Step 1: Run the full gate** with the project command (docker, one at a time): `bunx tsc --noEmit && bun test --conditions=react-server src/i18n src/lib/integrations src/lib/grid && bunx eslint && bun run i18n:literals`. Expected: tsc 0 errors, tests all PASS, eslint clean, literals not above baseline.
- [ ] **Step 2: Run the whole suite** `bun run test`. Expected: 0 failures. Report any failure with its exact output; fix only what these changes caused.
- [ ] **Step 3: Update** the "Calls" line of the design doc about the translated label: the level is stored as a stable code and only the action's output name is translated. Commit `docs: align normalizers design with level codes`.
