import { NextRequest, NextResponse } from "next/server";
import { createTable } from "@/lib/grid/tables";
import { getGridDefaultNames } from "@/lib/grid/defaultNames";
import { getWorkbook, listWorkbookTables } from "@/lib/grid/workbooks";
import { authContextErrorResponse, withOrgContext } from "@/lib/auth/context";
import { isRecord, isUuid, optionalName } from "@/lib/grid/validate";
import { apiErrorBody } from "@/lib/http/apiErrors";
import { invalidJsonResponse } from "@/lib/grid/http-errors";

// GET /api/grid/tables?workbookId=... — the sheet tabs for one workbook.
export async function GET(req: NextRequest) {
  try {
    return await withOrgContext(req, async () => {
      const workbookId = req.nextUrl.searchParams.get("workbookId");
      if (!workbookId) {
        return NextResponse.json({ error: "workbookId is required" }, { status: 400 });
      }
      if (!isUuid(workbookId)) {
        return NextResponse.json({ error: "workbookId is not a valid id" }, { status: 400 });
      }
      const tables = await listWorkbookTables(workbookId);
      return NextResponse.json({ tables });
    });
  } catch (error) {
    const response = authContextErrorResponse(error);
    if (response) return response;
    throw error;
  }
}

// POST /api/grid/tables — { workbookId, name?, description? } adds a sheet.
export async function POST(req: NextRequest) {
  try {
    return await withOrgContext(req, async () => {
      let body: { workbookId?: unknown; name?: unknown; description?: unknown };
      try {
        const parsed = await req.json();
        if (!isRecord(parsed)) throw new Error("not an object");
        body = parsed;
      } catch {
        return invalidJsonResponse();
      }

      if (!body.workbookId) {
        return NextResponse.json({ error: "workbookId is required" }, { status: 400 });
      }
      if (!isUuid(body.workbookId)) {
        return NextResponse.json({ error: "workbookId is not a valid id" }, { status: 400 });
      }
      const name = optionalName(body.name, "name", true);
      if (!name.ok) return NextResponse.json({ error: name.error }, { status: 400 });
      if (body.description !== undefined && body.description !== null && typeof body.description !== "string") {
        return NextResponse.json({ error: "description must be text" }, { status: 400 });
      }
      if (!(await getWorkbook(body.workbookId))) {
        return NextResponse.json(apiErrorBody("workbookNotFound", "workbook not found"), { status: 404 });
      }

      const table = await createTable({
        workbookId: body.workbookId,
        name: name.value,
        description: body.description ?? undefined,
        defaults: await getGridDefaultNames(),
      });
      return NextResponse.json({ table }, { status: 201 });
    });
  } catch (error) {
    const response = authContextErrorResponse(error);
    if (response) return response;
    throw error;
  }
}
