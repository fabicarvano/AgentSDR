import { NextRequest, NextResponse } from "next/server";
import { getByokSettings, saveByokSettings } from "@/lib/ai/byok";
import { normalizeByokSettings } from "@/lib/ai/openrouter-types";
import { getAiConnection, getAiCredentials } from "@/lib/ai/connections";
import { listOpenRouterByokCatalog } from "@/lib/ai/server/openrouter";
import { authContextErrorResponse, requirePermission, withOrgContext } from "@/lib/auth/context";
import { apiErrorBody } from "@/lib/http/apiErrors";

export async function GET(request: NextRequest) {
  try {
    return await withOrgContext(request, async () => {
      return NextResponse.json(await getByokSettings());
    });
  } catch (error) {
    const response = authContextErrorResponse(error);
    if (response) return response;
    throw error;
  }
}
export async function PUT(req: NextRequest) {
  try {
    return await withOrgContext(req, async (ctx) => {
      requirePermission(ctx, { integrations: ["manage"] });
      const body = await req.json().catch(() => null);
      if (!body || typeof body !== "object") {
        return NextResponse.json(apiErrorBody("invalidSettings", "Invalid settings"), { status: 400 });
      }
      const settings = normalizeByokSettings(body);
      if (settings.providers.length && !settings.connectionId) {
        return NextResponse.json(apiErrorBody("openrouterConnectFirst", "Connect OpenRouter before selecting providers"), { status: 400 });
      }
      if (settings.providers.length && !settings.byokOnlyConfirmed) {
        return NextResponse.json(apiErrorBody("openrouterByokConfirm", "Confirm BYOK-only routing before saving"), { status: 400 });
      }
      if (settings.connectionId) {
        const connection = await getAiConnection(settings.connectionId);
        if (!connection?.verified || connection.providerKey !== "openrouter") {
          return NextResponse.json(apiErrorBody("openrouterSelectConnection", "Select a verified OpenRouter connection"), { status: 400 });
        }
        if (settings.providers.length) {
          const credentials = await getAiCredentials(connection.id);
          if (!credentials?.apiKey || !credentials.managementKey) {
            return NextResponse.json(apiErrorBody("openrouterReconnect", "Reconnect OpenRouter before saving"), { status: 400 });
          }
          try {
            const catalog = await listOpenRouterByokCatalog(credentials.managementKey);
            const available = new Map(catalog.map((provider) => [provider.slug, new Set(provider.models.map((model) => model.id))]));
            for (const provider of settings.providers) {
              const models = available.get(provider);
              if (!models) return NextResponse.json(apiErrorBody("openrouterNoByok", `${provider} has no active BYOK credential`, { provider: String(provider) }), { status: 400 });
              if (settings.modelsByProvider[provider].some((model) => !models.has(model))) {
                return NextResponse.json(apiErrorBody("openrouterModelsGone", `One or more selected ${provider} models are no longer available through BYOK`, { provider: String(provider) }), { status: 400 });
              }
            }
            if (settings.defaultModel) {
              const defaultProvider = catalog.find((provider) => provider.slug === settings.defaultModel?.provider);
              const defaultModel = defaultProvider?.models.find((model) => model.id === settings.defaultModel?.modelId);
              if (
                !defaultModel?.outputModalities?.includes("text")
                || !defaultModel.supportedParameters?.includes("tools")
              ) {
                return NextResponse.json(apiErrorBody("openrouterDefaultFunctionCalling", "The default model must support function calling"), { status: 400 });
              }
            }
          } catch (error) {
            return NextResponse.json({ error: error instanceof Error ? error.message : "Could not validate OpenRouter BYOK settings" }, { status: 502 });
          }
        }
      }
      if (settings.providers.some((provider) => !(settings.modelsByProvider[provider]?.length))) {
        return NextResponse.json(apiErrorBody("openrouterSelectModels", "Select at least one model for every enabled provider"), { status: 400 });
      }
      if (settings.providers.length && !settings.defaultModel) {
        return NextResponse.json(apiErrorBody("openrouterChooseDefault", "Choose a default model"), { status: 400 });
      }
      return NextResponse.json(await saveByokSettings(settings));
    });
  } catch (error) {
    const response = authContextErrorResponse(error);
    if (response) return response;
    throw error;
  }
}
