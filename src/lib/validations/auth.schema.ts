import { z } from "zod";
import {
  MIN_CHARITY_CONTRIBUTION_PCT,
  MAX_CHARITY_CONTRIBUTION_PCT,
} from "../config/constants";

export const loginSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export const signupSchema = z
  .object({
    email: z.string().email("Please enter a valid email address"),
    password: z.string().min(6, "Password must be at least 6 characters"),
    confirmPassword: z.string().min(6, "Please confirm your password"),
    fullName: z
      .string()
      .min(2, "Full name must be at least 2 characters")
      .max(100, "Full name must be under 100 characters"),
    charityId: z
      .string()
      .regex(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
        "Invalid charity ID"
      )
      .optional()
      .or(z.literal("")),
    charityContributionPct: z.coerce
      .number()
      .min(
        MIN_CHARITY_CONTRIBUTION_PCT,
        `Charity contribution must be at least ${MIN_CHARITY_CONTRIBUTION_PCT}%`
      )
      .max(
        MAX_CHARITY_CONTRIBUTION_PCT,
        `Charity contribution cannot exceed ${MAX_CHARITY_CONTRIBUTION_PCT}%`
      )
      .default(MIN_CHARITY_CONTRIBUTION_PCT),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export type LoginInput = z.infer<typeof loginSchema>;
export type SignupInput = z.infer<typeof signupSchema>;
