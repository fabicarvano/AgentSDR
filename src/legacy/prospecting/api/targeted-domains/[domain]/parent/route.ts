import { NextRequest, NextResponse } from "next/server";
import { authContextErrorResponse, withOrgContext } from "@/lib/auth/context";
import { setParentDomain } from "@/lib/qualification";
import { invalidJsonResponse } from "@/lib/http/responses";
import { apiErrorBody } from "@/lib/http/apiErrors";

// POST /api/targeted-domains/[domain]/parent
//   body: { parentDomain: string }
// A human supplies the parent domain for a parent_pending child. We point the
// child at the parent, add the parent as its own row, and qualify it.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ domain: string }> },
) {
  const { domain } = await params;
  try {
    return await withOrgContext(req, () => setParent(req, domain));
  } catch (error) {
    const auth = authContextErrorResponse(error);
    if (auth) return auth;
    throw error;
  }
}

async function setParent(req: NextRequest, domain: string) {
  let parentDomain: string | undefined;
  try {
    const body = await req.json();
    parentDomain = body?.parentDomain;
  } catch {
    return invalidJsonResponse();
  }
  if (!parentDomain) {
    return NextResponse.json(apiErrorBody("invalidBody", "parentDomain is required"), { status: 400 });
  }

  try {
    const result = await setParentDomain(domain.trim().toLowerCase(), parentDomain);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "failed to set parent";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
