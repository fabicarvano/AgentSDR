import { NextRequest, NextResponse } from "next/server";
import { updateTask, deleteTask } from "@/lib/inbox/notesAndTasks";
import { withOrgContext, authContextErrorResponse } from "@/lib/auth/context";
import { invalidJsonResponse } from "@/lib/http/responses";

// PATCH /api/outreach/inbox/tasks/[id] — { name?, description?, isCompleted? }
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    return await withOrgContext(req, async () => {
      const { id } = await params;
      let body: { name?: string; description?: string | null; isCompleted?: boolean };
      try {
        body = await req.json();
      } catch {
        return invalidJsonResponse();
      }
      await updateTask(id, body);
      return NextResponse.json({ ok: true });
    });
  } catch (error) {
    const response = authContextErrorResponse(error);
    if (response) return response;
    throw error;
  }
}

// DELETE /api/outreach/inbox/tasks/[id]
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    return await withOrgContext(_req, async () => {
      const { id } = await params;
      await deleteTask(id);
      return NextResponse.json({ ok: true });
    });
  } catch (error) {
    const response = authContextErrorResponse(error);
    if (response) return response;
    throw error;
  }
}
