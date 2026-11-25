/**
 * The names an enrichment gives the columns it creates. They are stored as the
 * person's own data (like the default names in defaultNames.ts): written once,
 * in the interface language of whoever creates them, and never translated again.
 * Anything the catalog does not have is left out, so the English name of the
 * integration definition stays.
 */
export type EnrichmentNames = {
  action?: string;
  outputs?: Record<string, string>;
};

/** The `integrationsRegistry` translator (next-intl), narrowed to what is used here. */
export type NameLookup = ((key: string) => string) & { has: (key: string) => boolean };

export function enrichmentNamesFrom(
  t: NameLookup,
  integrationKey: string,
  action: { key: string; outputs: Array<{ key: string }> },
): EnrichmentNames {
  const base = `${integrationKey}.actions.${action.key}`;
  const names: EnrichmentNames = { outputs: {} };
  if (t.has(`${base}.name`)) names.action = t(`${base}.name`);
  for (const output of action.outputs) {
    const key = `${base}.outputs.${output.key}.name`;
    if (t.has(key)) names.outputs![output.key] = t(key);
  }
  return names;
}
