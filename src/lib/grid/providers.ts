import { randomUUID } from "node:crypto";
import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { AGENTSERVICE_KEY, agentServiceConnectionIdFor } from "@/lib/integrations/agentservice/connection";
import { getIntegration, integrationKind } from "@/lib/integrations/catalog";
import {
  decryptIntegrationCredential,
  decryptIntegrationCredentials,
  encryptIntegrationCredentials,
} from "@/lib/integrations/credentials";
import { verifyIntegrationCredentials } from "@/lib/integrations/verification";
import { gridProviderCredentials, gridProviders, type GridProvider } from "./schema";
import { currentOrganizationId, inOrg } from "@/lib/tenancy/scope";

export type IntegrationConnection = {
  id: string;
  integrationKey: string;
  name: string;
  enabled: boolean;
  configured: boolean;
  verified: boolean;
};

type ProviderConfig = Record<string, unknown> & {
  integrationKey?: string;
  encryptedCredentials?: Record<string, string>;
  encryptedApiKey?: string;
  verification?: {
    status?: "verified";
    verifiedAt?: string;
  };
};

function toConnection(provider: GridProvider, hasCredentialRecord = false): IntegrationConnection {
  const config = provider.config as ProviderConfig;
  const integrationKey = String(config.integrationKey ?? "");
  const integration = getIntegration(integrationKey);
  const configured = Boolean(provider.enabled && integration && (
    hasCredentialRecord || integration.auth.fields.every((field) =>
      field.required ? config.encryptedCredentials?.[field.key] : true
    )
  ));
  return {
    id: provider.id,
    integrationKey,
    name: provider.name,
    enabled: provider.enabled,
    configured,
    verified: Boolean(configured && config.verification?.status === "verified"),
  };
}

/**
 * Functions (AgentService) run inside AgentSDR: there is no account, nothing to
 * list or connect. The runner still resolves every enrichment column through a
 * connection, so each organization has one virtual connection for them: always
 * enabled and verified, with no row in grid_providers and no credentials.
 *
 * Its id is derived from the organization (see connection.ts), so an id copied
 * from another organization does not match. Everything this file knows about
 * it goes through the two functions below. They go away when functions get a
 * column type of their own that runs without a connection ("Option B").
 */
export function virtualConnectionFor(integrationKey: string): IntegrationConnection | null {
  if (integrationKey !== AGENTSERVICE_KEY) return null;
  return {
    id: agentServiceConnectionIdFor(currentOrganizationId()),
    integrationKey: AGENTSERVICE_KEY,
    name: "AgentService",
    enabled: true,
    configured: true,
    verified: true,
  };
}

function virtualConnectionById(id: string): IntegrationConnection | null {
  const connection = virtualConnectionFor(AGENTSERVICE_KEY);
  return connection?.id === id ? connection : null;
}

export async function listIntegrationConnections(integrationKey: string) {
  const rows = await db
    .select({ provider: gridProviders, credentialId: gridProviderCredentials.id })
    .from(gridProviders)
    .leftJoin(gridProviderCredentials, eq(gridProviderCredentials.providerId, gridProviders.id))
    .where(and(inOrg(gridProviders), sql`${gridProviders.config} ->> 'integrationKey' = ${integrationKey}`))
    .orderBy(desc(gridProviders.createdAt));
  return rows.map(({ provider, credentialId }) => toConnection(provider, Boolean(credentialId)));
}

export async function getIntegrationConnection(id: string) {
  const virtual = virtualConnectionById(id);
  if (virtual) return virtual;
  const [row] = await db
    .select({ provider: gridProviders, credentialId: gridProviderCredentials.id })
    .from(gridProviders)
    .leftJoin(gridProviderCredentials, eq(gridProviderCredentials.providerId, gridProviders.id))
    .where(and(inOrg(gridProviders), eq(gridProviders.id, id)))
    .limit(1);
  return row ? toConnection(row.provider, Boolean(row.credentialId)) : null;
}

export async function createIntegrationConnection(input: {
  integrationKey: string;
  name: string;
  credentials: Record<string, string>;
}) {
  const integration = getIntegration(input.integrationKey);
  // A function has no account to add.
  if (!integration || integrationKind(integration) === "function") throw new Error("Unknown integration");
  const allowedFields = new Set(integration.auth.fields.map((field) => field.key));
  if (Object.keys(input.credentials).some((key) => !allowedFields.has(key))) {
    throw new Error("One or more credential fields are invalid");
  }
  if (Object.values(input.credentials).some((value) => typeof value !== "string")) {
    throw new Error("Credential values must be text");
  }
  const credentials = Object.fromEntries(
    integration.auth.fields.map((field) => [field.key, (input.credentials[field.key] ?? "").trim()]),
  );
  const missing = integration.auth.fields.find((field) => field.required && !credentials[field.key]);
  if (missing) throw new Error(`${missing.label} is required`);
  if (Object.values(credentials).some((value) => value.length > 4096)) {
    throw new Error("A credential value is too long");
  }
  const name = input.name.trim();
  if (name.length > 120) throw new Error("Account name is too long");

  await verifyIntegrationCredentials(input.integrationKey, credentials);

  return db.transaction(async (tx) => {
    const [provider] = await tx
      .insert(gridProviders)
      .values({
        organizationId: currentOrganizationId(),
        key: `${input.integrationKey}-${randomUUID()}`,
        name: name || `${integration.name} account`,
        config: {
          integrationKey: input.integrationKey,
          verification: {
            status: "verified",
            verifiedAt: new Date().toISOString(),
          },
        },
        enabled: true,
      })
      .returning();
    await tx.insert(gridProviderCredentials).values({
      providerId: provider.id,
      encryptedPayload: encryptIntegrationCredentials(credentials),
    });
    return toConnection(provider, true);
  });
}

/** Server-only credential resolution. Never include this value in an API response. */
export async function getIntegrationCredentials(id: string): Promise<Record<string, string> | null> {
  if (virtualConnectionById(id)) return {};
  const [row] = await db
    .select({ provider: gridProviders, encryptedPayload: gridProviderCredentials.encryptedPayload })
    .from(gridProviders)
    .leftJoin(gridProviderCredentials, eq(gridProviderCredentials.providerId, gridProviders.id))
    .where(and(inOrg(gridProviders), eq(gridProviders.id, id)))
    .limit(1);
  if (!row?.provider.enabled) return null;
  const { provider, encryptedPayload } = row;
  const config = provider.config as ProviderConfig;
  if (config.verification?.status !== "verified") return null;
  if (encryptedPayload) return decryptIntegrationCredentials(encryptedPayload);
  // Temporary compatibility for records created before the credentials table.
  // The migration removes this field after a successful encrypted backfill.
  if (config.encryptedCredentials) {
    return Object.fromEntries(
      Object.entries(config.encryptedCredentials).map(([key, value]) => [
        key,
        decryptIntegrationCredential(value),
      ]),
    );
  }
  return null;
}

export async function getIntegrationCredential(id: string): Promise<string | null> {
  return (await getIntegrationCredentials(id))?.apiKey ?? null;
}
