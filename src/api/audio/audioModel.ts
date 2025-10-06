import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import { z } from "zod";

extendZodWithOpenApi(z);

// Schema for session event data
export const SessionEventSchema = z.object({
    id: z.number(),
    level: z.number(),
    type: z.string(),
    sourceChannel: z.string(),
    sourceNumber: z.string(),
    queue: z.string(),
    destChannel: z.string(),
    destNumber: z.string(),
    date: z.string().datetime(),
    duration: z.string(),
    filename: z.string(),
    incommingfileUrl: z.string().nullable().optional(),
    outgoingfileUrl: z.string().nullable().optional(),
    transcription: z.any().nullable().optional(),
    explanation: z.string().nullable().optional(),
    category: z.string().nullable().optional(),
    topic: z.any().nullable().optional(),
    emotion: z.string().nullable().optional(),
    keyWords: z.array(z.string()).nullable().optional(),
    routinCheckStart: z.string().nullable().optional(),
    routinCheckEnd: z.string().nullable().optional(),
    forbiddenWords: z.any().nullable().optional(),
    time: z.string(),
    pid: z.number(),
    hostname: z.string(),
    name: z.string(),
    msg: z.string(),
});

// Query parameter schema for lastId parameter
export const AudioQueryParamSchema = z.object({
    lastId: z.string().optional().transform((val) => (val ? parseInt(val, 10) : undefined)),
    batchSize: z.string().optional().transform((val) => (val ? parseInt(val, 10) : 1000)),
});

// Response schema for multiple session events
export const SessionEventsResponseSchema = z.object({
    data: z.array(SessionEventSchema),
}); 