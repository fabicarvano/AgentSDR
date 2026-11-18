import "server-only";

import { and, eq } from "drizzle-orm";
import { createHmac, timingSafeEqual } from "node:crypto";
import { db } from "@/lib/db";
import { suppressionList, type SuppressionReason } from "@/lib/outreach/schema";
import { runInOrganization, inOrg } from "@/lib/tenancy/scope";
import { emailValidations, type EmailValidationStatus } from "./schema";

export type ResendWebhookPayload = {
  type?: string;
  created_at?: string;
  data?: { email_id?: string; bounce?: { type?: string } };
};

const TOLERANCE_SECONDS = 5 * 60;

/** Verifies a Resend (Svix) signature over the raw body. False when anything is missing or off. */
export function verifyResendSignature(rawBody: string, headers: Headers): boolean {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  const id = headers.get("svix-id");
  const timestamp = headers.get("svix-timestamp");
  const signatures = headers.get("svix-signature");
  if (!secret || !id || !timestamp || !signatures) return false;
  const age = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (!Number.isFinite(age) || age > TOLERANCE_SECONDS) return false;

  const key = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  const expected = createHmac("sha256", key).update(`${id}.${timestamp}.${rawBody}`).digest();
  return signatures.split(" ").some((part) => {
    const [version, value] = part.split(",");
    if (version !== "v1" || !value) return false;
    const given = Buffer.from(value, "base64");
    return given.length === expected.length && timingSafeEqual(given, expected);
  });
}

// opened only upgrades "valido"; it never overrides a bounce.
const RANK: Record<EmailValidationStatus, number> = {
  na_fila: 0,
  validando: 0,
  valido_presumido: 1,
  temporario: 1,
  indeterminado: 1,
  valido: 2,
  valido_ativo: 3,
  invalido: 4,
};

/**
 * Applies one Resend event to its validation row. Unknown email ids and
 * events that do not change the classification are ignored.
 */
export async function processResendWebhook(payload: ResendWebhookPayload): Promise<void> {
  const resendEmailId = payload.data?.email_id;
  const type = payload.type;
  if (!resendEmailId || !type) return;

  // The id is unique across organizations: this lookup is how the webhook finds its organization.
  const [row] = await db.select().from(emailValidations).where(eq(emailValidations.resendEmailId, resendEmailId)).limit(1);
  if (!row) return;

  await runInOrganization(row.organizationId, async () => {
    let status: EmailValidationStatus | null = null;
    let bounceType: string | null = null;
    let suppress: SuppressionReason | null = null;

    switch (type) {
      case "email.delivered":
        status = "valido";
        break;
      case "email.opened":
        status = "valido_ativo";
        break;
      case "email.bounced": {
        // Resend: Permanent = hard, Transient = soft, Undetermined = its own category.
        const kind = payload.data?.bounce?.type?.toLowerCase();
        if (kind === "permanent") {
          bounceType = "hard";
          status = "invalido";
          suppress = "bounced";
        } else if (kind === "transient") {
          bounceType = "soft";
          status = "temporario";
        } else {
          bounceType = "undetermined";
          status = "indeterminado";
        }
        break;
      }
      case "email.complained":
        status = "invalido";
        suppress = "complaint";
        break;
      default:
        return;
    }

    const now = new Date();
    const eventAt = payload.created_at ? new Date(payload.created_at) : now;
    // Events can arrive out of order (opened before delivered): never step down.
    const next = RANK[status] >= RANK[row.status] ? status : row.status;
    const final = next === "invalido" || next === "valido_ativo" || next === "valido";

    await db
      .update(emailValidations)
      .set({
        status: next,
        lastEvent: type,
        lastEventAt: Number.isNaN(eventAt.getTime()) ? now : eventAt,
        bounceType: bounceType ?? row.bounceType,
        resolvedAt: final ? (row.resolvedAt ?? now) : row.resolvedAt,
        updatedAt: now,
      })
      .where(and(inOrg(emailValidations), eq(emailValidations.id, row.id)));

    if (suppress) {
      await db
        .insert(suppressionList)
        .values({ organizationId: row.organizationId, email: row.email, reason: suppress, note: "email validation" })
        .onConflictDoNothing({ target: [suppressionList.organizationId, suppressionList.email] });
    }
  });
}
