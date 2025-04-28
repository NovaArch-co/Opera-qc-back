import type { Request, RequestHandler, Response } from "express";
import { ServiceResponse } from "@/common/models/serviceResponse";
import { handleServiceResponse } from "@/common/utils/httpHandlers";
import { PrismaClient } from "@prisma/client";
import { StatusCodes } from "http-status-codes";
import moment from 'moment-jalaali';
import { Queue } from "bullmq";
import { env } from "@/common/utils/envConfig";
import prisma from "@/common/utils/prisma";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import path from "node:path";
import fs from "node:fs";
import { downloadAndSaveAudio } from "@/common/utils/downloadFileStream";
import FormData from "form-data";
import axios from "axios"; // ✅ Make sure you are using `form-data` package
import { addSequentialJob } from "@/queue/sequentialQueue";

const sessionQueue = new Queue(env.BULL_QUEUE, {
    connection: {
        host: env.REDIS_HOST,
        port: env.REDIS_PORT,
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

            // Add job to sequential queue instead of the regular queue
            const job = await addSequentialJob('process-session', {
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
                message: "Session event processing started (sequential processing)",
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
                topic: (sessionEvent.topic && typeof sessionEvent.topic === 'object' && Object.keys(sessionEvent.topic).length > 0) ? Object.keys(sessionEvent.topic)[0] : "",
                subTopic: (sessionEvent.topic && typeof sessionEvent.topic === 'object' && Object.values(sessionEvent.topic).length > 0) ? Object.values(sessionEvent.topic)[0] : ""
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
            console.log("Fetching sessions with pagination and filters...");

            // Extract pagination parameters from query
            const page = parseInt(req.query.page as string) || 1;
            const limit = parseInt(req.query.limit as string) || 10;
            const offset = (page - 1) * limit;

            // Extract filters from query
            const emotion = req.query.emotion as string | undefined;
            const category = req.query.category as string | undefined;
            const topic = req.query.topic as string | undefined;
            const destNumber = req.query.destNumber as string | undefined;
            const callType = req.query.type as string | undefined;

            console.log("Pagination and filter params:", { page, limit, offset, emotion, category, topic, destNumber, callType });

            // Build conditions for total count and data queries
            let whereConditions: string[] = [];
            let params: any[] = [];
            let paramIndex = 1;

            // Only show fully processed sessions (with transcription data)
            whereConditions.push(`transcription IS NOT NULL`);

            if (emotion) {
                whereConditions.push(`emotion = $${paramIndex}`);
                params.push(emotion);
                paramIndex++;
            }

            if (callType) {
                whereConditions.push(`type = $${paramIndex}`);
                params.push(callType);
                paramIndex++;
            }

            if (category) {
                // For topic filtering, we need to check if the topic JSON contains the category as a key
                // Ensure topic is a JSON object before checking for keys
                whereConditions.push(`(
                    topic IS NOT NULL 
                    AND jsonb_typeof(topic) = 'object'
                    AND topic ? $${paramIndex}
                )`);
                params.push(category);
                paramIndex++;
            }

            if (topic) {
                // For topic subtopic filtering, we need to check if any value in the topic JSON matches the topic
                // Ensure topic is a JSON object before checking values
                whereConditions.push(`(
                    topic IS NOT NULL 
                    AND jsonb_typeof(topic) = 'object'
                    AND EXISTS (
                        SELECT 1
                        FROM jsonb_each_text(topic) AS t
                        WHERE t.value = $${paramIndex}
                    )
                )`);
                params.push(topic);
                paramIndex++;
            }

            if (destNumber) {
                whereConditions.push(`(
                    dest_number = $${paramIndex}
                )`);
                params.push(destNumber);
                paramIndex++;
            }

            const whereClause = whereConditions.length > 0
                ? `WHERE ${whereConditions.join(' AND ')}`
                : '';

            // Get total count for pagination metadata with proper escaping
            const totalCountQuery = `SELECT COUNT(*) as total FROM "SessionEvent" ${whereClause}`;
            const totalCountResult = await prismaClient.$queryRawUnsafe<{ total: number }[]>(
                totalCountQuery,
                ...params
            );
            const totalCount = Number(totalCountResult[0].total || 0);

            // 🛠 Prisma Raw Query to fetch paginated sessions with filters
            const dataQuery = `
                SELECT 
                    id,
                    level,
                    time,
                    pid,
                    hostname,
                    name,
                    type,
                    source_channel AS "sourceChannel",
                    source_number AS "sourceNumber",
                    queue,
                    dest_channel AS "destChannel",
                    dest_number AS "destNumber",
                    date,
                    duration,
                    filename,
                    "incommingfileUrl",
                    "outgoingfileUrl",
                    msg,
                    transcription,
                    explanation,
                    category,
                    topic,
                    emotion,
                    "keyWords",
                    "routinCheckStart",
                    "routinCheckEnd",
                    "forbiddenWords"
                FROM "SessionEvent"
                ${whereClause}
                ORDER BY date DESC
                LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
            `;

            const sessionEvents = await prismaClient.$queryRawUnsafe(
                dataQuery,
                ...params,
                limit,
                offset
            );

            console.log("Fetched Sessions:", (sessionEvents as any[]).length);

            // 🛠 Format URLs properly
            const formattedSessions = (sessionEvents as any[]).map(event => ({
                ...event,
                incommingfileUrl: event.incommingfileUrl ? `${env.MINIO_ENDPOINT_UTL}${event.incommingfileUrl}` : null,
                outgoingfileUrl: event.outgoingfileUrl ? `${env.MINIO_ENDPOINT_UTL}${event.outgoingfileUrl}` : null,
                forbiddenWords: event.forbiddenWords || {},
                topic: event.topic && typeof event.topic === 'object' && Object.keys(event.topic).length > 0
                    ? Object.keys(event.topic)[0]
                    : "",
                subTopic: event.topic && typeof event.topic === 'object' && Object.values(event.topic).length > 0
                    ? Object.values(event.topic)[0]
                    : ""
            }));

            // Add an additional check for empty results
            if (formattedSessions.length === 0) {
                return handleServiceResponse(
                    ServiceResponse.success(
                        "No processed session events found",
                        {
                            data: [],
                            pagination: {
                                currentPage: 1,
                                totalPages: 0,
                                totalItems: 0,
                                limit,
                                hasNextPage: false,
                                hasPrevPage: false,
                                appliedFilters: {
                                    emotion: emotion || null,
                                    category: category || null,
                                    topic: topic || null,
                                    destNumber: destNumber || null
                                }
                            }
                        }
                    ),
                    res
                );
            }

            // Create pagination metadata
            const totalPages = Math.ceil(totalCount / limit);
            const pagination = {
                currentPage: page,
                totalPages,
                totalItems: totalCount,
                limit,
                hasNextPage: page < totalPages,
                hasPrevPage: page > 1,
                appliedFilters: {
                    emotion: emotion || null,
                    category: category || null,
                    topic: topic || null,
                    destNumber: destNumber || null
                }
            };

            return handleServiceResponse(
                ServiceResponse.success(
                    "Session events retrieved successfully",
                    {
                        data: formattedSessions,
                        pagination
                    }
                ),
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
        try {
            console.log("Fetching all data without date filtering...");

            // Check if there are any records in the database at all
            try {
                console.log("Checking if there are any records in the database...");
                const totalRecords = await prismaClient.$queryRaw<{ count: number }[]>`
                    SELECT COUNT(*) as count FROM "SessionEvent"
                `;
                console.log("Total records in database:", totalRecords[0].count);

                if (totalRecords[0].count > 0) {
                    // Get the date range of all records
                    const dateRange = await prismaClient.$queryRaw<{ min_date: Date, max_date: Date }[]>`
                        SELECT 
                            MIN(date) as min_date, 
                            MAX(date) as max_date 
                        FROM "SessionEvent"
                    `;
                    console.log("Date range of all records:", {
                        min_date: dateRange[0].min_date,
                        max_date: dateRange[0].max_date
                    });
                }
            } catch (dbError) {
                console.error("Error checking database records:", dbError);
            }
            try {
                console.log("Executing emotion count query...");
                const emotionCount = await prismaClient.$queryRaw<{ count: number }[]>`
                    SELECT COUNT(*) as count 
                    FROM "SessionEvent" 
                    WHERE emotion IS NOT NULL
                `;
                console.log("Records with emotions:", emotionCount[0].count);
            } catch (emotionError) {
                console.error("Error executing emotion count query:", emotionError);
            }

            console.log("Executing main dashboard query...");
            const result = await prismaClient.$queryRawUnsafe<any[]>(`
            WITH filtered_data AS (
                SELECT * FROM "SessionEvent"
            )
            , emotion_distribution AS (
                SELECT
                    emotion,
                    COUNT(*) AS count
                FROM filtered_data
                WHERE emotion IS NOT NULL
                GROUP BY emotion
            )
            , emotion_trend AS (
                SELECT
                    emotion,
                    TO_CHAR(date, 'YYYY-MM-DD') AS call_date,
                    COUNT(*) AS count
                FROM filtered_data
                WHERE emotion IS NOT NULL
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
                WHERE "keyWords" IS NOT NULL AND array_length("keyWords", 1) > 0
                GROUP BY key_words
                ORDER BY count DESC
            ), forbidden_words_count AS (
                SELECT
                    key AS forbidden_word,
                    SUM(value::int) AS count
                FROM filtered_data,
                LATERAL jsonb_each_text("forbiddenWords")
                WHERE "forbiddenWords" IS NOT NULL
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
                WHERE name IS NOT NULL
                GROUP BY name
                ORDER BY count DESC
            )
            , topic_distribution AS (
                SELECT
                    key AS topic,
                    COUNT(*) AS count
                FROM filtered_data,
                LATERAL jsonb_object_keys(topic) AS key
                WHERE topic IS NOT NULL AND jsonb_typeof(topic) = 'object'
                GROUP BY key
                ORDER BY count DESC
            )
            , topic_trend AS (
                SELECT
                    key AS topic,
                    TO_CHAR(date, 'YYYY-MM-DD') AS call_date,
                    COUNT(*) AS count
                FROM filtered_data,
                LATERAL jsonb_object_keys(topic) AS key
                WHERE topic IS NOT NULL AND jsonb_typeof(topic) = 'object'
                GROUP BY key, call_date
            )
            SELECT
                (SELECT jsonb_agg(e) FROM emotion_distribution e) AS emotion_pie_chart,
                (SELECT jsonb_agg(et) FROM emotion_trend et) AS emotion_line_chart,
                (SELECT jsonb_agg(td) FROM top_destinations td) AS top_destinations,
                (SELECT jsonb_agg(fw) FROM forbidden_words_count fw) AS forbidden_words_table,
                (SELECT jsonb_agg(kw) FROM key_words_count kw) AS key_words_table,
                (SELECT jsonb_agg(ta) FROM top_agent_count ta) AS top_agent_count,
                (SELECT jsonb_agg(tp) FROM topic_distribution tp) AS topic_pie_chart,
                (SELECT jsonb_agg(tt) FROM topic_trend tt) AS topic_line_chart;
            `);

            console.log("Query result:", JSON.stringify(result[0], null, 2));

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
            const topicLineChart = formatLineChart(result[0]?.topic_line_chart || [], "topic");
            const responseData = {
                emotion_pie_chart: result[0]?.emotion_pie_chart || [],
                emotion_line_chart: emotionLineChart,
                topic_line_chart: topicLineChart,
                top_destinations: result[0]?.top_destinations || [],
                forbidden_words_table: result[0]?.forbidden_words_table || [],
                key_words_table: result[0]?.key_words_table || [],
                top_agent_count: result[0]?.top_agent_count || [],
                topic_pie_chart: result[0]?.topic_pie_chart || [],
            };
            const serviceResponse = ServiceResponse.success("Session events retrieved successfully", responseData);
            return handleServiceResponse(serviceResponse, res);
        } catch (error) {
            console.error("Error in getSessionsByFilter:", error);
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

            // First try to get job from the original queue
            let job = await sessionQueue.getJob(jobId);
            let queueType = "standard";

            // If not found, try the sequential queue
            if (!job) {
                const { sequentialQueue } = await import('@/queue/sequentialQueue');
                job = await sequentialQueue.getJob(jobId);
                queueType = "sequential";
            }

            if (!job) {
                return res.status(StatusCodes.NOT_FOUND).json({
                    success: false,
                    message: "Job not found in any queue",
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
                    queueType,
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

    public getDistinctCategories: RequestHandler = async (req: Request, res: Response) => {
        try {
            console.log("Fetching distinct categories...");

            // Query to extract distinct keys from the topic JSON field
            // Added check for jsonb_typeof to ensure topic is a JSON object
            const query = `
                SELECT DISTINCT jsonb_object_keys(topic) AS category
                FROM "SessionEvent"
                WHERE topic IS NOT NULL AND jsonb_typeof(topic) = 'object'
                ORDER BY category
            `;

            const categories = await prismaClient.$queryRawUnsafe<{ category: string }[]>(query);

            console.log(`Found ${categories.length} distinct categories`);

            return handleServiceResponse(
                ServiceResponse.success(
                    "Categories retrieved successfully",
                    categories.map(row => row.category)
                ),
                res
            );
        } catch (error) {
            console.error("Error fetching distinct categories:", error);
            return handleServiceResponse(
                ServiceResponse.failure("Error fetching categories", error, StatusCodes.INTERNAL_SERVER_ERROR),
                res
            );
        }
    };

    public getDistinctTopics: RequestHandler = async (req: Request, res: Response) => {
        try {
            console.log("Fetching distinct topics (subtopics)...");

            // Query to extract distinct values from the topic JSON field
            // Added check for jsonb_typeof to ensure topic is a JSON object
            const query = `
                SELECT DISTINCT t.value AS topic
                FROM "SessionEvent"
                CROSS JOIN LATERAL jsonb_each_text(topic) AS t
                WHERE topic IS NOT NULL AND jsonb_typeof(topic) = 'object'
                ORDER BY topic
            `;

            const topics = await prismaClient.$queryRawUnsafe<{ topic: string }[]>(query);

            console.log(`Found ${topics.length} distinct topics`);

            return handleServiceResponse(
                ServiceResponse.success(
                    "Topics retrieved successfully",
                    topics.map(row => row.topic)
                ),
                res
            );
        } catch (error) {
            console.error("Error fetching distinct topics:", error);
            return handleServiceResponse(
                ServiceResponse.failure("Error fetching topics", error, StatusCodes.INTERNAL_SERVER_ERROR),
                res
            );
        }
    };

    public getDistinctDestNumbers: RequestHandler = async (req: Request, res: Response) => {
        try {
            console.log("Fetching distinct destination numbers for incoming calls...");

            // Query to get distinct destination numbers only for incoming calls
            const query = `
                SELECT DISTINCT dest_number
                FROM "SessionEvent"
                WHERE dest_number IS NOT NULL AND type = 'incoming'
                ORDER BY dest_number
            `;

            const destNumbers = await prismaClient.$queryRawUnsafe<{ dest_number: string }[]>(query);

            console.log(`Found ${destNumbers.length} distinct destination numbers for incoming calls`);

            // Convert any potential BigInt values
            const safeDestNumbers = this.convertBigIntToNumber(destNumbers);

            return handleServiceResponse(
                ServiceResponse.success(
                    "Destination numbers for incoming calls retrieved successfully",
                    safeDestNumbers.map((row: { dest_number: string }) => row.dest_number)
                ),
                res
            );
        } catch (error) {
            console.error("Error fetching distinct destination numbers:", error);
            return handleServiceResponse(
                ServiceResponse.failure("Error fetching destination numbers", error, StatusCodes.INTERNAL_SERVER_ERROR),
                res
            );
        }
    };

    // Helper function to convert BigInt to Number recursively in objects and arrays
    private convertBigIntToNumber(data: any): any {
        if (data === null || data === undefined) {
            return data;
        }

        if (typeof data === 'bigint') {
            return Number(data);
        }

        if (Array.isArray(data)) {
            return data.map(item => this.convertBigIntToNumber(item));
        }

        if (typeof data === 'object') {
            const result: any = {};
            for (const key in data) {
                if (Object.prototype.hasOwnProperty.call(data, key)) {
                    result[key] = this.convertBigIntToNumber(data[key]);
                }
            }
            return result;
        }

        return data;
    }

    public getSessionStats: RequestHandler = async (req: Request, res: Response) => {
        try {
            console.log("Fetching session statistics...");

            // Query to get call count and agent count (only count agents for incoming calls)
            const basicStatsQuery = `
                SELECT 
                    COUNT(*) AS total_calls,
                    COUNT(DISTINCT CASE WHEN type = 'incoming' THEN dest_number ELSE NULL END) AS total_agents
                FROM "SessionEvent"
                WHERE dest_number IS NOT NULL
            `;

            const basicStats = await prismaClient.$queryRawUnsafe<{
                total_calls: bigint,
                total_agents: bigint
            }[]>(basicStatsQuery);

            // Query to get top emotion - ensuring we don't count null emotions
            const topEmotionQuery = `
                SELECT 
                    emotion AS top_emotion,
                    COUNT(*) as top_emotion_count
                FROM "SessionEvent"
                WHERE emotion IS NOT NULL AND TRIM(emotion) != ''
                GROUP BY emotion
                ORDER BY top_emotion_count DESC
                LIMIT 1
            `;

            const emotionStats = await prismaClient.$queryRawUnsafe<{
                top_emotion: string,
                top_emotion_count: bigint
            }[]>(topEmotionQuery);

            // Query to get distinct category count (using LATERAL approach)
            // Added check for jsonb_typeof to ensure topic is a JSON object
            const categoryCountQuery = `
                SELECT COUNT(DISTINCT category) AS distinct_categories
                FROM (
                    SELECT jsonb_object_keys(topic) AS category
                    FROM "SessionEvent"
                    WHERE topic IS NOT NULL AND jsonb_typeof(topic) = 'object'
                ) AS categories
            `;

            const categoryStats = await prismaClient.$queryRawUnsafe<{
                distinct_categories: bigint
            }[]>(categoryCountQuery);

            // Query to get distinct topic count (using LATERAL approach)
            // Added check for jsonb_typeof to ensure topic is a JSON object
            const topicCountQuery = `
                SELECT COUNT(DISTINCT topic_value) AS distinct_topics
                FROM (
                    SELECT t.value AS topic_value
                    FROM "SessionEvent"
                    CROSS JOIN LATERAL jsonb_each_text(topic) AS t
                    WHERE topic IS NOT NULL AND jsonb_typeof(topic) = 'object'
                ) AS topics
            `;

            const topicStats = await prismaClient.$queryRawUnsafe<{
                distinct_topics: bigint
            }[]>(topicCountQuery);

            console.log("Raw emotion stats:", this.convertBigIntToNumber(emotionStats));

            // Convert BigInt to Number in all query results
            const safeBasicStats = this.convertBigIntToNumber(basicStats[0]) || { total_calls: 0, total_agents: 0 };
            const safeEmotionStats = this.convertBigIntToNumber(emotionStats[0]) || { top_emotion: null, top_emotion_count: 0 };
            const safeCategoryStats = this.convertBigIntToNumber(categoryStats[0]) || { distinct_categories: 0 };
            const safeTopicStats = this.convertBigIntToNumber(topicStats[0]) || { distinct_topics: 0 };

            // Combine all statistics with safe values
            const combinedStats = {
                total_calls: safeBasicStats.total_calls,
                total_agents: safeBasicStats.total_agents,
                top_emotion: safeEmotionStats.top_emotion,
                top_emotion_count: safeEmotionStats.top_emotion_count,
                distinct_categories: safeCategoryStats.distinct_categories,
                distinct_topics: safeTopicStats.distinct_topics
            };

            // Add fallback logic for the top_emotion field
            if (combinedStats.top_emotion === null && combinedStats.top_emotion_count > 0) {
                combinedStats.top_emotion = "unknown";
            }

            console.log("Statistics fetched successfully:", combinedStats);

            return handleServiceResponse(
                ServiceResponse.success("Session statistics retrieved successfully", combinedStats),
                res
            );
        } catch (error) {
            console.error("Error fetching session statistics:", error);
            return handleServiceResponse(
                ServiceResponse.failure("Error fetching session statistics", error, StatusCodes.INTERNAL_SERVER_ERROR),
                res
            );
        }
    };

    public getAudioFile: RequestHandler = async (req: Request, res: Response) => {
        try {
            const filename = req.params.filename;

            // Validate the filename to prevent directory traversal attacks
            if (!filename || filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
                return handleServiceResponse(
                    ServiceResponse.failure("Invalid filename", {}, StatusCodes.BAD_REQUEST),
                    res
                );
            }

            // Build the complete file path
            const audioDirectory = '/home/afeai/conversations';
            let filePath = path.join(audioDirectory, filename);

            console.log(`Attempting to access audio file: ${filePath}`);

            // Check if directory exists
            if (!fs.existsSync(audioDirectory)) {
                console.error(`Audio directory does not exist: ${audioDirectory}`);
                return handleServiceResponse(
                    ServiceResponse.failure("Audio directory not found", {}, StatusCodes.NOT_FOUND),
                    res
                );
            }

            // List files in the directory to help with debugging
            try {
                const files = fs.readdirSync(audioDirectory);
                console.log(`Files in ${audioDirectory}:`, files.slice(0, 10)); // Show first 10 files
                console.log(`Total files in directory: ${files.length}`);

                // Check if the file exists with case-insensitive search
                const fileExists = files.some(file => file.toLowerCase() === filename.toLowerCase());
                if (fileExists) {
                    console.log(`File exists with different case sensitivity`);
                    // Find the actual filename with correct case
                    const actualFilename = files.find(file => file.toLowerCase() === filename.toLowerCase());
                    if (actualFilename) {
                        console.log(`Using actual filename: ${actualFilename}`);
                        // Update the file path with the correct case
                        filePath = path.join(audioDirectory, actualFilename);
                    }
                }
            } catch (err) {
                console.error(`Error reading directory: ${audioDirectory}`, err);
            }

            // Check if the file exists
            if (!fs.existsSync(filePath)) {
                console.error(`Audio file not found: ${filePath}`);
                return handleServiceResponse(
                    ServiceResponse.failure(`Audio file not found: ${filename}`, {}, StatusCodes.NOT_FOUND),
                    res
                );
            }

            console.log(`File found, preparing to stream: ${filePath}`);

            // Set the appropriate headers
            res.setHeader('Content-Type', 'audio/wav');
            res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

            // Create a read stream and pipe it to the response
            const fileStream = fs.createReadStream(filePath);
            fileStream.pipe(res);

            // Handle errors on the stream
            fileStream.on('error', (error) => {
                console.error(`Error streaming audio file ${filename}:`, error);
                if (!res.headersSent) {
                    handleServiceResponse(
                        ServiceResponse.failure("Error streaming audio file", error, StatusCodes.INTERNAL_SERVER_ERROR),
                        res
                    );
                }
            });
        } catch (error) {
            console.error(`Error serving audio file:`, error);
            return handleServiceResponse(
                ServiceResponse.failure("Error serving audio file", error, StatusCodes.INTERNAL_SERVER_ERROR),
                res
            );
        }
    };

    public checkAudioFile: RequestHandler = async (req: Request, res: Response) => {
        try {
            const filename = req.params.filename;

            // Validate the filename
            if (!filename || filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
                return res.json({
                    status: 'error',
                    message: 'Invalid filename',
                    details: {
                        filename,
                        validation: 'failed'
                    }
                });
            }

            const audioDirectory = '/home/afeai/conversations';
            const filePath = path.join(audioDirectory, filename);

            // Check directory
            const dirExists = fs.existsSync(audioDirectory);
            let dirStats: fs.Stats | null = null;
            let dirPermissions: string | null = null;
            let directoryFiles: string[] = [];

            if (dirExists) {
                try {
                    dirStats = fs.statSync(audioDirectory);
                    dirPermissions = '0' + (dirStats.mode & parseInt('777', 8)).toString(8);

                    // List files that match similar pattern to help debugging
                    const allFiles = fs.readdirSync(audioDirectory);
                    // Get first 20 files and any that are similar to the requested filename
                    directoryFiles = allFiles
                        .filter(file => file.includes(filename.split('-')[0]) || directoryFiles.length < 20)
                        .slice(0, 20);
                } catch (error) {
                    console.error('Error getting directory info:', error);
                }
            }

            // Check file existence
            const fileExists = fs.existsSync(filePath);
            let fileStats: fs.Stats | null = null;
            let filePermissions: string | null = null;
            let fileContent: string | null = null;

            if (fileExists) {
                try {
                    fileStats = fs.statSync(filePath);
                    filePermissions = '0' + (fileStats.mode & parseInt('777', 8)).toString(8);

                    // Try to access file
                    try {
                        // Read just the first 100 bytes to check if we can access the file
                        const fd = fs.openSync(filePath, 'r');
                        const buffer = Buffer.alloc(100);
                        fs.readSync(fd, buffer, 0, 100, 0);
                        fs.closeSync(fd);
                        fileContent = 'First 100 bytes readable';
                    } catch (readError: any) {
                        fileContent = `Error reading file: ${readError.message}`;
                    }
                } catch (error) {
                    console.error('Error getting file info:', error);
                }
            }

            // Check for similar files (case insensitive)
            let similarFile: { name: string; exactMatch: boolean; caseDifference: boolean } | null = null;
            if (dirExists && !fileExists) {
                try {
                    const files = fs.readdirSync(audioDirectory);
                    const match = files.find(file => file.toLowerCase() === filename.toLowerCase());
                    if (match) {
                        similarFile = {
                            name: match,
                            exactMatch: match === filename,
                            caseDifference: match !== filename
                        };
                    }
                } catch (error) {
                    console.error('Error looking for similar files:', error);
                }
            }

            // Check process permissions
            const processInfo = {
                uid: process.getuid ? process.getuid() : 'Not available',
                gid: process.getgid ? process.getgid() : 'Not available',
                cwd: process.cwd(),
                execPath: process.execPath
            };

            // Check directory readability
            let dirReadable = false;
            try {
                fs.accessSync(audioDirectory, fs.constants.R_OK);
                dirReadable = true;
            } catch (err) {
                dirReadable = false;
            }

            return res.json({
                status: 'success',
                diagnostics: {
                    requestedFile: {
                        filename,
                        fullPath: filePath
                    },
                    directory: {
                        path: audioDirectory,
                        exists: dirExists,
                        stats: dirStats,
                        permissions: dirPermissions,
                        readable: dirReadable,
                        sampleFiles: directoryFiles
                    },
                    file: {
                        exists: fileExists,
                        stats: fileStats,
                        permissions: filePermissions,
                        sizeBytes: fileExists && fileStats ? fileStats.size : null,
                        readable: fileContent !== null,
                        content: fileContent
                    },
                    similarFile,
                    process: processInfo
                }
            });
        } catch (error: any) {
            console.error('Error in checkAudioFile:', error);
            return res.status(500).json({
                status: 'error',
                message: 'Server error checking audio file',
                error: {
                    message: error.message,
                    stack: error.stack
                }
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

        const response = await axios.post("http://5.202.171.177:8000/transcribe/", form, {
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

        const response = await axios.post("http://5.202.171.177:8000/analyze/", transcriptionData, {
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
