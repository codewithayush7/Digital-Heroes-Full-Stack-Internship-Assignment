import { z } from "zod";
import {
  MIN_CHARITY_CONTRIBUTION_PCT,
  MAX_CHARITY_CONTRIBUTION_PCT,
} from "../config/constants";

export const loginSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
  .regex(/[a-z]/, "Password must contain at least one lowercase letter")
  .regex(/[0-9]/, "Password must contain at least one number");

export const signupSchema = z
  .object({
    email: z.string().email("Please enter a valid email address"),
    password: passwordSchema,
    confirmPassword: z.string().min(1, "Please confirm your password"),
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

