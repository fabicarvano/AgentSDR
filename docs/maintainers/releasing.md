# Releasing

## Versioning

AgentSDR follows [Semantic Versioning](https://semver.org). Releases are Git
tags of the form `vX.Y.Z` on `main`. While the major version is 0, minor
releases may include breaking changes; say so in the notes.

What counts as a breaking change for a self-hoster: a removed or renamed
environment variable, a required manual migration, a changed webhook URL, or a
change that requires reconnecting integrations.

## Changelog

`CHANGELOG.md` follows [Keep a Changelog](https://keepachangelog.com). Add
entries under `Unreleased` as changes merge (Added, Changed, Deprecated,
Removed, Fixed, Security). At release time, rename `Unreleased` to the version
and date and start a fresh `Unreleased` section.

## Container image

The `docker.yml` workflow builds the image from the `Dockerfile` on pull
requests (to prove it builds) and publishes it to
`ghcr.io/fabicarvano/agentsdr` when a `v*` tag is pushed. The tag `vX.Y.Z`
produces the matching image tag.

## Release checklist

1. **CI is green on `main`** (the `CI / required` check: typecheck, lint, tests,
   production build, recorder build, fresh-database setup and audit on
   PostgreSQL 16, 17 and 18).
2. **Migrations.** List every script added to `scripts/` since the last tag:
   `git log --diff-filter=A --name-only --format= vPREVIOUS..HEAD -- scripts/`.
   Each one that an existing install must run goes in the release notes, in
   order, with the command (`bun scripts/<name>.ts`).
3. **Schema snapshot.** `db/schema.sql` matches the migrated schema: apply the
   migrations to a scratch database, run `bun run db:schema:dump`, and confirm
   there is no diff. `bun run db:check` passes.
4. **Fresh install works.** On an empty database: `bun run db:setup`, then
   `bun run db:check`.
5. **Configuration changes.** Any new, renamed or removed environment variable
   is in `.env.example` and [../configuration.md](../configuration.md), and
   called out in the notes.
6. **Upgrade notes.** Anything an operator must do besides pulling and
   rebuilding (new scheduled job or endpoint, new webhook, key rotation) is written down
   in the release notes and in [../self-hosting.md](../self-hosting.md) if it is
   permanent.
7. **"What's new" notes.** Review the open entry at the top of
   `content/releases.json`, set its `date`, and remove `"placeholder": true`;
   its `version` is the one being released (see below).
8. **Changelog and version.** Update `CHANGELOG.md`; set `version` in
   `package.json`, and the same version as the image tag default in
   `docker-compose.yml` (`${AGENTSDR_VERSION:-X.Y.Z}`, also inlined in
   `docs/self-hosting/docker-compose.mdx`). CI fails if they differ.
9. **Tag.** `git tag vX.Y.Z && git push origin vX.Y.Z`. Confirm the Docker
   workflow publishes the image; it first runs
   `bun scripts/check-release-notes.ts --release vX.Y.Z` and stops if the
   notes are still open or are for another version.
10. **GitHub release.** Create a release from the tag, paste the changelog
   section, and add the migration list and upgrade notes at the top.

## "What's new" pop-up

The pop-up shown at sign-in reads `content/releases.json`, an array with the
newest release first. An entry has `version` (semver), `date` (`YYYY-MM-DD`),
`title` and `items` (each item has a `type` of `new`, `improvement` or `fix`,
and a `text`); `title` and every `text` need both `en` and `pt-BR`. Versions
must be unique and dates must not increase down the file;
`src/lib/releases/releases.test.ts` checks this and that both languages are
filled.

The notes are written as changes merge, not at release time:

- **Between releases** the first entry is the *open entry*: the next version,
  marked `"placeholder": true`. A pull request that changes something people
  will notice adds an item to it, in both languages, with its line under
  `Unreleased` in `CHANGELOG.md`. The first such pull request after a release
  creates the entry (next patch version; raise it later if the release turns
  out to be a minor one). Write for the person using the app: what they can
  now do, not how it was built.
- **The release** reviews the wording, sets the `date`, removes the mark and
  sets `package.json` to the same version.

`src/lib/releases/readiness.ts` holds the rule and the tests apply it on every
commit: the first entry is either the notes of the `package.json` version or
an open entry for a later one. A version tag accepts only the first, so an
open entry cannot be published.

A change of the first entry's version shows the pop-up again to everyone;
editing the text of the current entry does not. Staging builds show the open
entry as it stands.

The first release that ships the pop-up needs the migration
`scripts/add-user-release-dismissals.ts` (creates the table
`user_release_dismissals`). Run it before starting the new app version, after a
backup; see the Migrations list in `CHANGELOG.md`. Without the table only the
pop-up fails (sign-in keeps working), but run it anyway. Later releases only
need the new entry.

## Security fixes

Fix in a private advisory branch, release a patch version, then publish the
advisory. Follow `SECURITY.md`.
