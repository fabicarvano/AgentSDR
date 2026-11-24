import { NextRequest, NextResponse } from "next/server";
import { deleteAiConnection } from "@/lib/ai/connections";
import { authContextErrorResponse, requirePermission, withOrgContext } from "@/lib/auth/context";
import { isUuid } from "@/lib/grid/validate";
import { notFoundResponse } from "@/lib/grid/http-errors";

// DELETE /api/grid/ai/connections/[connectionId]
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ connectionId: string }> },
) {
  try {
    return await withOrgContext(_req, async (ctx) => {
      requirePermission(ctx, { integrations: ["manage"] });
      const { connectionId } = await params;
      if (!isUuid(connectionId)) return notFoundResponse();
      const ok = await deleteAiConnection(connectionId);
      if (!ok) return notFoundResponse();
      return NextResponse.json({ ok: true });
    });
  } catch (error) {
    const response = authContextErrorResponse(error);
    if (response) return response;
    throw error;
  }
}
