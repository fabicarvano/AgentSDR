import { NextResponse } from "next/server";
import { apiErrorBody } from "@/lib/http/apiErrors";

export async function POST() {
  return NextResponse.json(
    { ok: false, ...apiErrorBody("campaignImportFlow", "Use the campaign import flow so CSV columns are reviewed and mapped before People are created") },
    { status: 400 },
  );
}
