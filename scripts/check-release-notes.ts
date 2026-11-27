/**
 * Release guard for the "What's new" pop-up. Not a migration: it reads
 * content/releases.json and package.json and touches no database.
 *
 *   bun scripts/check-release-notes.ts                    the rule every commit keeps
 *   bun scripts/check-release-notes.ts --release v0.5.1   what a version tag must satisfy
 *
 * With --release it fails when the first entry is still the open one
 * ("placeholder": true), when its version is not the package.json version, or
 * when the tag is not that version. docker.yml runs it before publishing the
 * image. The rules are in src/lib/releases/readiness.ts.
 */
import packageJson from "../package.json";
import releases from "../content/releases.json";
import { releaseNotesProblems } from "../src/lib/releases/readiness";

// Accepts `--release vX.Y.Z` and `--release=vX.Y.Z`; anything else is a mistake, not development mode.
const args = process.argv.slice(2);
let tag: string | null = null;
for (let i = 0; i < args.length; i += 1) {
  const arg = args[i];
  if (arg === "--release") {
    tag = args[i + 1] ?? "";
    i += 1;
  } else if (arg.startsWith("--release=")) {
    tag = arg.slice("--release=".length);
  } else {
    console.error(`release notes: unknown argument "${arg}"`);
    process.exit(1);
  }
}

const problems = releaseNotesProblems(releases[0] ?? null, packageJson.version, tag === null ? "development" : "release");
if (tag !== null && tag !== `v${packageJson.version}`) {
  problems.push(`The tag is "${tag}", but package.json is ${packageJson.version} (expected v${packageJson.version}).`);
}

if (problems.length > 0) {
  for (const problem of problems) console.error(`release notes: ${problem}`);
  process.exit(1);
}
console.log(`release notes: ok (${releases[0]?.version}${tag === null ? "" : `, ${tag}`})`);
