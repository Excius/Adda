import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production"]).default("development"),
  API_PORT: z.coerce.number(),
  REDIS_URL: z.string().default("redis://localhost:6379"),
  ANNOUNCED_IP: z.string(),
  MEDIASOUP_RTC_MIN_PORT: z.int(),
  MEDIASOUP_RTC_MAX_PORT: z.int(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid enviornment variables:");
  console.error(parsed.error.issues);
  process.exit(1);
}

export const env = parsed.data;
