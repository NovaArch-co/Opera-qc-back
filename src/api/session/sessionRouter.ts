import express, { type Router } from "express";
import { ExtendedOpenAPIRegistry } from "@/api-docs/openAPIRegistryBuilders";
import { createApiResponse } from "@/api-docs/openAPIResponseBuilders";
import { CreateSessionEventResponseSchema, GetSessionEventsSchema, SessionEventSchema } from "@/api/session/sessionModel"; // Assuming the model file
import { sessionEventController } from "./session";
import expressBasicAuth from "express-basic-auth";
import passport from "passport";

export const sessionEventRegistry = new ExtendedOpenAPIRegistry();
export const sessionEventRouter: Router = express.Router();

sessionEventRegistry.register("SessionEvent", SessionEventSchema);

sessionEventRegistry.registerSecurePath({
  method: "get",
  path: "/api/event/:id",
  tags: ["SessionEvent"],
  responses: createApiResponse(CreateSessionEventResponseSchema, "Success"),
});

sessionEventRegistry.registerSecurePath({
  method: "get",
  path: "/api/event",
  tags: ["SessionEvent"],
  responses: createApiResponse(GetSessionEventsSchema, "Success"),
});

sessionEventRegistry.registerSecurePath({
  method: "post",
  path: "/api/event/sessionReceived",
  request: {
    body: {
      content: {
        "application/json": {
          schema: SessionEventSchema,
        },
      },
    },
  },
  tags: ["SessionEvent"],
  responses: createApiResponse(CreateSessionEventResponseSchema, "Session Event Created"),
});

sessionEventRegistry.registerSecurePath({
  method: "get",
  path: "/api/event/dashboard",
  tags: ["SessionEvent"],
  responses: createApiResponse(SessionEventSchema, "Session Event Created"),
});

sessionEventRegistry.registerSecurePath({
  method: "get",
  path: "/api/event/job/:jobId",
  tags: ["SessionEvent"],
  responses: createApiResponse(SessionEventSchema, "Job Status"),
});

// Basic Auth configuration
const basicAuthMiddleware = expressBasicAuth({
  users: { 'User1': 'hyQ39c8E873MVv5e22E3T355n3bYV5nf' },
  challenge: true,
  realm: 'Opera QC API'
});

/**
 * @todo
 */
sessionEventRouter.get("/dashboard", passport.authenticate("jwt", { session: false }), sessionEventController.getSessionsByFilter);
sessionEventRouter.get("/:id", passport.authenticate("jwt", { session: false }), sessionEventController.getSessionEventById);
sessionEventRouter.get("/", passport.authenticate("jwt", { session: false }), sessionEventController.getSessions);
sessionEventRouter.post("/sessionReceived", basicAuthMiddleware, sessionEventController.createSessionEvent);
sessionEventRouter.get("/job/:jobId", passport.authenticate("jwt", { session: false }), sessionEventController.getJobStatus);

