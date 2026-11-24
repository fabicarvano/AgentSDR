import { NextRequest, NextResponse } from "next/server";
import { getThreadForLead } from "@/lib/inbox/queries";
import { withOrgContext, authContextErrorResponse } from "@/lib/auth/context";
import { notFoundResponse } from "@/lib/http/responses";

// GET /api/outreach/inbox/leads/[id]/thread
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    return await withOrgContext(_req, async () => {
      const { id } = await params;
      const result = await getThreadForLead(id);
      if (!result) return notFoundResponse();
      return NextResponse.json(result);
    });
  } catch (error) {
    const response = authContextErrorResponse(error);
    if (response) return response;
    throw error;
  }
}
