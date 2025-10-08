import { Queue, Worker } from 'bullmq';
import { PrismaClient } from '@prisma/client';
import { sendAudioRequests } from '@/api/session/session';
import { uploadToMinIO } from '@/api/session/session';
// import { sendFilesToTranscriptionAPI } from '@/api/session/session';
import { sendToAnalysisAPI } from '@/api/session/session';
import { TranscriptionResponseSchema, AnalysisResponseSchema } from '@/api/session/sessionModel';
import path from 'node:path';
import { env } from '@/common/utils/envConfig';
import fs from 'fs';
import { S3Client, PutObjectCommand, ListBucketsCommand, CreateBucketCommand, HeadBucketCommand } from '@aws-sdk/client-s3';
import axios from 'axios';
import os from 'os';
import { getRedisClient, redisCircuitBreaker } from '@/common/utils/redisManager';

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

// Function to ensure bucket exists
async function ensureBucketExists(bucketName: string) {
    try {
        // Check if bucket exists
        try {
            await s3Client.send(new HeadBucketCommand({ Bucket: bucketName }));
            console.log(`Bucket ${bucketName} already exists`);
            return true;
        } catch (error) {
            // If we get here, bucket doesn't exist
            console.log(`Bucket ${bucketName} does not exist, creating now...`);
            await s3Client.send(new CreateBucketCommand({ Bucket: bucketName }));
            console.log(`Created bucket: ${bucketName}`);
            return true;
        }
    } catch (error) {
        console.error(`Error ensuring bucket exists: ${error}`);
        return false;
    }
}

// Create a new queue with resilient Redis connection
export const sessionQueue = new Queue('session-processing', {
    connection: await redisCircuitBreaker.execute(async () => {
        const client = await getRedisClient();
        return client;
    }),
    defaultJobOptions: {
        removeOnComplete: 1000,
        removeOnFail: 5000,
        attempts: 5,
        backoff: {
            type: 'exponential',
            delay: 2000,
        },
    }
});

// Create a worker to process the queue
export const sessionWorker = new Worker(
    env.BULL_QUEUE,
    async (job) => {
        try {
            // Get the data in the format it comes from the external service
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
            } = job.data;

            console.log("Received job data:", job.data);

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

            // Ensure bucket exists before uploading
            await ensureBucketExists(BUCKET_NAME);

            // Upload both files to MinIO
            const customerKey = `${baseFileName}-in.wav`;
            const agentKey = `${baseFileName}-out.wav`;

            // Upload customer file
            await s3Client.send(
                new PutObjectCommand({
                    Bucket: BUCKET_NAME,
                    Key: customerKey,
                    Body: customerAudioBuffer,
                    ContentType: 'audio/wav'
                })
            );
            console.log("Uploaded customer file to MinIO:", customerKey);

            // Upload agent file
            await s3Client.send(
                new PutObjectCommand({
                    Bucket: BUCKET_NAME,
                    Key: agentKey,
                    Body: agentAudioBuffer,
                    ContentType: 'audio/wav'
                })
            );
            console.log("Uploaded agent file to MinIO:", agentKey);

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

            // Map the snake_case fields to camelCase fields for Prisma
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

            // Instead of calling ASR+LLM directly, just queue the transcription job (ASR step)
            // The transcription worker will handle ASR, then enqueue LLM job for analysis
            const { addTranscriptionJob } = await import('./transcriptionQueue');
            await addTranscriptionJob(sessionEvent.id, customerFilePath, agentFilePath, filename);
            console.log(`Queued transcription job for session ${sessionEvent.id}`);

            // Clean up temp files
            try {
                fs.unlinkSync(customerFilePath);
                fs.unlinkSync(agentFilePath);
            } catch (cleanupError) {
                console.error("Error cleaning up temp files:", cleanupError);
            }

            return {
                success: true,
                sessionEventId: sessionEvent.id
            };
        } catch (error) {
            console.error('Error processing session:', error);
            throw error;
        }
    },
    {
        connection: {
            host: env.REDIS_HOST,
            port: Number(env.REDIS_PORT || '6379'),
        },
        concurrency: 4,
        removeOnComplete: { count: 1000 },
        removeOnFail: { count: 5000 }
    }
); 