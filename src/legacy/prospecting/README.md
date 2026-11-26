# Prospecting (legacy module): switched off, kept for reference

This folder holds the code of the old **Prospecting** module (domain browser plus
qualification campaigns). It was **switched off, not deleted**. Nothing here is
routed, imported or run by the app.

## What was done

| Step | PR | Change |
|---|---|---|
| Isolate | #25 | `normalizeDomainForTargeting` moved to `src/lib/leads/domain.ts` (the old path re-exports it) and the shared wizard parts moved to `src/components/wizard/wizardParts.tsx`, so no other module depends on the legacy code. |
| Switch off | #28 | The pages `/domains`, `/campaigns`, `/campaigns/[id]` and the API routes below were moved here with `git mv` (content unchanged, history preserved). They now answer 404. A new **Prospecting** item in the **Data** menu opens `/prospecting`, an under-construction page. |

Moved API routes: `apps/list`, `campaigns` (list, export, `[id]`, run, stop, stream, output, export),
`categories/counts`, `domains`, `debug-env`, `export`, `parent-pending`, `qualify`,
`targeted-domains/[domain]/parent`.

## What was NOT touched

- The database. The tables `campaigns` (qualification), `qualification_jobs`,
  `targeted_domains` and the global `clean_domains` dataset still exist, and the
  tenancy registry still lists them.
- `src/lib/qualification/*`, `src/lib/queries.ts`, the components used only by this
  module (`components/campaigns/*`, `Filters`, `DomainsTable`, `CategoryFilter`,
  `AppFilter`, `ExportModal`, `TableSkeleton`, `TableLoadingOverlay`,
  `NavigationProvider`) and the qualification prompt. They stay in place, unused.
- Environment variables, Langfuse prompts and dependencies.
- The email, LinkedIn, WhatsApp and calling campaigns, which are separate modules.

## Decision

Deleting this code was planned (a "wave 4") and then **deliberately postponed**:
it is kept here, parked, until the new Prospecting area is built. Re-enable by
moving the files back under `src/app` (pages to `src/app/<name>`, routes to
`src/app/api/<name>`) and restoring the menu entries in
`src/components/nav/navConfig.ts`; the old `shell.nav.*` and `leads.domains.*`
messages are still in the catalogs.

## Rollback

`git revert` of PR #28 restores the old routes and menu.
