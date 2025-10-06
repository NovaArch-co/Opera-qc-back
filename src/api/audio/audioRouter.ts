import express, { type Router } from "express";
import expressBasicAuth from "express-basic-auth";
import { ExtendedOpenAPIRegistry } from "@/api-docs/openAPIRegistryBuilders";
import { createApiResponse } from "@/api-docs/openAPIResponseBuilders";
import { validateRequest } from "@/common/utils/httpHandlers";
import { audioController } from "./audioController";
import { AudioQueryParamSchema, SessionEventsResponseSchema } from "./audioModel";
import { z } from "zod";

export const audioRegistry = new ExtendedOpenAPIRegistry();
export const audioRouter: Router = express.Router();

// Basic auth middleware
const basicAuth = expressBasicAuth({
    users: { 'tipax': 'opera-qc-2024' },
    challenge: true, // Will prompt for credentials
    unauthorizedResponse: 'Authentication required'
});

// Register schemas for OpenAPI documentation
audioRegistry.register("SessionEvents", SessionEventsResponseSchema);
audioRegistry.register("AudioQueryParams", AudioQueryParamSchema);

// Document the API endpoint
audioRegistry.registerPath({
    method: "get",
    path: "/api/audio/sessions",
    tags: ["Audio"],
    security: [{ basicAuth: [] }],
    parameters: [
        {
            name: "lastId",
            in: "query",
            required: false,
            schema: {
                type: "string",
            },
            description: "Optional last ID from which to fetch records (exclusive)"
        },
        {
            name: "batchSize",
            in: "query",
            required: false,
            schema: {
                type: "string",
            },
            description: "Number of records to fetch per batch (default: 1000)"
        }
    ],
    responses: createApiResponse(SessionEventsResponseSchema, "Success"),
});

// Create a wrapper schema that expects query parameters
const RequestSchema = z.object({
    query: AudioQueryParamSchema,
});

// Define the route with basic authentication
// Skip the validateRequest middleware as we're handling streaming response directly
audioRouter.get("/sessions", basicAuth, audioController.getSessionEvents); 