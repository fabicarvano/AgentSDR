import { NextRequest, NextResponse } from "next/server";
import { toggleMessageImportant } from "@/lib/inbox/queries";
import { withOrgContext, authContextErrorResponse } from "@/lib/auth/context";
import { invalidJsonResponse } from "@/lib/http/responses";

// POST /api/outreach/inbox/messages/[id]/important — { important: boolean }
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    return await withOrgContext(req, async () => {
      const { id } = await params;
      let body: { important?: boolean };
      try {
        body = await req.json();
      } catch {
        return invalidJsonResponse();
      }
      await toggleMessageImportant(id, Boolean(body.important));
      return NextResponse.json({ ok: true });
    });
  } catch (error) {
    const response = authContextErrorResponse(error);
    if (response) return response;
    throw error;
  }
}
