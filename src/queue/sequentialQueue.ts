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

// Fix MinIO endpoint configuration - add protocol if missing
const getMinioEndpoint = () => {
    const endpoint = env.MINIO_ENDPOINT_UTL || 'localhost';

    // If endpoint already includes protocol, return as is
    if (endpoint.startsWith('http://') || endpoint.startsWith('https://')) {
        return endpoint;
    }

    // Otherwise, add http:// protocol
    return `http://${endpoint}`;
};

const s3Client = new S3Client({
    region: "us-east-1",
    endpoint: getMinioEndpoint(),
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
            username: "Tipax",
            password: "Goz@r!SimotelTip@x!1404"
        };

        // Download audio file from file server
        const baseFileName = filename.replace(".wav", "");

        // Use different base URLs based on the call type
        const fileServerBaseUrl = type === 'incoming'
            ? `http://94.182.56.132/tmp/two-channel/stream-audio-incoming.php?recfile=`
            : `http://94.182.56.132/tmp/two-channel/stream-audio-outgoing.php?recfile=`;

        // Download customer file (-in)
        const customerFileUrl = `${fileServerBaseUrl}${baseFileName}-in`;
        console.log("Downloading customer file from:", customerFileUrl);
        const customerResponse = await axios.get(customerFileUrl, {
            responseType: 'arraybuffer',
            auth: auth
        });
        const customerAudioBuffer = Buffer.from(customerResponse.data);

        // Download agent file (-out)
        const agentFileUrl = `${fileServerBaseUrl}${baseFileName}-out`;
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

        // Send files to the combined process API endpoint that handles both transcription and analysis
        console.log("Sending files to process API...");
        const processResult = await sendFilesToTranscriptionAPI(customerFilePath, agentFilePath);
        console.log("Process Result:", processResult);

        if (!processResult) {
            return {
                success: false,
                error: "Audio processing failed"
            };
        }

        // The sendToAnalysisAPI now just returns the same processResult since analysis is included
        const analysisResult = await sendToAnalysisAPI(processResult);

        // Parse and validate the process result against our schema
        const parsedProcess = TranscriptionResponseSchema.safeParse(processResult);
        if (!parsedProcess.success) {
            console.error("Invalid Process Data:", parsedProcess.error.format());
            return {
                success: false,
                error: "Invalid process data"
            };
        }

        // Now update the session event with the process results
        try {
            const transcriptionData = processResult.transcription;
            const analysisData = processResult.analysis || {};

            // Update the session event with the data from the process API
            const updatedSessionEvent = await prisma.sessionEvent.update({
                where: { id: sessionEventId },
                data: {
                    incommingfileUrl: `/${BUCKET_NAME}/${filename}-in.wav`,
                    outgoingfileUrl: `/${BUCKET_NAME}/${filename}-out.wav`,
                    transcription: processResult, // Store the complete process result
                    explanation: analysisData.explanation?.[0] || null,
                    // These fields might not be present in the new API format, so set them to null/defaults
                    category: null,
                    topic: analysisData.topic || null,
                    emotion: null,
                    keyWords: [], // No key_words in the new format
                    routinCheckStart: null,
                    routinCheckEnd: null,
                    forbiddenWords: {}, // No forbidden_words in the new format
                }
            });

            console.log("Updated session event with process results:", updatedSessionEvent.id);

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
        } catch (dbError) {
            console.error("Error updating database with process results:", dbError);
            return {
                success: false,
                error: "Database update failed"
            };
        }
    } catch (error) {
        console.error("Error analyzing audio:", error);
        throw error;
    }
} 