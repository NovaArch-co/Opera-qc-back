import { Queue, Worker } from 'bullmq';
import { env } from '@/common/utils/envConfig';
import axios from 'axios';
import { PrismaClient } from '@prisma/client';
import { S3Client, PutObjectCommand, HeadBucketCommand, CreateBucketCommand } from '@aws-sdk/client-s3';
import path from 'node:path';
import fs from 'fs';
import os from 'os';
import { uploadToMinIO, sendFilesToTranscriptionAPI, sendToAnalysisAPI } from '@/api/session/session';
import { TranscriptionResponseSchema, AnalysisResponseSchema } from '@/api/session/sessionModel';

const prisma = new PrismaClient();

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

// Initialize bucket if it doesn't exist
async function ensureBucketExists() {
    try {
        // Check if bucket exists
        await s3Client.send(new HeadBucketCommand({ Bucket: BUCKET_NAME }));
        console.log(`Bucket ${BUCKET_NAME} already exists`);
    } catch (error: any) {
        // If bucket doesn't exist (404) or we can't access it
        if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
            try {
                // Create the bucket
                await s3Client.send(new CreateBucketCommand({ Bucket: BUCKET_NAME }));
                console.log(`Bucket ${BUCKET_NAME} created successfully`);
            } catch (createError) {
                console.error(`Error creating bucket ${BUCKET_NAME}:`, createError);
                throw createError;
            }
        } else {
            console.error(`Error checking bucket ${BUCKET_NAME}:`, error);
            throw error;
        }
    }
}

// Ensure bucket exists on startup
ensureBucketExists().catch(error => {
    console.error("Failed to initialize MinIO bucket:", error);
});

// Create a new queue for sequential processing
export const sequentialQueue = new Queue('sequential-processing', {
    connection: {
        host: env.REDIS_HOST || 'localhost',
        port: env.REDIS_PORT,
    },
    defaultJobOptions: {
        // By default, BullMQ tries to process jobs concurrently (if concurrency > 1)
        // Here we don't need any special options besides the worker concurrency setting
    }
});

// Create a worker with concurrency 1 to ensure sequential processing
export const sequentialWorker = new Worker(
    'sequential-processing',
    async (job) => {
        try {
            console.log(`Starting sequential job ${job.id} with data:`, job.data);

            // Process the job based on its type
            const { type, data } = job.data;

            switch (type) {
                case 'process-session':
                    return await processSessionJob(data);

                case 'analyze-audio':
                    return await analyzeAudioJob(data);

                default:
                    console.log(`Unknown job type: ${type}`);
                    return {
                        success: false,
                        error: `Unknown job type: ${type}`
                    };
            }
        } catch (error) {
            console.error(`Error processing sequential job ${job.id}:`, error);
            throw error;
        }
    },
    {
        connection: {
            host: env.REDIS_HOST || 'localhost',
            port: env.REDIS_PORT,
        },
        // The critical setting: concurrency 1 ensures jobs are processed one at a time
        concurrency: 1,
        removeOnComplete: { count: 1000 },
        removeOnFail: { count: 5000 }
    }
);

// Set up event handlers
sequentialWorker.on('completed', (job) => {
    if (job) {
        console.log(`Sequential job ${job.id} completed successfully`);
    }
});

sequentialWorker.on('failed', (job, error) => {
    if (job) {
        console.error(`Sequential job ${job.id} failed with error:`, error);
    } else {
        console.error('A job failed with error:', error);
    }
});

// Helper function to add a job to the sequential queue
export async function addSequentialJob(type: string, data: any, options = {}) {
    return await sequentialQueue.add(`${type}-job`, { type, data }, options);
}

// Processing function for session jobs
async function processSessionJob(jobData: any) {
    try {
        const {
            type,
            sourceChannel,
            sourceNumber,
            queue,
            destChannel,
            destNumber,
            date,
            duration,
            filename
        } = jobData;

        console.log("Processing session job with data:", jobData);

        // Handle cases where fields might be undefined
        const sourceChannelValue = sourceChannel || "";
        const sourceNumberValue = sourceNumber || "";
        const destChannelValue = destChannel || "";
        const destNumberValue = destNumber || "";
        const queueValue = queue || "";

        // Basic auth credentials for file server
        const auth = {
            username: "FaraErtebat",
            password: "Goz@r!AsreFar@Erteb@t!1403"
        };

        // Download audio file from file server
        const baseFileName = filename.replace(".wav", "");

        // Download customer file (-in)
        const customerFileUrl = `${env.FILE_SERVER_BASE_URL}${baseFileName}-in`;
        console.log("Downloading customer file from:", customerFileUrl);
        const customerResponse = await axios.get(customerFileUrl, {
            responseType: 'arraybuffer',
            auth: auth
        });
        const customerAudioBuffer = Buffer.from(customerResponse.data);

        // Download agent file (-out)
        const agentFileUrl = `${env.FILE_SERVER_BASE_URL}${baseFileName}-out`;
        console.log("Downloading agent file from:", agentFileUrl);
        const agentResponse = await axios.get(agentFileUrl, {
            responseType: 'arraybuffer',
            auth: auth
        });
        const agentAudioBuffer = Buffer.from(agentResponse.data);

        // Create temporary files for transcription
        const tempDir = path.join(os.tmpdir(), 'opera-qc');
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }

        // Save customer file
        const customerFilePath = path.join(tempDir, `${baseFileName}-in.wav`);
        fs.writeFileSync(customerFilePath, customerAudioBuffer);

        // Save agent file
        const agentFilePath = path.join(tempDir, `${baseFileName}-out.wav`);
        fs.writeFileSync(agentFilePath, agentAudioBuffer);

        // Upload files to MinIO
        const customerKey = `${baseFileName}-in.wav`;
        const agentKey = `${baseFileName}-out.wav`;

        // Ensure bucket exists before uploading
        await ensureBucketExists();

        // Upload customer file to MinIO
        await s3Client.send(
            new PutObjectCommand({
                Bucket: BUCKET_NAME,
                Key: customerKey,
                Body: customerAudioBuffer,
                ContentType: 'audio/wav'
            })
        );
        console.log("Uploaded customer file to MinIO:", customerKey);

        // Upload agent file to MinIO
        await s3Client.send(
            new PutObjectCommand({
                Bucket: BUCKET_NAME,
                Key: agentKey,
                Body: agentAudioBuffer,
                ContentType: 'audio/wav'
            })
        );
        console.log("Uploaded agent file to MinIO:", agentKey);

        // Create session event in database
        const sessionEvent = await prisma.sessionEvent.create({
            data: {
                level: 30, // Default log level (info)
                time: new Date().toISOString(),
                pid: process.pid,
                hostname: os.hostname(),
                name: "SESSION_EVENT",
                msg: `Call recorded: ${filename}`,
                type,
                sourceChannel: sourceChannelValue,
                sourceNumber: sourceNumberValue,
                queue: queueValue,
                destChannel: destChannelValue,
                destNumber: destNumberValue,
                date: new Date(date),
                duration,
                filename,
                keyWords: [] // Initialize with empty array
            }
        });

        console.log("Created session event:", sessionEvent);

        // Now add a job to analyze the audio (this will be picked up next in sequence)
        await addSequentialJob('analyze-audio', {
            sessionEventId: sessionEvent.id,
            customerFilePath,
            agentFilePath,
            filename
        });

        // Clean up resources for this part
        return {
            success: true,
            sessionEventId: sessionEvent.id,
            message: "Session processing completed, analysis queued"
        };
    } catch (error) {
        console.error("Error processing session:", error);
        throw error;
    }
}

// Processing function for audio analysis jobs
async function analyzeAudioJob(jobData: any) {
    try {
        const { sessionEventId, customerFilePath, agentFilePath, filename } = jobData;

        console.log(`Analyzing audio files for session ${sessionEventId}`);

        // Step 1: Send files to transcription API
        console.log("Sending files to transcription API...");
        const transcriptionResult = await sendFilesToTranscriptionAPI(customerFilePath, agentFilePath);
        console.log("Transcription Result:", transcriptionResult);

        if (!transcriptionResult) {
            return {
                success: false,
                error: "Transcription failed"
            };
        }

        // Step 2: Send transcription to analysis API
        console.log("Transcription complete, sending for analysis...");
        const analysisResult = await sendToAnalysisAPI(transcriptionResult);
        console.log("Analysis Result:", analysisResult);

        if (!analysisResult) {
            return {
                success: false,
                error: "Analysis failed"
            };
        }

        // Parse and validate the transcription and analysis results
        const parsedTranscription = TranscriptionResponseSchema.safeParse(transcriptionResult);
        if (!parsedTranscription.success) {
            console.error("Invalid Transcription Data:", parsedTranscription.error.format());
            return {
                success: false,
                error: "Invalid transcription data"
            };
        }

        const parsedAnalysis = AnalysisResponseSchema.safeParse(analysisResult);
        if (!parsedAnalysis.success) {
            console.error("Invalid Analysis Data:", parsedAnalysis.error.format());
            return {
                success: false,
                error: "Invalid analysis data"
            };
        }

        // Extract the data if validation was successful
        const parsedTranscriptionData = parsedTranscription.data;
        const parsedAnalysisData = parsedAnalysis.data?.analysis;

        if (parsedTranscriptionData && parsedAnalysisData) {
            // Update the session event with the analysis results
            const updatedSessionEvent = await prisma.sessionEvent.update({
                where: { id: sessionEventId },
                data: {
                    incommingfileUrl: `/${BUCKET_NAME}/${filename}-in.wav`,
                    outgoingfileUrl: `/${BUCKET_NAME}/${filename}-out.wav`,
                    transcription: parsedTranscriptionData,
                    explanation: parsedAnalysisData.explanation?.[0] || null,
                    category: parsedAnalysisData.category?.[0] || null,
                    topic: parsedAnalysisData.topic || null,
                    emotion: parsedAnalysisData.emotion?.[0] || null,
                    keyWords: Array.isArray(parsedAnalysisData.key_words) ? parsedAnalysisData.key_words : [],
                    routinCheckStart: parsedAnalysisData.routin_check_start?.[0] || null,
                    routinCheckEnd: parsedAnalysisData.routin_check_end?.[0] || null,
                    forbiddenWords: parsedAnalysisData.forbidden_words ? parsedAnalysisData.forbidden_words : {},
                }
            });

            console.log("Updated session event with analysis results:", updatedSessionEvent.id);
        }

        // Clean up temp files
        try {
            fs.unlinkSync(customerFilePath);
            fs.unlinkSync(agentFilePath);
        } catch (cleanupError) {
            console.error("Error cleaning up temp files:", cleanupError);
        }

        return {
            success: true,
            sessionEventId,
            message: "Audio analysis completed successfully"
        };
    } catch (error) {
        console.error("Error analyzing audio:", error);
        throw error;
    }
} 