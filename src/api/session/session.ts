import type { Request, RequestHandler, Response } from "express";
import { ServiceResponse } from "@/common/models/serviceResponse";
import { handleServiceResponse } from "@/common/utils/httpHandlers";
import { PrismaClient } from "@prisma/client";
import { StatusCodes } from "http-status-codes";
import moment from 'moment-jalaali';
import { createApiResponse } from "@/common/utils/createApiResponse";
import { Queue } from "bullmq";
import { env } from "@/common/utils/envConfig";
import prisma from "@/common/utils/prisma";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import path from "node:path";
import fs from "node:fs";
import { downloadAndSaveAudio } from "@/common/utils/downloadFileStream";
import FormData from "form-data";
import axios from "axios"; // ✅ Make sure you are using `form-data` package

const sessionQueue = new Queue(env.BULL_QUEUE, {
    connection: {
        host: env.REDIS_HOST,
        port: parseInt(env.REDIS_PORT, 10),
    }
});

const prismaClient = new PrismaClient();

const s3Client = new S3Client({
    region: "us-east-1",
    endpoint: env.MINIO_ENDPOINT_UTL,
    credentials: {
        accessKeyId: env.MINIO_ACCESS_KEY || "minioaccesskey",
        secretAccessKey: env.MINIO_SECRET_KEY || "miniosecretkey",
    },
    forcePathStyle: true,
    tls: false,
});

const BUCKET_NAME = "audio-files";

export class SessionEventController {

    public createSessionEvent = async (req: Request, res: Response) => {
        try {
            const {
                type,
                source_channel,
                source_number,
                queue,
                dest_channel,
                dest_number,
                date,
                duration,
                filename
            } = req.body;

            // Validate required fields
            if (!type || !source_channel || !source_number || !queue || !dest_channel || !dest_number || !date || !duration || !filename) {
                return res.status(StatusCodes.BAD_REQUEST).json({
                    success: false,
                    message: "Missing required fields",
                    data: null,
                    statusCode: StatusCodes.BAD_REQUEST
                });
            }

            // Convert date to ISO format
            const isoDate = moment(date, 'YYYY-MM-DD HH:mm:ss').toDate();

            // Add job to queue
            const job = await sessionQueue.add('process-session', {
                type,
                sourceChannel: source_channel,
                sourceNumber: source_number,
                queue,
                destChannel: dest_channel,
                destNumber: dest_number,
                date: isoDate,
                duration,
                filename
            });

            return res.status(StatusCodes.OK).json({
                success: true,
                message: "Session event processing started",
                data: {
                    jobId: job.id,
                    status: "waiting"
                },
                statusCode: StatusCodes.OK
            });
        } catch (error) {
            console.error('Error creating session event:', error);
            return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
                success: false,
                message: "Error processing session event",
                data: null,
                statusCode: StatusCodes.INTERNAL_SERVER_ERROR
            });
        }
    };

    public getSessionEventById: RequestHandler = async (req: Request, res: Response) => {
        const { id } = req.params;

        try {
            let sessionEvent = await prismaClient.sessionEvent.findUnique({
                where: { id: Number(id) },
            });

            if (!sessionEvent) {
                return handleServiceResponse(ServiceResponse.failure("Session event not found", {}, StatusCodes.NOT_FOUND), res);
            }

            const incommingfileUrl = `${env.MINIO_ENDPOINT_UTL}${sessionEvent.incommingfileUrl}`
            const outgoingfileUrl = `${env.MINIO_ENDPOINT_UTL}${sessionEvent.outgoingfileUrl}`
            let sessionEvents = {
                ...sessionEvent,
                incommingfileUrl,
                outgoingfileUrl,
                forbiddenWords: sessionEvent.forbiddenWords ? sessionEvent.forbiddenWords : {},
                topic: (Object.keys(sessionEvent.topic).length > 0) ? Object.keys(sessionEvent.topic)[0] : "",
                subTopic: (Object.values(sessionEvent.topic).length > 0) ? Object.values(sessionEvent.topic)[0] : ""
            }
            const serviceResponse = ServiceResponse.success("Session event retrieved successfully", sessionEvents);
            return handleServiceResponse(serviceResponse, res);
        } catch (error) {
            console.log(error);
            return handleServiceResponse(ServiceResponse.failure("Error fetching session event", error, StatusCodes.INTERNAL_SERVER_ERROR), res);
        }
    };

    public getSessions: RequestHandler = async (req: Request, res: Response) => {
        try {
            let { from, to } = req.query;

            // 🛠 Default to last 7 days if no params provided
            if (!from && !to) {
                from = moment().subtract(7, "days").format("jYYYY-jMM-jDD");
                to = moment().format("jYYYY-jMM-jDD");
            } else if (!from && to) {
                from = moment(to, "jYYYY-jMM-jDD").subtract(7, "days").format("jYYYY-jMM-jDD");
            } else if (!to && from) {
                to = moment().format("jYYYY-jMM-jDD") + "T00:00.000Z";
            }

            console.log("Received Jalali Dates:", { from, to });

            // 🛠 Prisma Raw Query to fetch sessions
            const sessionEvents = await prismaClient.$queryRaw`
            SELECT * FROM "SessionEvent"
            WHERE date BETWEEN ${from}::TIMESTAMP AND ${to}::TIMESTAMP
            ORDER BY date DESC
        `;

            console.log("Fetched Sessions:", sessionEvents.length);

            // 🛠 Format URLs properly
            const formattedSessions = sessionEvents.map(event => ({
                ...event,
                incommingfileUrl: event.incommingfileUrl ? `${env.MINIO_ENDPOINT_UTL}${event.incommingfileUrl}` : null,
                outgoingfileUrl: event.outgoingfileUrl ? `${env.MINIO_ENDPOINT_UTL}${event.outgoingfileUrl}` : null,
                forbiddenWords: event.forbiddenWords || {},
                topic: event.topic && Object.keys(event.topic).length > 0 ? Object.keys(event.topic)[0] : "",
                subTopic: (Object.values(event.topic).length > 0) ? Object.values(event.topic)[0] : ""
            }));

            return handleServiceResponse(
                ServiceResponse.success("Session events retrieved successfully", formattedSessions),
                res
            );

        } catch (error) {
            console.error("Error fetching session events:", error);
            return handleServiceResponse(
                ServiceResponse.failure("Error fetching session events", error, StatusCodes.INTERNAL_SERVER_ERROR),
                res
            );
        }
    };


    public getSessionsByFilter: RequestHandler = async (req: Request, res: Response) => {
        let { from, to } = req.query;

        if (!from && !to) {
            from = moment().subtract(7, "days").format("jYYYY-jMM-jDD");
            to = moment().format("jYYYY-jMM-jDD");
        } else if (!from && to) {
            from = moment().subtract(7, "days").format("jYYYY-jMM-jDD");
        } else if (!to && from) {
            to = moment().format("jYYYY-jMM-jDD");
        }

        console.log("Jalali Dates:", { from, to });

        // Convert Jalali to Gregorian before querying the database
        // const fromGregorian = moment(from, "jYYYY-jMM-jDD").startOf("day").format("YYYY-MM-DD HH:mm:ss");
        // const toGregorian = moment(to, "jYYYY-jMM-jDD").endOf("day").format("YYYY-MM-DD HH:mm:ss");


        // from = from + "T00:00.000Z";
        // to = to + "T00:00.000Z";

        try {

            const result = await prismaClient.$queryRaw`
            WITH filtered_data AS (
                SELECT * FROM "SessionEvent"
                               WHERE date BETWEEN ${from}::TIMESTAMP AND ${to}::TIMESTAMP
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
                    TO_CHAR(date, 'YYYY-MM-DD') AS call_date,
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
                (SELECT jsonb_agg(e) FROM emotion_distribution e) AS emotion_pie_chart,
                (SELECT jsonb_agg(et) FROM emotion_trend et) AS emotion_line_chart,
                (SELECT jsonb_agg(td) FROM top_destinations td) AS top_destinations,
                (SELECT jsonb_agg(fw) FROM forbidden_words_count fw) AS forbidden_words_table,
                (SELECT jsonb_agg(kw) FROM key_words_count kw) AS key_words_table,
                (SELECT jsonb_agg(ta) FROM top_agent_count ta) AS top_agent_count;
        `;

            const formatLineChart = (data: any[], keyField: string) => {
                const transformedData: Record<string, Record<string, number>> = {};
                data.forEach(({ call_date, [keyField]: key, count }) => {
                    if (!transformedData[call_date]) {
                        transformedData[call_date] = {};
                    }
                    transformedData[call_date][key] = count;
                });
                return transformedData;
            };

            const emotionLineChart = formatLineChart(result[0]?.emotion_line_chart || [], "emotion");
            const responseData = {
                emotion_pie_chart: result[0]?.emotion_pie_chart || [],
                emotion_line_chart: emotionLineChart,
                top_destinations: result[0]?.top_destinations || [],
                forbidden_words_table: result[0]?.forbidden_words_table || [],
                key_words_table: result[0]?.key_words_table || [],
                top_agent_count: result[0]?.top_agent_count || [],
            };
            const serviceResponse = ServiceResponse.success("Session events retrieved successfully", responseData);
            return handleServiceResponse(serviceResponse, res);
        } catch (error) {
            console.error(error);
            return handleServiceResponse(ServiceResponse.failure("Error fetching session events", error, StatusCodes.INTERNAL_SERVER_ERROR), res);
        }
    };

    public getJobStatus = async (req: Request, res: Response) => {
        try {
            const { jobId } = req.params;

            if (!jobId) {
                return res.status(StatusCodes.BAD_REQUEST).json({
                    success: false,
                    message: "Job ID is required",
                    data: null,
                    statusCode: StatusCodes.BAD_REQUEST
                });
            }

            const job = await sessionQueue.getJob(jobId);

            if (!job) {
                return res.status(StatusCodes.NOT_FOUND).json({
                    success: false,
                    message: "Job not found",
                    data: null,
                    statusCode: StatusCodes.NOT_FOUND
                });
            }

            const state = await job.getState();
            const progress = job.progress;
            const result = job.returnvalue;
            const failedReason = job.failedReason;

            return res.status(StatusCodes.OK).json({
                success: true,
                message: "Job status retrieved successfully",
                data: {
                    jobId: job.id,
                    state,
                    progress,
                    result,
                    failedReason
                },
                statusCode: StatusCodes.OK
            });
        } catch (error) {
            console.error('Error getting job status:', error);
            return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
                success: false,
                message: "Error retrieving job status",
                data: null,
                statusCode: StatusCodes.INTERNAL_SERVER_ERROR
            });
        }
    };

}


// Export the functions that will be used by the queue worker
export const sendAudioRequests = async (fileName: string, type: "incoming" | "outgoing", filePath: string) => {
    const username = "FaraErtebat";
    const password = "Goz@r!AsreFar@Erteb@t!1403";
    const auth = {
        username,
        password,
    };

    try {
        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        await downloadAndSaveAudio(`${fileName}`, filePath, auth);

    } catch (error) {
        console.error("Error sending audio requests:", error);
    }
};

export const uploadToMinIO = async (filePath: string, objectName: string) => {
    try {
        if (!fs.existsSync(filePath)) {
            console.error(`File not found: ${filePath}`);
            return null;
        }

        const fileStream = fs.createReadStream(filePath);
        const stats = fs.statSync(filePath);

        const command = new PutObjectCommand({
            Bucket: BUCKET_NAME,
            Key: objectName,
            Body: fileStream,
            ContentType: "audio/wav",
            ContentLength: stats.size
        });

        await s3Client.send(command);

        // Return MinIO URL
        return `/${BUCKET_NAME}/${objectName}`;
    } catch (error) {
        console.error("Error uploading to MinIO:", error);
        return null;
    }
};

export const sendFilesToTranscriptionAPI = async (filePathIn: string, filePathOut: string) => {
    try {
        if (!fs.existsSync(filePathIn) || !fs.existsSync(filePathOut)) {
            console.error(`One or both files not found: ${filePathIn}, ${filePathOut}`);
            return null;
        }

        const form = new FormData();

        // Get file stats (size) to help FormData handle streams
        const fileStatIn = fs.statSync(filePathIn);
        const fileStatOut = fs.statSync(filePathOut);

        form.append("customer", fs.createReadStream(filePathIn));
        form.append("agent", fs.createReadStream(filePathOut));

        const response = await axios.post("http://sleepy_greider:8000/transcribe/", form, {
            headers: {
                ...form.getHeaders(),
            },
        });

        return response.data;
    } catch (error: any) {
        console.error("Error sending files to transcription API:", error.response?.data || error.message);
        return null;
    }
};

export const sendToAnalysisAPI = async (transcriptionData: any) => {
    try {
        if (!transcriptionData) {
            console.error("No transcription data provided");
            return null;
        }

        const response = await axios.post("http://sleepy_greider:8000/analyze/", transcriptionData, {
            headers: {
                "Content-Type": "application/json",
                "Accept": "application/json",
            },
        });

        return response.data;
    } catch (error: any) {
        console.error("Error sending transcription to analysis API:", error.response?.data || error.message);
        return null;
    }
};

export const sessionEventController = new SessionEventController();
