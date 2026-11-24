import { NextRequest, NextResponse } from "next/server";
import {
  getCampaign,
  updateCampaignName,
  updateCampaignSequence,
  setCampaignStatus,
  deleteCampaign,
  getCampaignStats,
} from "@/lib/outreach/campaigns";
import type { SequenceStep, CampaignStatus } from "@/lib/outreach/schema";
import { withOrgContext, authContextErrorResponse } from "@/lib/auth/context";
import { invalidJsonResponse, notFoundResponse } from "@/lib/http/responses";
import { apiErrorBody } from "@/lib/http/apiErrors";

// GET /api/outreach/campaigns/[id]
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    return await withOrgContext(_req, async () => {
      const { id } = await params;
      const campaign = await getCampaign(id);
      if (!campaign) return notFoundResponse();
      const stats = await getCampaignStats(id);
      return NextResponse.json({ campaign, stats });
    });
  } catch (error) {
    const response = authContextErrorResponse(error);
    if (response) return response;
    throw error;
  }
}

// PATCH /api/outreach/campaigns/[id] — { name?, sequence?, status? }
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    return await withOrgContext(req, async () => {
      const { id } = await params;
      const campaign = await getCampaign(id);
      if (!campaign) return notFoundResponse();

      let body: { name?: string; sequence?: SequenceStep[]; status?: CampaignStatus };
      try {
        body = await req.json();
      } catch {
        return invalidJsonResponse();
      }

      if (body.name !== undefined) {
        if (!body.name.trim()) return NextResponse.json(apiErrorBody("nameRequired", "name is required"), { status: 400 });
        await updateCampaignName(id, body.name);
      }
      if (body.sequence) await updateCampaignSequence(id, body.sequence);
      if (body.status) await setCampaignStatus(id, body.status);

      const updated = await getCampaign(id);
      return NextResponse.json({ campaign: updated });
    });
  } catch (error) {
    const response = authContextErrorResponse(error);
    if (response) return response;
    throw error;
  }
}

// DELETE /api/outreach/campaigns/[id]
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    return await withOrgContext(_req, async () => {
      const { id } = await params;
      await deleteCampaign(id);
      return NextResponse.json({ ok: true });
    });
  } catch (error) {
    const response = authContextErrorResponse(error);
    if (response) return response;
    throw error;
  }
}
