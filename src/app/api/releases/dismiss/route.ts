import { type NextRequest } from "next/server";
import { auth } from "@/lib/auth/server";
import { setDismissedRelease } from "@/lib/releases/dismissal";
import { parseDismissBody } from "@/lib/releases/requests";
import { getCurrentRelease } from "@/lib/releases/releases";

/** Records that the signed-in person dismissed the current release notes. Only the current version is accepted. */
export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return Response.json({ error: "Sign in to continue" }, { status: 401 });

  const body = parseDismissBody(await request.json().catch(() => null));
  if (!body.ok) return Response.json({ error: "Invalid body: expected { version: string }" }, { status: 400 });

  const release = getCurrentRelease();
  if (!release || body.version !== release.version) {
    return Response.json({ error: "Not the current release", currentVersion: release?.version ?? null }, { status: 409 });
  }

  await setDismissedRelease(session.user.id, release.version);
  return Response.json({ ok: true });
}
