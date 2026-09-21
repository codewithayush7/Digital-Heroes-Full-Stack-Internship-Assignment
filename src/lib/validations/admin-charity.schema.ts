import { z } from "zod";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const createCharitySchema = z.object({
  name: z
    .string({ error: "Charity name is required." })
    .trim()
    .min(2, "Charity name must be at least 2 characters.")
    .max(100, "Charity name cannot exceed 100 characters."),
  slug: z
    .string({ error: "Charity slug is required." })
    .trim()
    .min(2, "Slug must be at least 2 characters.")
    .max(100, "Slug cannot exceed 100 characters.")
    .regex(
      SLUG_REGEX,
      "Slug must contain only lowercase alphanumeric characters and single hyphens."
    ),
  tagline: z
    .string()
    .trim()
    .max(160, "Tagline cannot exceed 160 characters.")
    .optional()
    .nullable()
    .or(z.literal("")),
  description: z
    .string({ error: "Description is required." })
    .trim()
    .min(10, "Description must be at least 10 characters."),
  websiteUrl: z
    .string()
    .trim()
    .url("Please enter a valid website URL.")
    .optional()
    .nullable()
    .or(z.literal("")),
  logoUrl: z
    .string()
    .trim()
    .url("Please enter a valid logo image URL.")
    .optional()
    .nullable()
    .or(z.literal("")),
  coverImageUrl: z
    .string()
    .trim()
    .url("Please enter a valid cover image URL.")
    .optional()
    .nullable()
    .or(z.literal("")),
  isFeatured: z.boolean().default(false),
});

export const updateCharitySchema = createCharitySchema.extend({
  id: z.string().regex(UUID_REGEX, "Invalid charity ID format."),
});

export const toggleFeaturedCharitySchema = z.object({
  id: z.string().regex(UUID_REGEX, "Invalid charity ID format."),
  isFeatured: z.boolean(),
});

export const deleteCharitySchema = z.object({
  id: z.string().regex(UUID_REGEX, "Invalid charity ID format."),
});

export type CreateCharityInput = z.infer<typeof createCharitySchema>;
export type UpdateCharityInput = z.infer<typeof updateCharitySchema>;
export type ToggleFeaturedCharityInput = z.infer<typeof toggleFeaturedCharitySchema>;
export type DeleteCharityInput = z.infer<typeof deleteCharitySchema>;
