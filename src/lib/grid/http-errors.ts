import { apiError } from "@/lib/http/apiErrors";

/** The grid routes' most repeated error responses, in one place. The English text is what API clients have always received. */
export const notFoundResponse = () => apiError(404, "notFound", "not found");
export const tableNotFoundResponse = () => apiError(404, "tableNotFound", "table not found");
export const invalidJsonResponse = () => apiError(400, "invalidJson", "invalid JSON body");
