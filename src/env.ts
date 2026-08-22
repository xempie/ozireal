import { z } from "zod";

/**
 * Environment, parsed once at boot. A missing or malformed variable fails the process
 * immediately rather than surfacing as a confusing error mid-request three hours later
 * (docs/phases.md item 0.2).
 */
const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().url(),

  // Everything below arrives in later phases. Optional now so the app boots before the
  // integrations exist, but validated the moment a value is present.
  REDIS_URL: z.string().url().optional(),
  ANTHROPIC_API_KEY: z.string().min(1).optional(),
  VOYAGE_API_KEY: z.string().min(1).optional(),
  DEEPGRAM_API_KEY: z.string().min(1).optional(),
  MESSAGEMEDIA_KEY: z.string().min(1).optional(),
  MESSAGEMEDIA_SECRET: z.string().min(1).optional(),
  S3_BUCKET: z.string().min(1).optional(),
  AWS_REGION: z.string().default("ap-southeast-2"),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((i) => `  ${i.path.join(".")}: ${i.message}`)
    .join("\n");
  throw new Error(`Invalid environment:\n${issues}`);
}

export const env = parsed.data;
