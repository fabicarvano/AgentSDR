import { apiError } from "@/lib/http/apiErrors";

/** The routes' most repeated error responses. The English text is what API clients have always received. */
export const notFoundResponse = () => apiError(404, "notFound", "not found");
export const invalidJsonResponse = () => apiError(400, "invalidJson", "invalid JSON body");
export const campaignNotFoundResponse = () => apiError(404, "campaignNotFound", "campaign not found");
