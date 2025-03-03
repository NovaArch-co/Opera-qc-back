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
import passport from "passport";
import { authRouter } from "./api/auth/authRouter";
import { passportConfig } from "./auth";
import {sessionEventRouter} from "@/api/session/sessionRouter";

const logger = pino({ name: "server start" });
const app: Express = express();

// Set the application to trust the reverse proxy
app.set("trust proxy", true);

// Setting up authentication handler
app.use(passport.initialize());
passport.use(passportConfig);

// Middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
app.use(helmet());
app.use(rateLimiter);

// Request logging
app.use(requestLogger);

// Routes
app.use("/api/auth", authRouter);
app.use("/api/users", passport.authenticate("jwt", { session: false }), userRouter);
// app.use("/api/sessions", passport.authenticate("jwt", { session: false }), sessionEventRouter);
app.use("/api/sessions",passport.authenticate("jwt", { session: false }), sessionEventRouter);

// Swagger UI
app.use("/api/docs", openAPIRouter);

// Error handlers
app.use(errorHandler());

export { app, logger };
