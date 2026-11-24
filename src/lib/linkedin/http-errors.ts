import { apiErrorBody } from "@/lib/http/apiErrors";

/** The LinkedIn routes' most repeated error responses. The English text is what API clients have always received. */
export const searchNotFoundResponse = () =>
  Response.json({ ok: false, ...apiErrorBody("searchNotFound", "Search not found") }, { status: 404 });
export const accountNotFoundResponse = () =>
  Response.json({ ok: false, ...apiErrorBody("accountNotFound", "Account not found") }, { status: 404 });
export const accountIdsInvalidResponse = () =>
  Response.json({ ok: false, ...apiErrorBody("invalidBody", "accountIds must be an array of strings") }, { status: 400 });
