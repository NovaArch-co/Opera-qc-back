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
const TopicsResponseSchema = z.array(z.string());

const SessionStatsResponseSchema = z.object({
  total_calls: z.number(),
  total_agents: z.number(),
  top_emotion: z.string().nullable(),
  top_emotion_count: z.number(),
  distinct_categories: z.number(),
  distinct_topics: z.number()
});

const DestNumbersResponseSchema = z.array(z.string());

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
      description: "Filter sessions by category/topic (the key in the topic object)",
      required: false,
      schema: {
        type: "string",
      },
    },
    {
      name: "topic",
      in: "query",
      description: "Filter sessions by specific topic (the value in the topic object)",
      required: false,
      schema: {
        type: "string",
      },
    },
    {
      name: "destNumber",
      in: "query",
      description: "Filter sessions by agent destination number",
      required: false,
      schema: {
        type: "string",
      },
    },
    {
      name: "type",
      in: "query",
      description: "Filter sessions by call type (incoming or outgoing)",
      required: false,
      schema: {
        type: "string",
        enum: ["incoming", "outgoing"]
      },
    },
  ],
  responses: createApiResponse(GetSessionEventsSchema, "Success"),
});

sessionEventRegistry.registerPath({
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
  description: "Submit a new call session event. Note: Only calls with type='incoming' will be processed. Calls with type='outgoing' will be acknowledged but not processed.",
  responses: {
    "200": {
      description: "Session event received",
      content: {
        "application/json": {
          schema: z.object({
            success: z.boolean().openapi({ example: true }),
            message: z.string().openapi({ example: "Session event processing started (sequential processing)" }),
            data: z.object({
              jobId: z.string().openapi({ example: "process-session-job-12345" }),
              status: z.string().openapi({ example: "waiting" }),
              type: z.string().openapi({ example: "incoming" }),
              processed: z.boolean().optional().openapi({ example: true, description: "Whether the call will be processed. Only true for incoming calls." })
            }).openapi({ description: "Response data object" }),
            statusCode: z.number().openapi({ example: 200 })
          })
        }
      }
    },
    "400": {
      description: "Bad request - missing required fields",
    },
    "401": {
      description: "Unauthorized - invalid credentials",
    },
    "500": {
      description: "Server error",
    }
  }
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

sessionEventRegistry.registerSecurePath({
  method: "get",
  path: "/api/event/topics",
  tags: ["SessionEvent"],
  responses: createApiResponse(TopicsResponseSchema, "Topics Retrieved"),
});

sessionEventRegistry.registerSecurePath({
  method: "get",
  path: "/api/event/audio/:filename",
  tags: ["SessionEvent"],
  parameters: [
    {
      name: "filename",
      in: "path",
      description: "The filename of the audio file to retrieve",
      required: true,
      schema: {
        type: "string"
      }
    }
  ],
  responses: {
    "200": {
      description: "Audio file stream",
      content: {
        "audio/wav": {
          schema: {
            type: "string",
            format: "binary"
          }
        }
      }
    },
    "400": {
      description: "Invalid filename"
    },
    "404": {
      description: "Audio file not found"
    },
    "500": {
      description: "Server error"
    }
  }
});

sessionEventRegistry.registerSecurePath({
  method: "get",
  path: "/api/event/check-audio/:filename",
  tags: ["SessionEvent"],
  parameters: [
    {
      name: "filename",
      in: "path",
      description: "The filename of the audio file to check",
      required: true,
      schema: {
        type: "string"
      }
    }
  ],
  responses: {
    "200": {
      description: "Detailed diagnostics about file access",
      content: {
        "application/json": {
          schema: {
            type: "object"
          }
        }
      }
    },
    "500": {
      description: "Server error"
    }
  }
});

sessionEventRegistry.registerSecurePath({
  method: "get",
  path: "/api/event/stats",
  tags: ["SessionEvent"],
  responses: createApiResponse(SessionStatsResponseSchema, "Session Statistics Retrieved"),
});

sessionEventRegistry.registerSecurePath({
  method: "get",
  path: "/api/event/destnumbers",
  tags: ["SessionEvent"],
  responses: createApiResponse(DestNumbersResponseSchema, "Destination Numbers Retrieved"),
});

// Basic Auth configuration - UPDATED WITH MULTIPLE CREDENTIALS
const basicAuthMiddleware = expressBasicAuth({
  users: {
    'User1': 'hyQ39c8E873MVv5e22E3T355n3bYV5nf',
    'tipax': 'opera-qc-2024'  // Add the same credentials used by audioRouter
  },
  challenge: true,
  realm: 'Opera QC API'
});

/**
 * @todo
 */
sessionEventRouter.get("/dashboard", passport.authenticate("jwt", { session: false }), sessionEventController.getSessionsByFilter);
sessionEventRouter.get("/categories", passport.authenticate("jwt", { session: false }), sessionEventController.getDistinctCategories);
sessionEventRouter.get("/job/:jobId", passport.authenticate("jwt", { session: false }), sessionEventController.getJobStatus);
sessionEventRouter.get("/topics", passport.authenticate("jwt", { session: false }), sessionEventController.getDistinctTopics);
sessionEventRouter.get("/stats", passport.authenticate("jwt", { session: false }), sessionEventController.getSessionStats);
sessionEventRouter.get("/destnumbers", passport.authenticate("jwt", { session: false }), sessionEventController.getDistinctDestNumbers);
sessionEventRouter.get("/check-audio/:filename", passport.authenticate("jwt", { session: false }), sessionEventController.checkAudioFile);
sessionEventRouter.get("/audio/:filename", passport.authenticate("jwt", { session: false }), sessionEventController.getAudioFile);
sessionEventRouter.get("/:id", passport.authenticate("jwt", { session: false }), sessionEventController.getSessionEventById);
sessionEventRouter.get("/", passport.authenticate("jwt", { session: false }), sessionEventController.getSessions);
// Update this line to make it more permissive - accept both sets of credentials
sessionEventRouter.post("/sessionReceived", basicAuthMiddleware, sessionEventController.createSessionEvent);

