import { NextRequest, NextResponse } from "next/server";
import { listTasks, createTask } from "@/lib/inbox/notesAndTasks";
import { withOrgContext, authContextErrorResponse } from "@/lib/auth/context";
import { invalidJsonResponse } from "@/lib/http/responses";
import { apiErrorBody } from "@/lib/http/apiErrors";

// GET /api/outreach/inbox/tasks
export async function GET(request: NextRequest) {
  try {
    return await withOrgContext(request, async () => {
      const tasks = await listTasks();
      return NextResponse.json({ tasks });
    });
  } catch (error) {
    const response = authContextErrorResponse(error);
    if (response) return response;
    throw error;
  }
}

// POST /api/outreach/inbox/tasks — { name, description?, leadId? }
export async function POST(req: NextRequest) {
  try {
    return await withOrgContext(req, async () => {
      let body: { name?: string; description?: string; leadId?: string };
      try {
        body = await req.json();
      } catch {
        return invalidJsonResponse();
      }
      if (!body.name?.trim()) {
        return NextResponse.json(apiErrorBody("nameRequired", "name is required"), { status: 400 });
      }
      const task = await createTask({ name: body.name, description: body.description, leadId: body.leadId });
      return NextResponse.json({ task }, { status: 201 });
    });
  } catch (error) {
    const response = authContextErrorResponse(error);
    if (response) return response;
    throw error;
  }
}
