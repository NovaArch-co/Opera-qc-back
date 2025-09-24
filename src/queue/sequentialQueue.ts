import { Queue, Worker } from 'bullmq';
import { env } from '@/common/utils/envConfig';
import axios from 'axios';
import { PrismaClient } from '@prisma/client';
import { S3Client, PutObjectCommand, HeadBucketCommand, CreateBucketCommand } from '@aws-sdk/client-s3';
import path from 'node:path';
import fs from 'fs';
import os from 'os';
import moment from 'moment-jalaali';
import { uploadToMinIO } from '@/api/session/session';
import { addTranscriptionJob } from './transcriptionQueue';

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
    // If it's a process-session job, check if it's an incoming call
    if (type === 'process-session' && data.type !== 'incoming') {
        console.log(`Skipping job creation for non-incoming call: ${data.filename || 'unknown'}`);
        return {
            id: 'skipped',
            data: {
                type: data.type,
                processed: false
            }
        };
    }

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

        // Double-check that we only process incoming calls
        // This is a safety measure in case the controller filtering is bypassed
        if (type !== 'incoming') {
            console.log(`Skipping processing for non-incoming call type: ${type}, filename: ${filename}`);
            return {
                success: true,
                message: "Non-incoming call skipped",
                processed: false,
                type
            };
        }

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
        // Convert Persian date to proper JavaScript Date object
        const convertedDate = moment(date, 'YYYY-MM-DD HH:mm:ss').toDate();
        console.log(`Converting Persian date "${date}" to: ${convertedDate.toISOString()}`);

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
                date: convertedDate,
                duration,
                filename,
                keyWords: [] // Initialize with empty array
            }
        });

        console.log("Created session event:", sessionEvent);

        // Queue transcription job in the dedicated transcription queue (non-blocking)
        await addTranscriptionJob(sessionEvent.id, customerFilePath, agentFilePath, filename);

        console.log(`Fast processing completed for session ${sessionEvent.id}, transcription queued`);

        return {
            success: true,
            sessionEventId: sessionEvent.id,
            message: "Session processing completed quickly, transcription queued in background"
        };
    } catch (error) {
        console.error("Error processing session:", error);
        throw error;
    }
} 