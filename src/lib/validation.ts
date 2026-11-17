import { z } from "zod";
import { MAX_PASSWORD_LENGTH, MIN_PASSWORD_LENGTH } from "./auth/password-policy";

// Shared input schemas for Server Actions.

export const MAX_VALUE_LENGTH = 20_000;
export const MAX_IMPORT_LENGTH = 200_000;

export const id = z.uuid({ message: "Invalid id." });

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, { message: `Must be at most ${max} characters.` })
    .optional()
    .transform((v) => (v ? v : null));

export const environmentInput = z.object({
  name: z
    .string()
    .trim()
    .min(1, { message: "Name is required." })
    .max(100, { message: "Name must be at most 100 characters." }),
  description: optionalText(1000),
});

export const credentialKey = z
  .string()
  .trim()
  .min(1, { message: "Key is required." })
  .max(200, { message: "Key must be at most 200 characters." });

export const credentialValue = z.string().max(MAX_VALUE_LENGTH, {
  message: `Value must be at most ${MAX_VALUE_LENGTH} characters.`,
});

export const credentialDescription = optionalText(1000);

export const email = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email({ message: "Enter a valid email address." }));

export const personName = z
  .string()
  .trim()
  .min(1, { message: "Name is required." })
  .max(100, { message: "Name must be at most 100 characters." });

export const role = z.enum(["superuser", "user"]);

export const newPassword = z
  .string()
  .min(MIN_PASSWORD_LENGTH, {
    message: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
  })
  .max(MAX_PASSWORD_LENGTH, {
    message: `Password must be at most ${MAX_PASSWORD_LENGTH} characters.`,
  });
