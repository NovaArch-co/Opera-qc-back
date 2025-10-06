// import type { Request } from "express";
// import { rateLimit } from "express-rate-limit";

// import { env } from "@/common/utils/envConfig";

// const rateLimiter = rateLimit({
//   legacyHeaders: true,
//   limit: env.COMMON_RATE_LIMIT_MAX_REQUESTS,
//   message: "Too many requests, please try again later.",
//   standardHeaders: true,
//   windowMs: 15 * 60 * env.COMMON_RATE_LIMIT_WINDOW_MS,
//   keyGenerator: (req: Request) => req.ip as string,
// });

// export default rateLimiter;





import type { Request } from "express";
import { rateLimit } from "express-rate-limit";

import { env } from "@/common/utils/envConfig";

// Create the limiter instance once at module load (app init)
const limiter = rateLimit({
  legacyHeaders: true,
  limit: env.COMMON_RATE_LIMIT_MAX_REQUESTS,
  message: "Too many requests, please try again later.",
  standardHeaders: true,
  // Interpret windowMs directly from env (ms)
  windowMs: env.COMMON_RATE_LIMIT_WINDOW_MS,
  keyGenerator: (req: Request) => req.ip as string,
  // Do not rate-limit the ingestion endpoint used for high-throughput events
  skip: (req) => req.method === "POST" && req.path === "/api/event/sessionReceived",
});

export default limiter;  // Export the pre-created instance