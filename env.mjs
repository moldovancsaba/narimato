import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  server: {
    MONGO_URI: z.string().min(1),
    MONGODB_URI: z.string().min(1).optional().default(process.env.MONGO_URI || ''),
    IMGBB_API_KEY: z.string().min(1),
    NODE_ENV: z.enum(["development", "production", "test"]),
    NEXTAUTH_URL: z.string().url().optional(),
    NEXTAUTH_SECRET: z.string().min(32),
    GOOGLE_CLIENT_ID: z.string().min(1),
    GOOGLE_CLIENT_SECRET: z.string().min(1),
  },
  client: {},
  runtimeEnv: {
    MONGO_URI: process.env.MONGO_URI,
    MONGODB_URI: process.env.MONGODB_URI || process.env.MONGO_URI,
    IMGBB_API_KEY: process.env.IMGBB_API_KEY,
    NODE_ENV: process.env.NODE_ENV,
    NEXTAUTH_URL: process.env.NEXTAUTH_URL,
    NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET,
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
  },
});
