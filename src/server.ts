import cors from "cors";
import express, { type Express } from "express";
import helmet from "helmet";
import { pino } from "pino";

import { openAPIRouter } from "@/api-docs/openAPIRouter";
import { userRouter } from "@/api/user/userRouter";
import errorHandler from "@/common/middleware/errorHandler";
import rateLimiter from "@/common/middleware/rateLimiter";
import requestLogger from "@/common/middleware/requestLogger";
import { env } from "@/common/utils/envConfig";
import { initializeDatabase } from "@/common/utils/dbHealthCheck";
import passport from "passport";
import { authRouter } from "./api/auth/authRouter";
import { passportConfig } from "./auth";
import { sessionEventRouter } from "@/api/session/sessionRouter";
import expressBasicAuth from "express-basic-auth";
import { sessionWorker } from '@/queue/sessionQueue';

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
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
}));
app.use(rateLimiter);

// Request logging
app.use(requestLogger);

// Routes
app.use("/api/auth", authRouter);
app.use("/api/users", passport.authenticate("jwt", { session: false }), userRouter);
// app.use("/api/sessions", passport.authenticate("jwt", { session: false }), sessionEventRouter);
app.use("/api/event", sessionEventRouter);
// Swagger UI
app.use("/api/docs", openAPIRouter);
app.use(helmet());

// Error handlers
app.use(errorHandler());

// Initialize queue worker
sessionWorker.on('completed', (job) => {
    console.log(`Job ${job.id} completed successfully`);
});

sessionWorker.on('failed', (job, err) => {
    console.error(`Job ${job?.id} failed with error:`, err);
});

export { app, logger };
