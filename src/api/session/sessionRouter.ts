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

sessionEventRegistry.registerPath({
  method: "post",
  path: "/api/event/processFolderAudio",
  tags: ["SessionEvent"],
  description: "Process audio files from a local folder. Scans for audio file pairs (r/t) and processes them through the AI pipeline.",
  requestBody: {
    content: {
      "application/json": {
        schema: {
          type: "object",
          properties: {
            folderPath: {
              type: "string",
              example: "/home/afeai/VOICE-2channel",
              description: "Path to the folder containing audio files"
            },
            processAll: {
              type: "boolean",
              example: true,
              description: "Whether to process all files or just new ones"
            }
          },
          required: ["folderPath"]
        }
      }
    }
  },
  responses: {
    "200": {
      description: "Folder processing started",
      content: {
        "application/json": {
          schema: z.object({
            success: z.boolean().openapi({ example: true }),
            message: z.string().openapi({ example: "Folder processing started" }),
            data: z.object({
              filesFound: z.number().openapi({ example: 10 }),
              pairsProcessed: z.number().openapi({ example: 5 }),
              jobIds: z.array(z.string()).openapi({ example: ["job-1", "job-2"] })
            }),
            statusCode: z.number().openapi({ example: 200 })
          })
        }
      }
    },
    "400": {
      description: "Bad request - invalid folder path",
    },
    "401": {
      description: "Unauthorized - invalid credentials",
    },
    "500": {
      description: "Server error",
    }
  }
});

sessionEventRegistry.registerPath({
  method: "post",
  path: "/api/event/processVoiceFolder",
  tags: ["SessionEvent"],
  description: "Process audio files from the default voice folder (/home/afeai/VOICE-2channel). This is a convenient endpoint that doesn't require specifying the folder path.",
  responses: {
    "200": {
      description: "Voice folder processing started",
      content: {
        "application/json": {
          schema: z.object({
            success: z.boolean().openapi({ example: true }),
            message: z.string().openapi({ example: "Voice folder processing started" }),
            data: z.object({
              folderPath: z.string().openapi({ example: "/home/afeai/VOICE-2channel" }),
              filesFound: z.number().openapi({ example: 10 }),
              pairsProcessed: z.number().openapi({ example: 5 }),
              jobIds: z.array(z.string()).openapi({ example: ["job-1", "job-2"] })
            }),
            statusCode: z.number().openapi({ example: 200 })
          })
        }
      }
    },
    "400": {
      description: "Bad request - voice folder not accessible",
    },
    "401": {
      description: "Unauthorized - invalid credentials",
    },
    "500": {
      description: "Server error",
    }
  }
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
sessionEventRouter.post("/sessionReceived", basicAuthMiddleware, sessionEventController.createSessionEvent);
// New endpoint to process audio files from folder
sessionEventRouter.post("/processFolderAudio", basicAuthMiddleware, sessionEventController.processFolderAudio);
// Convenient endpoint to process the default voice folder
sessionEventRouter.post("/processVoiceFolder", basicAuthMiddleware, sessionEventController.processDefaultVoiceFolder);

