/**
 * "No text typed straight into a component", as a ratchet. Run with:
 *
 *   bun run i18n:literals            check (what CI runs)
 *   bun run i18n:literals --update   rewrite the baseline after translating files
 *
 * It counts, per component file (src/**\/*.tsx), the pieces of user-facing text typed
 * directly in JSX: element text and the placeholder / title / aria-label / alt / label /
 * description / hint / subtitle / tooltip attributes (the rule and its options are in
 * eslint.config.mjs). The counts are compared with scripts/i18n-literals-baseline.json:
 *
 *  - a file may never have MORE such text than the baseline allows (a file that is not in
 *    the baseline allows none), so new development cannot add English to the interface;
 *  - files already migrated (the TRANSLATED list in eslint.config.mjs) are at zero and are
 *    also enforced by plain `eslint`;
 *  - translating text lowers a count: run `--update` and commit the smaller baseline, so
 *    the ratchet only ever tightens.
 *
 * What it cannot see: text outside JSX (arrays of labels in .ts files, strings built in
 * code, server-side messages). messages/CONVENTIONS.md covers those by convention.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ESLint, type Linter } from "eslint";
import { literalCensusConfig } from "../eslint.config.mjs";

const RULE = "i18next/no-literal-string";
const BASELINE = fileURLToPath(new URL("./i18n-literals-baseline.json", import.meta.url));
const ROOT = path.resolve(path.dirname(BASELINE), "..");
const MAX_LISTED = 12;

type Hit = { line: number; column: number; text: string };

/** File (repo-relative, forward slashes) → the text typed straight into it. */
async function census(): Promise<Map<string, Hit[]>> {
  const eslint = new ESLint({ cwd: ROOT, overrideConfig: literalCensusConfig as unknown as Linter.Config[] });
  const results = await eslint.lintFiles(["src/**/*.tsx"]);
  const found = new Map<string, Hit[]>();
  for (const result of results) {
    const hits = result.messages
      .filter((message) => message.ruleId === RULE)
      .map((message) => ({ line: message.line, column: message.column, text: message.message.replace(/^disallow literal string: /, "") }));
    if (hits.length > 0) found.set(path.relative(ROOT, result.filePath).split(path.sep).join("/"), hits);
  }
  return found;
}

const sum = (counts: Iterable<number>) => [...counts].reduce((total, n) => total + n, 0);
const github = process.env.GITHUB_ACTIONS === "true";

const found = await census();
const total = sum([...found.values()].map((hits) => hits.length));

if (process.argv.includes("--update")) {
  const counts = Object.fromEntries([...found].map(([file, hits]) => [file, hits.length] as const).sort(([a], [b]) => (a < b ? -1 : 1)));
  writeFileSync(BASELINE, `${JSON.stringify(counts, null, 2)}\n`);
  console.log(`Baseline written: ${found.size} component files still have ${total} pieces of text typed in JSX (${path.relative(ROOT, BASELINE)}).`);
  process.exit(0);
}

if (!existsSync(BASELINE)) {
  console.error(`Missing ${path.relative(ROOT, BASELINE)}. Run \`bun run i18n:literals --update\` once and commit it.`);
  process.exit(1);
}
const baseline = JSON.parse(readFileSync(BASELINE, "utf8")) as Record<string, number>;

const worse: string[] = [];
for (const [file, hits] of [...found].sort(([a], [b]) => (a < b ? -1 : 1))) {
  const allowed = baseline[file] ?? 0;
  if (hits.length <= allowed) continue;
  const why = allowed === 0 ? "text typed straight into a component that has none" : `${allowed} allowed by the baseline`;
  worse.push(`  ${file}: ${hits.length} found, ${why}`);
  for (const hit of hits.slice(0, MAX_LISTED)) worse.push(`      ${hit.line}:${hit.column}  ${hit.text.slice(0, 110)}`);
  if (hits.length > MAX_LISTED) worse.push(`      … and ${hits.length - MAX_LISTED} more`);
  if (github) console.log(`::error file=${file}::${hits.length} pieces of text typed straight into this component (${allowed} allowed). Put each in messages/en/<domain>.json and messages/pt-BR/<domain>.json and render it with t("key"): see messages/CONVENTIONS.md.`);
}

const better = Object.entries(baseline).filter(([file, allowed]) => (found.get(file)?.length ?? 0) < allowed);

console.log(`${total} pieces of text are still typed in ${found.size} component files (baseline allows ${sum(Object.values(baseline))}).`);

if (better.length > 0) {
  console.log(`\n${better.length} file(s) have less typed text than the baseline allows (translated, or removed). Run \`bun run i18n:literals --update\` and commit the smaller baseline so it cannot grow back:`);
  for (const [file, allowed] of better.slice(0, 20)) console.log(`  ${file}: ${allowed} → ${found.get(file)?.length ?? 0}`);
}

if (worse.length > 0) {
  console.error(`\nText was typed straight into components. The interface is translated through message keys, so write the text in messages/en/<domain>.json and messages/pt-BR/<domain>.json and render it with t("key") (messages/CONVENTIONS.md). A file may never have more typed text than the baseline allows:\n`);
  console.error(worse.join("\n"));
  process.exit(1);
}
console.log("\nOK: no new text typed straight into a component.");
