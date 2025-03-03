import express, { type Router } from "express";
import { ExtendedOpenAPIRegistry } from "@/api-docs/openAPIRegistryBuilders";
import { createApiResponse } from "@/api-docs/openAPIResponseBuilders";
import {CreateSessionEventResponseSchema, GetSessionEventsSchema, SessionEventSchema} from "@/api/session/sessionModel"; // Assuming the model file
import { sessionEventController } from "./session";

export const sessionEventRegistry = new ExtendedOpenAPIRegistry();
export const sessionEventRouter: Router = express.Router();

sessionEventRegistry.register("SessionEvent", SessionEventSchema);

sessionEventRegistry.registerSecurePath({
  method: "get",
  path: "/api/sessions/:id",
  tags: ["SessionEvent"],
  responses: createApiResponse(CreateSessionEventResponseSchema, "Success"),
});

sessionEventRegistry.registerSecurePath({
  method: "get",
  path: "/api/sessions",
  tags: ["SessionEvent"],
  responses: createApiResponse(GetSessionEventsSchema, "Success"),
});

sessionEventRegistry.registerSecurePath({
  method: "post",
  path: "/api/sessions",
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
  path: "/api/sessions/dashboard",
  tags: ["SessionEvent"],
  responses: createApiResponse(SessionEventSchema, "Session Event Created"),
});

sessionEventRouter.get("/dashboard", sessionEventController.getSessionsByFilter);
sessionEventRouter.get("/:id", sessionEventController.getSessionEventById);
sessionEventRouter.get("/", sessionEventController.getSessions);
sessionEventRouter.post("/", sessionEventController.createSessionEvent);

