import type {Request, RequestHandler, Response} from "express";
import {ServiceResponse} from "@/common/models/serviceResponse";
import {handleServiceResponse} from "@/common/utils/httpHandlers";
import {PrismaClient} from "@prisma/client";
import {StatusCodes} from "http-status-codes";
import {
    AnalysisResponseSchema,
    CreateSessionEventSchema,
    TranscriptionResponseSchema
} from "@/api/session/sessionModel";
import fs from "node:fs";
import path from "node:path";
import {downloadAndSaveAudio} from "@/common/utils/downloadFileStream";
import {env} from "@/common/utils/envConfig";
import {PutObjectCommand, S3Client} from "@aws-sdk/client-s3";
import axios from "axios";
import FormData from "form-data";
import {addAnalysisCallJob} from "@/cron/cron"; // ✅ Make sure you are using `form-data` package

const prisma = new PrismaClient();

const s3Client = new S3Client({
    region: "us-east-1",
    endpoint: "http://127.0.0.1:9000",
    credentials: {
        accessKeyId: "minioaccesskey",
        secretAccessKey: "miniosecretkey",
    },
    forcePathStyle: true,
});

const BUCKET_NAME = "audio-files";

class SessionEventController {
    public createSessionEvent: RequestHandler = async (req: Request, res: Response) => {
        try {
            const parsedData = CreateSessionEventSchema.safeParse(req.body);

            if (!parsedData.success) {
                return handleServiceResponse(
                    ServiceResponse.failure("Invalid input data", parsedData.error.errors, StatusCodes.BAD_REQUEST),
                    res
                );
            }

            await addAnalysisCallJob(req.body)
            const serviceResponse = ServiceResponse.success("Session event created successfully", {
                message: "success",
            });
            return handleServiceResponse(serviceResponse, res);

        } catch (error) {
            console.error(error);
            return handleServiceResponse(
                ServiceResponse.failure("Error creating session event", error, StatusCodes.INTERNAL_SERVER_ERROR),
                res
            );
        }
    };

    public getSessionEventById: RequestHandler = async (req: Request, res: Response) => {
        const {id} = req.params;

        try {
            let sessionEvent = await prisma.sessionEvent.findUnique({
                where: {id: Number(id)},
            });

            if (!sessionEvent) {
                return handleServiceResponse(ServiceResponse.failure("Session event not found", {}, StatusCodes.NOT_FOUND), res);
            }

            const incommingfileUrl = `${env.MINIO_ENDPOINT_UTL}${sessionEvent.incommingfileUrl}`
            const outgoingfileUrl = `${env.MINIO_ENDPOINT_UTL}${sessionEvent.outgoingfileUrl}`
            sessionEvent = {
                ...sessionEvent,
                incommingfileUrl,
                outgoingfileUrl,
                forbiddenWords: sessionEvent.forbiddenWords ? sessionEvent.forbiddenWords : {},
                topic: (Object.keys(sessionEvent.topic).length > 0) ? Object.keys(sessionEvent.topic)[0] : ""
            }
            const serviceResponse = ServiceResponse.success("Session event retrieved successfully", sessionEvent);
            return handleServiceResponse(serviceResponse, res);
        } catch (error) {
            console.log(error);
            return handleServiceResponse(ServiceResponse.failure("Error fetching session event", error, StatusCodes.INTERNAL_SERVER_ERROR), res);
        }
    };

    public getSessions: RequestHandler = async (req: Request, res: Response) => {
        try {
            let sessionEvent = await prisma.sessionEvent.findMany({});
            sessionEvent = sessionEvent.map(event => {
                const incommingfileUrl = `${env.MINIO_ENDPOINT_UTL}${event.incommingfileUrl}`
                const outgoingfileUrl = `${env.MINIO_ENDPOINT_UTL}${event.outgoingfileUrl}`
                return {
                    ...event,
                    incommingfileUrl,
                    outgoingfileUrl,
                    forbiddenWords: event.forbiddenWords ? event.forbiddenWords : {},
                    topic: Object.keys(event.topic).length > 0 ? Object.keys(event.topic)[0] : ""
                }
            });
            const serviceResponse = ServiceResponse.success("Session events retrieved successfully", sessionEvent);
            return handleServiceResponse(serviceResponse, res);
        } catch (error) {
            console.log(error);
            return handleServiceResponse(ServiceResponse.failure("Error fetching session event", error, StatusCodes.INTERNAL_SERVER_ERROR), res);
        }
    };

    public getSessionsByFilter: RequestHandler = async (req: Request, res: Response) => {
        try {
            const result = await prisma.$queryRaw`
            WITH filtered_data AS (
                SELECT * FROM "SessionEvent"
            )
            , topic_distribution AS (
                SELECT 
                    jsonb_object_keys(topic) AS topic_name,
                    COUNT(*) AS count
                FROM filtered_data
                GROUP BY topic_name
            )
            , topic_trend AS (
                SELECT 
                    jsonb_object_keys(topic) AS topic_name,
                    DATE(date) AS call_date,
                    COUNT(*) AS count
                FROM filtered_data
                GROUP BY topic_name, call_date
            )
            , emotion_distribution AS (
                SELECT 
                    emotion,
                    COUNT(*) AS count
                FROM filtered_data
                GROUP BY emotion
            )
            , emotion_trend AS (
                SELECT 
                    emotion,
                    DATE(date) AS call_date,
                    COUNT(*) AS count
                FROM filtered_data
                GROUP BY emotion, call_date
            )
            , top_destinations AS (
                SELECT 
                    dest_number,
                    COUNT(*) AS count
                FROM filtered_data
                WHERE dest_number IS NOT NULL
                GROUP BY dest_number
                ORDER BY count DESC
                LIMIT 10
            )
            , key_words_count AS (
                SELECT 
                    unnest("keyWords") AS key_words,
                    COUNT(*) AS count
                FROM filtered_data
                GROUP BY key_words
                ORDER BY count DESC
            ), forbidden_words_count AS (
                SELECT 
                    key AS forbidden_word,
                    SUM(value::int) AS count
                FROM filtered_data,
                LATERAL jsonb_each("forbiddenWords")
                GROUP BY key
                ORDER BY count DESC
               )
            , top_agent_count AS (
                SELECT 
                    name,
                    SUM(
                        (split_part(duration, ':', 1)::INT * 3600) +  -- Hours to seconds
                        (split_part(duration, ':', 2)::INT * 60) +    -- Minutes to seconds
                        (split_part(duration, ':', 3)::INT)           -- Seconds
                    ) AS total_duration_seconds,
                    COUNT(*) AS count
                FROM filtered_data
                GROUP BY name
                ORDER BY count DESC
)
            SELECT 
                (SELECT jsonb_agg(t) FROM topic_distribution t) AS topic_pie_chart,
                (SELECT jsonb_agg(tt) FROM topic_trend tt) AS topic_line_chart,
                (SELECT jsonb_agg(e) FROM emotion_distribution e) AS emotion_pie_chart,
                (SELECT jsonb_agg(et) FROM emotion_trend et) AS emotion_line_chart,
                (SELECT jsonb_agg(td) FROM top_destinations td) AS top_destinations,
                (SELECT jsonb_agg(fw) FROM forbidden_words_count fw) AS forbidden_words_table,
                (SELECT jsonb_agg(kw) FROM key_words_count kw) AS key_words_table,
                (SELECT jsonb_agg(ta) FROM top_agent_count ta) AS top_agent_count;
        `;

            const serviceResponse = ServiceResponse.success("Session events retrieved successfully", result);
            return handleServiceResponse(serviceResponse, res);
        } catch (error) {
            console.error(error);
            return handleServiceResponse(ServiceResponse.failure("Error fetching session events", error, StatusCodes.INTERNAL_SERVER_ERROR), res);
        }
    };

}


export const sessionEventController = new SessionEventController();
