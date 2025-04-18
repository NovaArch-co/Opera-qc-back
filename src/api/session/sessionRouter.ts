import express, { type Router } from "express";
import { ExtendedOpenAPIRegistry } from "@/api-docs/openAPIRegistryBuilders";
import { createApiResponse } from "@/api-docs/openAPIResponseBuilders";
import { CreateSessionEventResponseSchema, GetSessionEventsSchema, SessionEventSchema } from "@/api/session/sessionModel"; // Assuming the model file
import { sessionEventController } from "./session";
import expressBasicAuth from "express-basic-auth";
import passport from "passport";
import { z } from "zod";

export const sessionEventRegistry = new ExtendedOpenAPIRegistry();
export const sessionEventRouter: Router = express.Router();

sessionEventRegistry.register("SessionEvent", SessionEventSchema);

const CategoriesResponseSchema = z.array(z.string());

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
  parameters: [
    {
      name: "page",
      in: "query",
      description: "Page number for pagination",
      required: false,
      schema: {
        type: "integer",
        default: 1,
      },
    },
    {
      name: "limit",
      in: "query",
      description: "Number of items per page",
      required: false,
      schema: {
        type: "integer",
        default: 10,
      },
    },
    {
      name: "emotion",
      in: "query",
      description: "Filter sessions by specific emotion",
      required: false,
      schema: {
        type: "string",
      },
    },
    {
      name: "category",
      in: "query",
      description: "Filter sessions by category/topic",
      required: false,
      schema: {
        type: "string",
      },
    },
  ],
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

sessionEventRegistry.registerSecurePath({
  method: "get",
  path: "/api/event/categories",
  tags: ["SessionEvent"],
  responses: createApiResponse(CategoriesResponseSchema, "Categories Retrieved"),
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
sessionEventRouter.get("/categories", passport.authenticate("jwt", { session: false }), sessionEventController.getDistinctCategories);
sessionEventRouter.get("/job/:jobId", passport.authenticate("jwt", { session: false }), sessionEventController.getJobStatus);
sessionEventRouter.get("/:id", passport.authenticate("jwt", { session: false }), sessionEventController.getSessionEventById);
sessionEventRouter.get("/", passport.authenticate("jwt", { session: false }), sessionEventController.getSessions);
sessionEventRouter.post("/sessionReceived", basicAuthMiddleware, sessionEventController.createSessionEvent);

