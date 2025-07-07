import express, { type Router } from "express";
import { ExtendedOpenAPIRegistry } from "@/api-docs/openAPIRegistryBuilders";
import { createApiResponse } from "@/api-docs/openAPIResponseBuilders";
import { validateRequest } from "@/common/utils/httpHandlers";
import { audioController } from "./audioController";
import { AudioQueryParamSchema, SessionEventsResponseSchema } from "./audioModel";
import { z } from "zod";

export const audioRegistry = new ExtendedOpenAPIRegistry();
export const audioRouter: Router = express.Router();

// Register schemas for OpenAPI documentation
audioRegistry.register("SessionEvents", SessionEventsResponseSchema);
audioRegistry.register("AudioQueryParams", AudioQueryParamSchema);

// Document the API endpoint
audioRegistry.registerSecurePath({
    method: "get",
    path: "/api/audio/sessions",
    tags: ["Audio"],
    parameters: [
        {
            name: "lastId",
            in: "query",
            required: false,
            schema: {
                type: "string",
            },
            description: "Optional last ID from which to fetch records (exclusive)"
        }
    ],
    responses: createApiResponse(SessionEventsResponseSchema, "Success"),
});

// Create a wrapper schema that expects query parameters
const RequestSchema = z.object({
    query: AudioQueryParamSchema,
});

// Define the route
audioRouter.get("/sessions", validateRequest(RequestSchema), audioController.getSessionEvents); 