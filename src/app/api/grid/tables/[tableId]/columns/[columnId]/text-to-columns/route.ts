import { NextRequest, NextResponse } from "next/server";
import {
  splitTextColumn,
  TEXT_SPLIT_DELIMITERS,
  type TextSplitDelimiter,
} from "@/lib/grid/column-operations";
import { authContextErrorResponse, withOrgContext } from "@/lib/auth/context";
import { clientMessage, isRecord, isUuid } from "@/lib/grid/validate";
import { invalidJsonResponse, notFoundResponse } from "@/lib/grid/http-errors";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ tableId: string; columnId: string }> },
) {
  try {
    return await withOrgContext(req, async () => {
      const { tableId, columnId } = await params;
      if (!isUuid(tableId) || !isUuid(columnId)) return notFoundResponse();
      let body: { delimiter?: TextSplitDelimiter };
      try {
        const parsed = await req.json();
        if (!isRecord(parsed)) throw new Error("not an object");
        body = parsed;
      } catch {
        return invalidJsonResponse();
      }
      if (!body.delimiter || !TEXT_SPLIT_DELIMITERS.includes(body.delimiter)) {
        return NextResponse.json({ error: "choose a valid separator" }, { status: 400 });
      }

      try {
        const result = await splitTextColumn(tableId, columnId, body.delimiter);
        return NextResponse.json({ columnsCreated: result.columns.length, rowsUpdated: result.rowsUpdated });
      } catch (cause) {
        return NextResponse.json(
          { error: clientMessage(cause, "could not split this column") },
          { status: 400 },
        );
      }
    });
  } catch (error) {
    const response = authContextErrorResponse(error);
    if (response) return response;
    throw error;
  }
}
