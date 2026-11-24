import { NextRequest, NextResponse } from "next/server";
import { listNotes, createNote } from "@/lib/inbox/notesAndTasks";
import { withOrgContext, authContextErrorResponse } from "@/lib/auth/context";
import { invalidJsonResponse } from "@/lib/http/responses";
import { apiErrorBody } from "@/lib/http/apiErrors";

// GET /api/outreach/inbox/notes
export async function GET(request: NextRequest) {
  try {
    return await withOrgContext(request, async () => {
      const notes = await listNotes();
      return NextResponse.json({ notes });
    });
  } catch (error) {
    const response = authContextErrorResponse(error);
    if (response) return response;
    throw error;
  }
}

// POST /api/outreach/inbox/notes — { title, description?, leadId? }
export async function POST(req: NextRequest) {
  try {
    return await withOrgContext(req, async () => {
      let body: { title?: string; description?: string; leadId?: string };
      try {
        body = await req.json();
      } catch {
        return invalidJsonResponse();
      }
      if (!body.title?.trim()) {
        return NextResponse.json(apiErrorBody("invalidBody", "title is required"), { status: 400 });
      }
      const note = await createNote({ title: body.title, description: body.description, leadId: body.leadId });
      return NextResponse.json({ note }, { status: 201 });
    });
  } catch (error) {
    const response = authContextErrorResponse(error);
    if (response) return response;
    throw error;
  }
}
