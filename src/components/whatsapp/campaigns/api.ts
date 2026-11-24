import { apiErrorFromResponse } from "@/lib/http/apiErrors";
import type { ListWhatsappAccountsResponse, WhatsappAccountSummary } from "@/lib/whatsapp/contract";

/** Fetch JSON from the campaigns API; throws the route's `{ error }` message. */
export async function apiJson<T>(url: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  if (init?.body && typeof init.body === "string" && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  const response = await fetch(url, { ...init, headers });
  if (response.status === 204) return undefined as T;
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw apiErrorFromResponse(data, response.status);
  }
  return data as T;
}

export function fetchWhatsappAccounts(): Promise<WhatsappAccountSummary[]> {
  return apiJson<ListWhatsappAccountsResponse>("/api/whatsapp/accounts").then((r) => r.accounts);
}

