import { processResendWebhook, verifyResendSignature, type ResendWebhookPayload } from "@/lib/emailValidation/webhook";

/**
 * POST /api/webhooks/resend — Resend's email events for email validation.
 * Public in proxy.ts: it authenticates itself with the Svix signature
 * (RESEND_WEBHOOK_SECRET). A bad signature answers 401.
 */
export async function POST(request: Request) {
  const rawBody = await request.text();
  if (!verifyResendSignature(rawBody, request.headers)) {
    return Response.json({ error: "Invalid signature" }, { status: 401 });
  }
  let payload: ResendWebhookPayload;
  try {
    payload = JSON.parse(rawBody) as ResendWebhookPayload;
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  try {
    await processResendWebhook(payload);
    return Response.json({ ok: true });
  } catch (error) {
    console.error("[webhooks/resend] delivery failed:", error);
    return Response.json({ error: "Could not process the event" }, { status: 500 });
  }
}
