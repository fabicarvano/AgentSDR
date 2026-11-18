import "server-only";

import { classifyResendError, type ResendErrorBody, type ResendFailure } from "./resendErrors";

// "Name <address>": a display name makes the first email look less like spam.
const DEFAULT_FROM = "Fabio | Restrição Nunca Mais <fabio@restricaonuncamais.com.br>";
const DEFAULT_REPLY_TO = "fabio@restricaonuncamais.com.br";

/**
 * Subject, plain text and a minimal HTML part of the validation email. Written
 * as a short personal note (no links, images or bold) that asks for a reply:
 * it reads less like a promotion and a reply is the strongest signal a mailbox
 * provider gets that the sender is wanted. The HTML is only <p> and <br>.
 */
export function buildMessage(name: string | null) {
  // Single line: the name goes into the subject header.
  const firstName = (name ?? "").replace(/\s+/g, " ").trim().split(" ")[0];
  const subject = firstName ? `${firstName}, quer aumentar seu score de crédito?` : "Quer aumentar seu score de crédito?";
  const paragraphs = [
    firstName ? `Oi, ${firstName}, tudo bem?` : "Oi, tudo bem?",
    "Aqui é o Fabio, da Restrição Nunca Mais. Preparei um e-book curto com dicas práticas para melhorar seu score nas instituições financeiras e conseguir crédito com mais facilidade.",
    "Gostaria de receber? Se tiver interesse, é só responder este e-mail que eu te envio.",
  ];
  const signature = ["Abraço,", "Fabio", "Restrição Nunca Mais"];
  const escape = (value: string) =>
    value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
  const text = `${paragraphs.join("\n\n")}\n\n${signature.join("\n")}`;
  const html = `${paragraphs.map((paragraph) => `<p>${escape(paragraph)}</p>`).join("")}<p>${signature.map(escape).join("<br>")}</p>`;
  return { subject, text, html };
}

export type SendResult =
  | { ok: true; resendEmailId: string }
  | { ok: false; failure: ResendFailure; status: number | null; detail: string };

/** One call to Resend. Never throws: every failure comes back classified (resendErrors.ts). */
export async function sendValidationEmail(to: string, name: string | null): Promise<SendResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { ok: false, failure: "config", status: null, detail: "RESEND_API_KEY is not set" };
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: process.env.EMAIL_VALIDATION_FROM || DEFAULT_FROM,
        reply_to: process.env.EMAIL_VALIDATION_REPLY_TO || DEFAULT_REPLY_TO,
        to: [to],
        ...buildMessage(name),
      }),
    });
    const body = (await response.json().catch(() => null)) as (ResendErrorBody & { id?: string }) | null;
    if (response.ok && body?.id) return { ok: true, resendEmailId: body.id };
    return {
      ok: false,
      failure: response.ok ? "transient" : classifyResendError(response.status, body),
      status: response.status,
      detail: `${body?.name ?? "no error name"}: ${(body?.message ?? "").slice(0, 200)}`,
    };
  } catch (error) {
    return { ok: false, failure: "transient", status: null, detail: error instanceof Error ? error.message : String(error) };
  }
}
