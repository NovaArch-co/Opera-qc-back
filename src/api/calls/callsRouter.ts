import express from "express";
import { getCalls } from "./callsController";
import { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import { z } from "zod";
import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import { createApiResponses } from "@/api-docs/openAPIResponseBuilders";
import { StatusCodes } from "http-status-codes";

extendZodWithOpenApi(z);

const router = express.Router();

// OpenAPI registry for calls
export const callsRegistry = new OpenAPIRegistry();

// Define call response schema
const CallSchema = z.object({
    id: z.string().openapi({ description: "Call ID" }),
    destNumber: z.string().openapi({ description: "Agent ID/destination number" }),
    topic: z.string().nullable().openapi({ description: "Call topic/subject" }),
    category: z.string().nullable().openapi({ description: "Call category" }),
    date: z.string().openapi({ description: "Call date in ISO format" }),
    duration: z.string().openapi({ description: "Call duration" }),
    emotion: z.string().nullable().openapi({
        description: "Customer emotion",
        example: "خوشحال"
    }),
    routinCheckStart: z.string().nullable().openapi({
        description: "Routine start check status (1=completed, 0=not completed)",
        example: "1"
    }),
    routinCheckEnd: z.string().nullable().openapi({
        description: "Routine end check status (1=completed, 0=not completed)",
        example: "0"
    }),
    explanation: z.string().nullable().openapi({ description: "Call explanation" }),
    transcription: z.any().openapi({ description: "Call transcription" }),
    forbiddenWords: z.any().nullable().openapi({ description: "Forbidden words used in call" })
});

const PaginationSchema = z.object({
    currentPage: z.number().openapi({ description: "Current page number" }),
    totalPages: z.number().openapi({ description: "Total number of pages" }),
    totalItems: z.number().openapi({ description: "Total number of items" }),
    limit: z.number().openapi({ description: "Number of items per page" }),
    hasNextPage: z.boolean().openapi({ description: "Whether there is a next page" }),
    hasPrevPage: z.boolean().openapi({ description: "Whether there is a previous page" })
});

const CallsResponseSchema = z.object({
    data: z.array(CallSchema),
    pagination: PaginationSchema
});

// Register the GET /api/calls endpoint
callsRegistry.registerPath({
    method: "get",
    path: "/api/calls",
    tags: ["Calls"],
    request: {
        query: z.object({
            page: z.string().optional().openapi({ description: "Page number (default: 1)" }),
            limit: z.string().optional().openapi({ description: "Number of records per page (default: 10)" }),
            dateFrom: z.string().optional().openapi({ description: "Start date for filtering calls (YYYY-MM-DD)" }),
            dateTo: z.string().optional().openapi({ description: "End date for filtering calls (YYYY-MM-DD)" }),
            durationMin: z.string().optional().openapi({ description: "Minimum call duration in seconds" }),
            durationMax: z.string().optional().openapi({ description: "Maximum call duration in seconds" }),
            topic: z.string().optional().openapi({ description: "Search term for call topic/subject (partial match)" }),
            emotion: z.string().optional().openapi({
                description: "Filter by customer emotion",
                example: "خوشحال, ناراحت, عصبانی"
            }),
            destNumber: z.string().optional().openapi({ description: "Filter by agent ID/destination number (partial match)" }),
            routineCheckStart: z.string().optional().openapi({
                description: "Filter by routine start check status (1=completed, 0=not completed)",
                example: "1"
            }),
            routineCheckEnd: z.string().optional().openapi({
                description: "Filter by routine end check status (1=completed, 0=not completed)",
                example: "0"
            }),
        })
    },
    responses: {
        ...createApiResponses([
            {
                schema: CallsResponseSchema,
                description: "Successfully retrieved calls",
                statusCode: StatusCodes.OK
            },
            {
                schema: z.object({
                    error: z.string(),
                    details: z.array(z.any())
                }),
                description: "Invalid parameters",
                statusCode: StatusCodes.BAD_REQUEST
            },
            {
                schema: z.object({
                    error: z.string(),
                    message: z.string()
                }),
                description: "Server error",
                statusCode: StatusCodes.INTERNAL_SERVER_ERROR
            }
        ])
    },
    summary: "Get calls with filtering",
    description: "Retrieve call recordings with various filtering options"
});

/**
 * @route GET /api/calls
 * @desc Get calls with filtering capabilities
 * @access Private
 */
router.get("/", getCalls);

export { router as callsRouter }; 