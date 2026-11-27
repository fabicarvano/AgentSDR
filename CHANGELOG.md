# Changelog

All notable changes to AgentSDR are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and the project uses [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
Each release lists the database migrations it needs; see
[docs/maintainers/releasing.md](docs/maintainers/releasing.md).

## [Unreleased]

## [0.5.1] - 2026-11-27

Upgrading from 0.5.0 needs one database migration, for the "What's new"
pop-up (see Migrations).

### Added

- **AgentService: free actions in Tables.** An internal integration whose
  actions run inside AgentSDR, with no account and no credits: normalize
  phone (E.164, valid, mobile, and a second number when the cell holds two),
  normalize email (cleaned address, valid, personal mailbox), domain from a
  website, company domain from an email, and normalize LinkedIn profile. A
  value that cannot be cleaned answers Valid = no instead of failing the row.
  A phone number typed without `+` is read as Brazilian when the organization
  has no default phone country.
- **AgentService: name, CNPJ and job title.** Normalize name gives each name
  its own column (First Name, Name 2 to Name 6, Last Name), dropping
  particles (da, de, dos, van, ...) and leading titles (Dr., Sra., ...).
  Normalize CNPJ keeps the digits, validates the check digits and says whether
  it is the head office. Normalize job title gives the level in Portuguese
  (C-level, VP, Diretor, Gerente, ...) and a stable code (`c_level`, `vp`,
  `director`, ...) in a column of its own.
- **Prospecting page.** A Prospecting item in the Data section of the menu
  opens `/prospecting`, still under construction.
- **AgentService has its own icon** in the table: the AgentSDR tile.
- **"What's new" pop-up at sign-in.** When the newest entry in
  `content/releases.json` differs from the version a person last dismissed,
  a pop-up lists the release notes in the interface language (English or
  Brazilian Portuguese). Closing it without ticking "Don't show this again" stores
  nothing, so it returns at the next sign-in; ticking it and closing stores
  the version for that person only (table `user_release_dismissals`). A new
  entry in the file shows the pop-up again to everyone. The pop-up version is
  the first entry of the file. API: `GET /api/releases/current` and
  `POST /api/releases/dismiss` (answers 409 if the version is not the current
  one).
- **Release notes are written as changes merge, and a release cannot ship
  without them.** The first entry of `content/releases.json` is the open
  entry of the next version (`"placeholder": true`) and pull requests add to
  it; the release removes the mark. The tests keep that entry in step with
  `package.json`, and a version tag whose entry is still open, or is for
  another version, fails before the image is published
  (`bun scripts/check-release-notes.ts --release vX.Y.Z`).

### Changed

- **The old Prospecting module is switched off.** `/domains`, the prospecting
  `/campaigns` pages and the module's API routes answer 404. The code moved to
  `src/legacy/prospecting` unchanged and no table was touched. Email,
  LinkedIn, WhatsApp and calling campaigns are not affected.
- **Enrichment columns are named in the creator's language.** The action
  column and each output take their names from the interface language of the
  person creating them. Column keys and existing columns do not change.
- **A manual run that queues nothing says so.** The table shows a notice that
  the rows were blank, already filled or missing what the column needs.

### Fixed

- **Free actions run on blank cells.** An AgentService action now runs when
  its input is blank, both automatically and when run by hand, so clearing a
  value also clears its old result. Paid integrations still wait for every
  required input, so no credits are spent on blank rows.
- **The pop-up's migration is in the Docker image.**
  `scripts/add-user-release-dismissals.ts` was missing from the image, so the
  Docker Compose command below failed.

### Migrations

- `bun scripts/add-user-release-dismissals.ts` creates the table
  `user_release_dismissals` (one row per user, with the dismissed version).
  With Docker Compose:
  `docker compose exec app agentsdr-entrypoint bun scripts/add-user-release-dismissals.ts`.
  It is additive and safe to run again. A fresh install gets the table
  automatically. Back up the database and run it before starting the new
  version. Without the table only the pop-up fails (sign-in and the rest of
  the app keep working), but the pop-up cannot work until it exists, so run
  it anyway.

## [0.5.0] - 2026-11-24

Upgrading from 0.4.0 needs no database migration. The only script added
since 0.4.0 is optional (see 0.4.1, Removed). This release also includes everything
listed under 0.4.1, which was never tagged.

### Added

- **Brazilian Portuguese interface, complete.** Sheets (Tables), LinkedIn,
  WhatsApp, AI calling and the server messages are translated, so every
  screen now reads in the language chosen in Settings, Appearance. Error
  messages from the API carry a code and appear in the interface language,
  including import errors and a failed request with no message.
- **Names created for you follow the creator's language.** A new column,
  table, workbook or folder is named "Nova coluna", "Planilha N", "Pasta de
  trabalho sem título" or "Pasta sem título" for someone using Portuguese, and
  "New Column", "Table N", "Untitled workbook" or "Untitled folder" for
  someone using English. Names already stored are not changed.

### Changed

- **Portuguese vocabulary.** Pipeline is now "Funil" (with a funnel icon),
  Tables is "Planilhas", and the LinkedIn Search feature is "Pesquisa". The
  English interface is unchanged.
- Errors raised by integrations (Unipile, OpenRouter, Gmail) and by the AI
  calling and WhatsApp servers stay in English on purpose.

### Removed

- The unused English CRM stage and category labels in the code. No screen
  changes.

## [0.4.1] - 2026-11-24

### Removed

- **Email validation.** AgentSDR no longer sends a validation email to every
  new person, and the `/api/webhooks/resend` endpoint, the Reach column's
  validation status and the `EMAIL_VALIDATION_*` and `RESEND_WEBHOOK_SECRET`
  settings are gone. Migration: `bun run scripts/drop-email-validations.ts`
  (drops `email_validations`; export it first if you want the results).
  You can delete the webhook you created in Resend.

## [0.4.0] - 2026-11-19

### Added

- **AI assistants (MCP), 2026-11-13.** AgentSDR is an MCP server at
  `/api/mcp`. Connect Claude (web and desktop), Claude Code, Cursor or any
  MCP client and work **CRM, Action required** from a chat: read the queue and
  records, review, edit and send drafts, correct classifications, move
  stages, snooze, close and set Do Not Contact. Each connection carries its
  own permissions (`crm:read`, `crm:write`, `crm:send`), actions are recorded
  as "name via AI assistant", and **Settings, AI assistants** shows the server
  URL, setup steps and each person's connections with Disconnect. API keys now
  have permissions too (`campaigns:read`, `campaigns:write`, and the CRM
  ones); keys created earlier keep full access. See `docs/mcp.mdx`.
- **Public API with API keys.** Owners and admins create keys in Settings,
  API keys; another application uses one to list email campaigns
  (`GET /api/v1/campaigns`), add leads to a campaign
  (`POST /api/v1/campaigns/:id/leads`, the same duplicate and suppression
  rules as a sheet import) and stop a lead's sequence without suppressing
  them (`POST /api/v1/campaigns/:id/leads/stop`). See `docs/api.mdx`.
- **Brazilian Portuguese interface (next-intl).** English and Brazilian
  Portuguese, per-domain catalogs and a lint guard that fails on text typed
  straight into components. Translated so far: sign-in and sign-up, the app
  shell and menu, Settings, Analytics, Leads, Domains, the CRM (pipeline,
  Action required queue, sequences, record page), the Inbox, and the email
  campaign screens (batches 0, A to E).
- **Email validation through Resend.** A new contact's address receives a
  short personal note and its delivery, bounce and open events are tracked
  through a signed webhook (`POST /api/webhooks/resend`). Addresses that
  Resend rejects are suppressed, sending is queued, and there is a daily
  limit. The People list shows the validation state in the Reach column.
- **AI calling.** AI call campaigns on their own page, call-backs that answer
  as the person who called, a fixed short calling prompt with the rest in the
  instructions, Knowledge documents read whole, audio relayed through
  AgentSDR instead of WebRTC, and prompts and traces kept in Langfuse
  (a per-organization integration).
- **CompanyEnrich** integration for company and people research, and an
  "Add from People" dialog that asks the server which people a channel can
  reach.
- **CRM follow-ups.** Out-of-office replies resume outreach instead of
  reaching Action required, and a "yes" that has not booked reaches Action
  required.

### Changed

- The repository is now independent: proprietary license, Portuguese README,
  and a manual workflow that builds the staging image.
- The brand font ships with the app instead of coming from Google Fonts, and
  booking links carry only a short code.

### Breaking

- New environment variables: `RESEND_WEBHOOK_SECRET`,
  `EMAIL_VALIDATION_FROM`, `EMAIL_VALIDATION_REPLY_TO`,
  `EMAIL_VALIDATION_DAILY_LIMIT` and `ACCESS_REQUEST_EMAIL`.
- A new webhook: point Resend at `/api/webhooks/resend`. If the public URL of
  the app changes, update the Gmail Pub/Sub push endpoint, the Google OAuth
  redirect URI, the Resend webhook and the Unipile webhooks, and reconnect
  AI assistant (MCP) clients.

### Migrations

Every script is additive and can be run again. Run them in this order:

1. `bun run scripts/create-calling-stations.ts`
2. `bun run scripts/add-cloak-launcher.ts`
3. `bun run scripts/create-calling-proxies.ts`
4. `bun run scripts/add-calling-station-linked-phone.ts`
5. `bun run scripts/add-calling-station-link-fresh.ts`
6. `bun run scripts/add-call-session-timeline.ts`
7. `bun run scripts/add-crm-auto-follow-ups.ts`
8. `bun run scripts/add-calling-station-lease.ts`
9. `bun run scripts/add-call-session-agent-persona.ts`
10. `bun run scripts/add-ai-calling-campaigns.ts`
11. `bun run scripts/add-ai-campaign-knowledge.ts`
12. `bun run scripts/add-crm-calling-instructions.ts`
13. `bun run scripts/add-ai-lead-instructions.ts`
14. `bun run scripts/add-call-session-direction.ts`
15. `bun run scripts/add-call-session-remote-rep.ts`
16. `bun run scripts/add-ai-booking-code.ts`
17. `bun run scripts/add-ai-meeting-at.ts`
18. `bun run scripts/create-api-keys.ts`
19. `bun run scripts/add-api-key-scopes.ts`
20. `bun run scripts/create-oauth-provider-tables.ts`
21. `bun run scripts/create-email-validations.ts`

Optional, only for installs that already use automatic follow-ups or Langfuse
prompts:

- `bun run scripts/queue-existing-crm-follow-ups.ts`
- `bun run scripts/repair-crm-stale-step-versions.ts`
- `bun run scripts/resume-out-of-office-backlog.ts`
- `bun run scripts/retry-crm-failed-classifications.ts`
- `bun run scripts/seed-langfuse-prompts.ts`

## [0.3.1] - 2026-10-08

### Fixed

- **`docker-compose.yml` names its release's image** (`0.3.1`) instead of
  `latest`. A server that had pulled an earlier `latest` kept running it with
  the new file: 0.2.0's image does not create the schema, so every query
  failed with `relation … does not exist`. Upgrade by downloading the new
  file; `AGENTSDR_VERSION` still overrides the tag.
- **First-run setup no longer loops.** On a fresh install the page bounced
  between `/sign-in` and `/setup` forever: the signed-in frame wrapped
  `/setup` and sent the session-less visitor to sign-in, which sent them back.
- **A rejected database password is explained at startup**: the bundled
  database keeps the password its volume was first created with, and the log
  now says so, with the two ways out.

## [0.3.0] - 2026-10-08

### Changed

- **Scheduled jobs run inside the app.** There is no cron container any more:
  Docker Compose is two containers, `db` and `app`. The jobs run in
  production only (never in `DEMO_MODE`); `INTERNAL_SCHEDULER=false` turns
  them off for an external cron, which calls the endpoints as before.
- **Database schema is created when the app starts.** The image creates it in
  an empty database before the server starts (there is no setup container). An
  existing database is only read, never changed. If this step fails the app
  does not start; `AGENTSDR_SKIP_DB_SETUP=true` skips it.
- **The daily rollover is per organization.** Each organization's email send
  queues, Gmail push watch renewal and LinkedIn daily-limit reset run at the
  start of its own day, set in Settings, Organization, Defaults (**Time zone**,
  default `UTC`, and **New day starts at**, default `00:00`). The first-run
  setup page stores the browser's time zone for the first organization.
- LinkedIn outreach now runs every 30 minutes, and the LinkedIn webhook replay
  every 10. The LinkedIn search queue is no longer scheduled: it runs when
  someone clicks Run.
- `CRON_SECRET` and `OUTREACH_TICK_SECRET` are optional: they are only needed
  to call the job endpoints from outside, and are no longer in
  `docker-compose.yml`. Unset, the endpoints refuse every secret call.
- The job endpoints skip work the in-app scheduler already did (organizations
  whose rollover ran today; a slot that already ran). `?force=1` skips that
  check.

### Fixed

- LinkedIn job logs: concurrent jobs no longer leave the console patched, so
  later lines landed in an old run's log. Log capture is now per run
  (`AsyncLocalStorage`).

### Migrations

- `bun scripts/create-scheduled-job-runs.ts` creates `scheduled_job_runs`,
  where each scheduled run is claimed. With Docker Compose:
  `docker compose exec app agentsdr-entrypoint bun scripts/create-scheduled-job-runs.ts`.
  A fresh install gets the table automatically. **Until the migration runs, no
  scheduled jobs run in-process** (the app logs a
  `[scheduler] Table scheduled_job_runs is missing` warning); the endpoints
  keep working.

**Upgrading a Docker Compose install from 0.2.0:**

1. Replace `docker-compose.yml` with the new one.
2. `docker compose up -d --remove-orphans` (removes the old `setup` and `cron`
   containers).
3. Run the migration above.

On Dokploy, nothing needs creating or scheduling any more; existing Schedule
Jobs are harmless and can be deleted. Keep `CRON_SECRET` and
`OUTREACH_TICK_SECRET` only if you keep calling the endpoints.

## [0.2.0] - 2026-10-08

**Upgrading a Docker Compose install from 0.1.0** (breaking): the new
`docker-compose.yml` no longer loads your whole `.env` into the containers;
it passes only the settings it lists by name. Before `docker compose up -d`:

1. Add `APP_URL=<your public address>` to `.env`. It replaces
   `BETTER_AUTH_URL` / `NEXT_PUBLIC_APP_URL`, which the new file does not
   read. Without it the app assumes `http://localhost:3000`.
2. Keep `POSTGRES_PASSWORD`, `BETTER_AUTH_SECRET`,
   `INTEGRATION_CREDENTIALS_KEY`, `UNSUBSCRIBE_SECRET`, `CRON_SECRET` and
   `OUTREACH_TICK_SECRET` in `.env` exactly as they are.
3. Any other variable you relied on (a `PAUSE_*` switch, worker tuning,
   Apollo) must be added to the `environment` block of `docker-compose.yml`.

### Added

- **First-run setup page.** On a fresh install every visitor is sent to
  `/setup`: one form (name, organization, email, password) creates the first
  admin, already verified, and their organization, then signs them in. No
  email service is needed to get started. The page closes for good once an
  account exists.
- **Copy-and-run Docker Compose.** `docker-compose.yml` runs the published
  image (`ghcr.io/fabicarvano/agentsdr`), with no repository checkout and no
  files to mount. Every setting is listed by name in the file; the ones to
  replace are marked `# CHANGEME` and can be edited in place or set in a
  `.env`. It starts as-is on `localhost`; on any other `APP_URL` it refuses
  to start while a secret still has its placeholder. The scheduler runs from
  the same image. `docker-compose.build.yml` builds from source instead.
  The Docker guide is rewritten as numbered steps.
- **Public demo.** `DEMO_MODE=true` turns a separate deployment into a
  read-only AgentSDR anyone can open without signing in, and
  `bun run db:seed:demo` now fills it with Northwind, a fictional company's
  three months of email, LinkedIn and WhatsApp outbound, calls with
  transcripts, a full CRM pipeline with AI drafts awaiting review, Tables and
  Analytics. See docs/self-hosting/demo.mdx.

### Changed

- **License: MIT** (was AGPL-3.0-only). Anyone may use, modify, self-host,
  distribute and sell AgentSDR, including in closed-source products and
  hosted services, as long as the copyright and license notice is kept.
- **Email recipients**: inbound Gmail keeps every To and Cc, replies can go
  to all, and a colleague's reply joins the lead's thread.
  `scripts/backfill-email-recipients.ts` (optional, dry run by default)
  restores recipients on messages stored before.
- **Tables**: about 70 fixes across columns, AI and enrichment runs and the
  grid.
- **The app is only the app.** The marketing website, blog theme and launch
  film moved to their own repository (agentsdr.ai). `/` now opens the
  workspace (sign-in first), and the app asks search engines not to index it.
- **Call recorder 0.15.0**: the built-in hosted address is now
  `https://app.agentsdr.ai`. Self-hosted addresses are still added on the
  extension's Options page.

## [0.1.0] - 2026-10-06

The first public release.

### Added

- **Accounts, organizations and teams** with Better Auth: email and
  password sign-up with verification, Google sign-in, password reset,
  invitations, owner / admin / member roles, an organization switcher.
  Sign-up is invite-only by default (`AUTH_SIGNUP=open` opens it); the first
  account on a fresh install can always be created.
- **Multi-tenancy**: every record belongs to an organization; an isolation
  test suite (`scripts/e2e/tenancy-isolation.ts`) proves one organization
  cannot see, change or count another's data.
- **Per-organization integrations** configured in Settings — Unipile
  (LinkedIn and WhatsApp), Google Workspace (Gmail), Cloudflare R2,
  OpenRouter — with credentials encrypted at rest.
- Lead database with custom fields, email outreach with sequences and
  mailbox rotation, LinkedIn campaigns and search, WhatsApp messaging and
  recorded calls, an AI-assisted CRM inbox with reply classification and
  drafted responses, Tables with enrichment providers.
- **Fresh installs**: `bun run db:setup` creates the schema in an empty
  database from `db/schema.sql`; `bun run db:seed:demo` adds a demo
  organization with fictional data.
- **Unipile webhooks register themselves**: saving the Unipile integration
  registers the LinkedIn and WhatsApp webhooks in your Unipile workspace,
  each carrying your organization and a generated secret.
- **Settings by channel**: Email, LinkedIn and WhatsApp each have their
  accounts, their Connection (the integration they run on) and their
  **Sending rules** — the limits that used to be hardcoded (emails a day and
  the gap between them, sending hours, LinkedIn invitations a day and per run,
  delays, search leads a day, WhatsApp warm-up, new chats a day, seconds
  between sends) — with today's values as defaults, hard ceilings and a
  warning past the safe edge. A LinkedIn account or WhatsApp number can set
  its own daily limit; the default phone country is per organization.
  `/settings/integrations` redirects to the new pages.
- **Call recorder Options page**: add your own AgentSDR address in the
  extension; a self-hosted deployment no longer needs its own build.
- Docker Compose self-hosting, CI, and the project's community documents,
  including [responsible use](docs/responsible-use.md).
- **Public website** at [agentsdr.ai](https://agentsdr.ai): product pages for
  each channel, the AI CRM and the data tools, solutions for founders,
  agencies and sales teams, comparisons, guides and this changelog, with a
  sitemap and structured data for search.

### Migrations

- Existing single-workspace installations: follow
  [docs/multi-tenancy/cutover.md](docs/multi-tenancy/cutover.md)
  (`scripts/create-auth-tables.ts`, `scripts/add-organization-scope.ts`,
  then `scripts/finalize-organization-scope.ts` after deploying).
- Sending rules: `bun run scripts/add-channel-settings.ts` (additive; run it
  before deploying). The `WHATSAPP_*` sending variables are no longer read —
  set those limits in Settings → WhatsApp → Sending rules.

[Unreleased]: https://github.com/fabicarvano/AgentSDR/compare/v0.5.1...HEAD
[0.5.1]: https://github.com/fabicarvano/AgentSDR/compare/v0.5.0...v0.5.1
[0.5.0]: https://github.com/fabicarvano/AgentSDR/compare/v0.4.0...v0.5.0
[0.4.0]: https://github.com/fabicarvano/AgentSDR/compare/v0.3.1...v0.4.0
[0.3.1]: https://github.com/fabicarvano/AgentSDR/compare/v0.3.0...v0.3.1
[0.3.0]: https://github.com/fabicarvano/AgentSDR/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/fabicarvano/AgentSDR/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/fabicarvano/AgentSDR/releases/tag/v0.1.0
