import { z } from "zod";

/** Public listing IDs (`public_link_id`) are numeric; distinct from internal particulars IDs. */
const PUBLIC_ID = /^\d{1,20}$/;

// Pure, so client bundles that only need `isPublicId` leave zod out.
export const publicIdSchema = /* @__PURE__ */ (() =>
  z
    .string()
    .regex(PUBLIC_ID, "Public listing IDs are numeric")
    .describe("Public listing ID, e.g. 3716988130 (from search_properties or a /property/{id} URL)"))();

export const isPublicId = (value: string) => PUBLIC_ID.test(value);

/**
 * Extract the public ID from any listing URL segment the backend publishes:
 * `3716988130`, or the resboost slug `2-bed-for-sale-3716988130`.
 */
export function publicIdFromSlug(segment: string | undefined): string | null {
  const id = segment?.match(/(\d+)$/)?.[1];
  return id && isPublicId(id) ? id : null;
}
