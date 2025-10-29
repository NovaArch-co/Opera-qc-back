import cors from "cors";
import express, { type Express } from "express";
import helmet from "helmet";
import { pino } from "pino";

import { openAPIRouter } from "@/api-docs/openAPIRouter";
import { sequentialRouter } from "@/api/sequential/sequentialRouter";
import { sessionEventRouter } from "@/api/session/sessionRouter";
import { userRouter } from "@/api/user/userRouter";
import errorHandler from "@/common/middleware/errorHandler";
import rateLimiter from "@/common/middleware/rateLimiter";
import requestLogger from "@/common/middleware/requestLogger";
import { initializeDatabase } from "@/common/utils/dbHealthCheck";
import { env } from "@/common/utils/envConfig";
import { sequentialWorker } from "@/queue/sequentialQueue";
import { sessionWorker } from "@/queue/sessionQueue";
import { transcriptionWorker } from "@/queue/transcriptionQueue";
import expressBasicAuth from "express-basic-auth";
import passport from "passport";
import { audioRouter } from "./api/audio/audioRouter";
import { authRouter } from "./api/auth/authRouter";
import { passportConfig } from "./auth";

const logger = pino({ name: "server start" });
const app: Express = express();
console.log("Swagger URL:", env.SWAGGER_URL);

// Initialize database connection
initializeDatabase()
  .then(() => {
    logger.info("Database connection initialized");
  })
  .catch((error) => {
    logger.error("Failed to initialize database connection:", error);
  });

// Set the application to trust the reverse proxy
app.set("trust proxy", true);

// Setting up authentication handler
app.use(passport.initialize());
passport.use(passportConfig);

// Middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
// Configure CORS to allow all origins
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl requests)
      if (!origin) return callback(null, true);

      const allowedOrigins = env.CORS_ORIGIN.split(",");
      if (allowedOrigins.indexOf(origin) !== -1 || allowedOrigins.includes("*")) {
        return callback(null, true);
      } else {
        return callback(null, true); // Allow all origins during development
        // For production: return callback(new Error('Not allowed by CORS'), false);
      }
    },
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  }),
);
app.use(rateLimiter);

// Request logging
app.use(requestLogger);

// Routes
app.use("/api/auth", authRouter);
// Mount users router. In production, protect with JWT; in dev/test allow open access to simplify frontend integration.
if (env.isProduction) {
  app.use("/api/users", passport.authenticate("jwt", { session: false }), userRouter);
} else {
  // No auth in non-production for easier local development
  app.use("/api/users", userRouter);
}
// app.use("/api/sessions", passport.authenticate("jwt", { session: false }), sessionEventRouter);
app.use("/api/event", sessionEventRouter);
app.use("/api/sequential", sequentialRouter);
app.use("/api/audio", audioRouter); // Basic auth is handled within the router
// Swagger UI
app.use("/api/docs", openAPIRouter);
app.use(helmet());

// Error handlers
app.use(errorHandler());

// Initialize queue worker
sessionWorker.on("completed", (job: any) => {
  console.log(`Job ${job.id} completed successfully`);
});

sessionWorker.on("failed", (job: any, err: any) => {
  console.error(`Job ${job?.id} failed with error:`, err);
});

// No need to set up event handlers for sequential worker here
// as they are already defined in the sequentialQueue.ts file

// Initialize transcription worker
transcriptionWorker.on("completed", (job: any) => {
  console.log(`Transcription job ${job.id} completed successfully`);
});

transcriptionWorker.on("failed", (job: any, err: any) => {
  console.error(`Transcription job ${job?.id} failed with error:`, err);
});

export { app, logger };
