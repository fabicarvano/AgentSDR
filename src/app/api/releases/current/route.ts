import { type NextRequest } from "next/server";
import { getLocale } from "next-intl/server";
import { auth } from "@/lib/auth/server";
import { getDismissedRelease } from "@/lib/releases/dismissal";
import { getCurrentRelease, localizeRelease, shouldShowRelease } from "@/lib/releases/releases";

/** The current release notes in the person's language, and whether they already dismissed them. Needs a session, not an organization. */
export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return Response.json({ error: "Sign in to continue" }, { status: 401 });

  const release = getCurrentRelease();
  if (!release) return Response.json({ error: "No release notes" }, { status: 404 });

  // Without the table (migration not run yet) only the pop-up fails; the component ignores a non-OK answer.
  let dismissedVersion: string | null;
  try {
    dismissedVersion = await getDismissedRelease(session.user.id);
  } catch (error) {
    console.error("Could not read the dismissed release", error);
    return Response.json({ error: "Could not read release notes state" }, { status: 500 });
  }
  return Response.json({
    ...localizeRelease(release, await getLocale()),
    dismissed: !shouldShowRelease(release.version, dismissedVersion),
  });
}
