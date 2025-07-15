import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  server: {
    MONGODB_URI: z.string().url(),
    IMGBB_API_KEY: z.string().min(1),
    NODE_ENV: z.enum(["development", "production", "test"]),
  },
  client: {},
  runtimeEnv: {
    MONGODB_URI: process.env.MONGODB_URI || process.env.MONGO_URI,
    IMGBB_API_KEY: process.env.IMGBB_API_KEY,
    NODE_ENV: process.env.NODE_ENV,
  },
});
