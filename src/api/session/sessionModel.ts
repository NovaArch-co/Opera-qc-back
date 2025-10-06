import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import { z } from "zod";

import { commonValidations } from "@/common/utils/commonValidation";

extendZodWithOpenApi(z);

export type SessionEvent = z.infer<typeof SessionEventSchema>;

export const SessionEventSchema = z.object({
    id: z.number().openapi({ example: 1 }), // Assuming ID is auto-generated
    level: z.number().openapi({ example: 30 }),
    time: z.number().openapi({ example: 1739087192309 }),
    pid: z.number().openapi({ example: 20 }),
    hostname: z.string().openapi({ example: "backend" }),
    name: z.string().openapi({ example: "tttt2t" }),
    type: z.enum(["incoming", "outgoing"]).openapi({ example: "incoming", description: "Call type - only incoming calls will be processed" }),
    sourceChannel: z.string().optional().openapi({ example: "SIP/305" }),
    sourceNumber: z.string().optional().openapi({ example: "305" }),
    queue: z.string().optional().openapi({ example: "null" }),
    destChannel: z.string().optional().openapi({ example: "SIP/cisco" }),
    destNumber: z.string().optional().openapi({ example: "BB09938900865" }),
    date: z.string().refine(value => !isNaN(Date.parse(value)), {
        message: "Invalid date format",
    }).openapi({ example: "1403-11-21 10:29:13" }),
    duration: z.string().openapi({ example: "00:02:11" }),
    filename: z.string().openapi({ example: "14030721-191913-09151532004-204" }),
    msg: z.string().openapi({ example: "Session event info" }),
    createdAt: z.date().openapi({ example: "2025-03-03T07:21:41.000Z" }), // Example timestamp
    updatedAt: z.date().openapi({ example: "2025-03-03T07:21:41.000Z" })  // Example timestamp
});

export const GetSessionEventSchema = z.object({
    params: z.object({
        id: commonValidations.id
    }),
});

export const CreateSessionEventSchema = z.object({
    level: z.number(),
    time: z.number(),
    pid: z.number(),
    hostname: z.string(),
    name: z.string(),
    type: z.enum(["incoming", "outgoing"]),
    sourceChannel: z.string().optional(),
    sourceNumber: z.string().optional(),
    queue: z.string().optional(),
    destChannel: z.string().optional(),
    destNumber: z.string().optional(),
    date: z.string().refine(value => !isNaN(Date.parse(value)), {
        message: "Invalid date format",
    }),
    duration: z.string(),
    filename: z.string(),
    msg: z.string(),
});

// Updated to match the new process API response format
export const TranscriptionResponseSchema = z.object({
    transcription: z.object({
        Agent: z.string(),
        Customer: z.string()
    }),
    analysis: z.object({
        explanation: z.array(z.string()),
        topic: z.array(z.string())
    }).optional()
});

export type TranscriptionResponse = z.infer<typeof TranscriptionResponseSchema>;

// Updated to match the new process API response format
export const AnalysisResponseSchema = z.object({
    transcription: z.object({
        Agent: z.string(),
        Customer: z.string()
    }),
    analysis: z.object({
        explanation: z.array(z.string()),
        topic: z.array(z.string())
    })
});

export type AnalysisResponse = z.infer<typeof AnalysisResponseSchema>;

export const CreateSessionEventResponseSchema = z.object({
    id: z.number().openapi({ example: 16 }),
    level: z.number().openapi({ example: 30 }),
    time: z.string().openapi({ example: "1740801101" }),
    pid: z.number().openapi({ example: 20 }),
    hostname: z.string().openapi({ example: "backend" }),
    name: z.string().openapi({ example: "tttt2t" }),
    type: z.string().openapi({ example: "outgoing" }),
    sourceChannel: z.string().nullable().openapi({ example: "SIP/305" }),
    sourceNumber: z.string().nullable().openapi({ example: "305" }),
    queue: z.string().nullable().openapi({ example: "null" }),
    destChannel: z.string().nullable().openapi({ example: "SIP/cisco" }),
    destNumber: z.string().nullable().openapi({ example: "BB09938900865" }),
    date: z.string().refine(value => !isNaN(Date.parse(value)), {
        message: "Invalid date format",
    }).openapi({ example: "2025-03-03T07:21:41.000Z" }),
    duration: z.string().openapi({ example: "00:02:11" }),
    filename: z.string().openapi({ example: "14030721-191913-09151532004-204" }),
    incommingfileUrl: z.string().nullable().openapi({ example: "http://localhost:9000/audio-files/14030721-191913-09151532004-204-in.wav" }),
    outgoingfileUrl: z.string().nullable().openapi({ example: "http://localhost:9000/audio-files/14030721-191913-09151532004-204-out.wav" }),
    msg: z.string().openapi({ example: "Session event info" }),
    transcription: TranscriptionResponseSchema.optional(),
    explanation: z.string().nullable().openapi({ example: "مکالمۀ یک مرکز تماس شامل گفتگوی بین نماینده و مشتری است..." }),
    category: z.string().nullable().openapi({ example: "سوالی" }),
    topic: z.array(z.string()).nullable().openapi({ example: ["101"] }), // Updated to match new format
    emotion: z.string().nullable().openapi({ example: "ناراحت" }),
    keyWords: z.array(z.string()).nullable().openapi({ example: ["شماره", "وارد", "مشتری", "برنامه", "دیدن"] }),
    forbiddenWords: z.record(z.string(), z.number()).nullable().openapi({ example: { "آهان": 2, "آره": 1 } }),
    routinCheckStart: z.string().nullable().openapi({ example: "0" }),
    routinCheckEnd: z.string().nullable().openapi({ example: "0" }),
});

export const GetSessionEventsSchema = z.array(CreateSessionEventResponseSchema);