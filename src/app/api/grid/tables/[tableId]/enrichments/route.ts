import { NextRequest, NextResponse } from "next/server";
import { createEnrichmentColumns, updateEnrichmentColumns } from "@/lib/grid/enrichments";
import { getTable } from "@/lib/grid/tables";
import { getTranslations } from "next-intl/server";
import { getIntegrationAction } from "@/lib/integrations/catalog";
import { enrichmentNamesFrom, type EnrichmentNames, type NameLookup } from "@/lib/grid/enrichmentNames";
import { authContextErrorResponse, withOrgContext } from "@/lib/auth/context";
import { clientMessage, isRecord, isUuid } from "@/lib/grid/validate";
import { virtualConnectionFor } from "@/lib/grid/providers";
import { invalidJsonResponse, tableNotFoundResponse } from "@/lib/grid/http-errors";

/** The column names in the language of the current request; English when the catalog cannot be read. */
async function namesFor(integrationKey: string, actionKey: string): Promise<EnrichmentNames> {
  const action = getIntegrationAction(integrationKey, actionKey);
  if (!action) return {};
  try {
    const t = (await getTranslations("integrationsRegistry")) as unknown as NameLookup;
    return enrichmentNamesFrom(t, integrationKey, action);
  } catch (error) {
    // A name is never worth failing the creation.
    console.error("enrichment names: could not load the catalog", error);
    return {};
  }
}

/**
 * A function (AgentService) has no account, so the client sends no connection: the organization's virtual one
 * is used, whatever the request says.
 */
function functionConnectionId(integrationKey: unknown): string | undefined {
  return typeof integrationKey === "string" ? virtualConnectionFor(integrationKey)?.id : undefined;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ tableId: string }> },
) {
  try {
    return await withOrgContext(request, async () => {
      const { tableId } = await params;
      if (!isUuid(tableId) || !(await getTable(tableId))) {
        return tableNotFoundResponse();
      }

      let body: {
        integrationKey?: string;
        actionKey?: string;
        inputs?: Record<string, string>;
        selectedOutputs?: string[];
        connectionId?: string;
        autoRun?: boolean;
        runCondition?: string;
        delaySeconds?: number;
        runInBatches?: boolean;
        afterColumnId?: string;
        beforeColumnId?: string;
      };
      try {
        const parsed = await request.json();
        if (!isRecord(parsed)) throw new Error("not an object");
        body = parsed;
      } catch {
        return invalidJsonResponse();
      }

      if (!body.integrationKey || !body.actionKey) {
        return NextResponse.json({ error: "integrationKey and actionKey are required" }, { status: 400 });
      }
      body.connectionId = functionConnectionId(body.integrationKey) ?? body.connectionId;
      if (!body.inputs || !body.selectedOutputs || !body.connectionId) {
        return NextResponse.json({ error: "inputs, outputs, and a connection are required" }, { status: 400 });
      }

      if (typeof body.integrationKey !== "string" || typeof body.actionKey !== "string") {
        return NextResponse.json({ error: "integrationKey and actionKey must be text" }, { status: 400 });
      }
      if (!isRecord(body.inputs) || Object.values(body.inputs).some((v) => typeof v !== "string")) {
        return NextResponse.json({ error: "inputs must map each input to a column key" }, { status: 400 });
      }
      if (!Array.isArray(body.selectedOutputs) || body.selectedOutputs.some((v) => typeof v !== "string")) {
        return NextResponse.json({ error: "outputs must be a list of output keys" }, { status: 400 });
      }
      if (!isUuid(body.connectionId)) {
        return NextResponse.json({ error: "connectionId is not a valid id" }, { status: 400 });
      }

      try {
        const columns = await createEnrichmentColumns({
          tableId,
          integrationKey: body.integrationKey,
          actionKey: body.actionKey,
          inputs: body.inputs,
          selectedOutputs: body.selectedOutputs,
          connectionId: body.connectionId,
          autoRun: body.autoRun ?? true,
          runCondition: body.runCondition,
          delaySeconds: body.delaySeconds,
          runInBatches: body.runInBatches,
          afterColumnId: body.afterColumnId,
          beforeColumnId: body.beforeColumnId,
          names: await namesFor(body.integrationKey, body.actionKey),
        });
        return NextResponse.json({ columns, primaryColumnKey: columns[0]?.key }, { status: 201 });
      } catch (error) {
        return NextResponse.json(
          { error: clientMessage(error, "Could not add enrichment") },
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

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ tableId: string }> },
) {
  try {
    return await withOrgContext(request, async () => {
      const { tableId } = await params;
      if (!isUuid(tableId) || !(await getTable(tableId))) {
        return tableNotFoundResponse();
      }

      let body: {
        columnId?: string;
        integrationKey?: string;
        actionKey?: string;
        inputs?: Record<string, string>;
        selectedOutputs?: string[];
        connectionId?: string;
        autoRun?: boolean;
        runCondition?: string;
        delaySeconds?: number;
        runInBatches?: boolean;
      };
      try {
        const parsed = await request.json();
        if (!isRecord(parsed)) throw new Error("not an object");
        body = parsed;
      } catch {
        return invalidJsonResponse();
      }
      body.connectionId = functionConnectionId(body.integrationKey) ?? body.connectionId;
      if (!body.columnId || !body.integrationKey || !body.actionKey || !body.inputs || !body.selectedOutputs || !body.connectionId) {
        return NextResponse.json({ error: "column, action, inputs, outputs, and connection are required" }, { status: 400 });
      }

      if (typeof body.integrationKey !== "string" || typeof body.actionKey !== "string") {
        return NextResponse.json({ error: "integrationKey and actionKey must be text" }, { status: 400 });
      }
      if (!isRecord(body.inputs) || Object.values(body.inputs).some((v) => typeof v !== "string")) {
        return NextResponse.json({ error: "inputs must map each input to a column key" }, { status: 400 });
      }
      if (!Array.isArray(body.selectedOutputs) || body.selectedOutputs.some((v) => typeof v !== "string")) {
        return NextResponse.json({ error: "outputs must be a list of output keys" }, { status: 400 });
      }
      if (!isUuid(body.connectionId)) {
        return NextResponse.json({ error: "connectionId is not a valid id" }, { status: 400 });
      }

      try {
        const columns = await updateEnrichmentColumns({
          columnId: body.columnId,
          tableId,
          integrationKey: body.integrationKey,
          actionKey: body.actionKey,
          inputs: body.inputs,
          selectedOutputs: body.selectedOutputs,
          connectionId: body.connectionId,
          autoRun: body.autoRun ?? true,
          runCondition: body.runCondition,
          delaySeconds: body.delaySeconds,
          runInBatches: body.runInBatches,
          names: await namesFor(body.integrationKey, body.actionKey),
        });
        const primary = columns.find((column) => column.id === body.columnId);
        return NextResponse.json({ columns, primaryColumnKey: primary?.key });
      } catch (error) {
        return NextResponse.json(
          { error: clientMessage(error, "Could not update enrichment") },
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
