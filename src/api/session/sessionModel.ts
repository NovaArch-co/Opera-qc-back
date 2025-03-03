import {extendZodWithOpenApi} from "@asteasolutions/zod-to-openapi";
import {z} from "zod";

import {commonValidations} from "@/common/utils/commonValidation";

extendZodWithOpenApi(z);

export type SessionEvent = z.infer<typeof SessionEventSchema>;

export const SessionEventSchema = z.object({
    id: z.number().openapi({ example: 1 }), // Assuming ID is auto-generated
    level: z.number().openapi({ example: 30 }),
    time: z.number().openapi({ example: 1739087192309 }),
    pid: z.number().openapi({ example: 20 }),
    hostname: z.string().openapi({ example: "backend" }),
    name: z.string().openapi({ example: "tttt2t" }),
    type: z.string().openapi({ example: "outgoing" }),
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
    type: z.string(),
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

const TranscriptionSegmentSchema = z.object({
    start: z.number(),
    end: z.number(),
    speaker: z.string(),
    text: z.string(),
});

export const TranscriptionResponseSchema = z.object({
    wav_customer: z.array(TranscriptionSegmentSchema),
});

export type TranscriptionResponse = z.infer<typeof TranscriptionResponseSchema>;

export const AnalysisResponseSchema = z.object({
    explanation: z.array(z.string()),
    category: z.array(z.string()),
    topic: z.record(z.string(), z.string()),
    emotion: z.array(z.string()),
    key_words: z.array(z.string()),
    routin_check_start: z.array(z.string()),
    routin_check_end: z.array(z.string()),
    forbidden_words: z.array(z.string()),
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
    topic: z.record(z.string(), z.string()).nullable().openapi({ example: { "پنل": "ویرایش اشتباه" } }),
    emotion: z.string().nullable().openapi({ example: "ناراحت" }),
    keyWords: z.array(z.string()).nullable().openapi({ example: ["شماره", "وارد", "مشتری", "برنامه", "دیدن"] }),
    forbiddenWords: z.array(z.string()).nullable().openapi({ example: ["آهان", "آره", "خانمم"] }),
    routinCheckStart: z.string().nullable().openapi({ example: "0" }),
    routinCheckEnd: z.string().nullable().openapi({ example: "0" }),
});

export const GetSessionEventsSchema = z.array(CreateSessionEventResponseSchema);