import { z } from "zod";
import {
  landingHrefSchema,
  landingExperienceSchema,
} from "./landing-experience";
const ctaSchema = z.object({
  label: z.string().trim().min(1).max(80),
  href: landingHrefSchema,
});

export const landingPageSchema = z.object({
  schemaVersion: z
    .union([z.literal(2), z.literal(3), z.literal(4), z.literal(5)])
    .optional(),
  experience: landingExperienceSchema.optional(),
  hero: z.object({
    badge: z.string().max(120),
    title: z.string().trim().min(1).max(160),
    titleHighlight: z.string().max(120),
    subtitle: z.string().max(800),
    primaryCta: ctaSchema,
    secondaryCta: ctaSchema,
    trustLine: z.string(),
    stats: z
      .array(
        z.object({ value: z.string().max(80), label: z.string().max(120) }),
      )
      .min(0)
      .max(6),
  }),
  features: z.object({
    title: z.string().trim().min(1).max(160),
    subtitle: z.string().max(800),
    items: z
      .array(
        z.object({
          icon: z.string().max(60),
          title: z.string().trim().min(1).max(120),
          description: z.string().max(500),
        }),
      )
      .min(1)
      .max(8),
  }),
  steps: z.object({
    title: z.string().trim().min(1).max(160),
    items: z
      .array(
        z.object({
          step: z.string().max(20),
          title: z.string().trim().min(1).max(120),
          description: z.string().max(500),
        }),
      )
      .min(1)
      .max(6),
  }),
  pricing: z.object({
    title: z.string().trim().min(1).max(160),
    subtitle: z.string().max(800),
    plans: z
      .array(
        z.object({
          name: z.string().trim().min(1).max(80),
          price: z.number().min(0),
          period: z.string().max(80),
          credits: z.string().max(120),
          features: z.array(z.string().max(160)).min(1),
          cta: z.string().trim().min(1).max(80),
          popular: z.boolean(),
        }),
      )
      .min(1)
      .max(6),
  }),
  cta: z.object({
    title: z.string().trim().min(1).max(160),
    subtitle: z.string().max(800),
    button: ctaSchema,
  }),
  header: z.object({
    loginLabel: z.string().trim().min(1).max(40),
    registerLabel: z.string().trim().min(1).max(40),
  }),
  footer: z.object({
    description: z.string().max(500),
  }),
});
