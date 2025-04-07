import { Queue, Worker } from 'bullmq';
import { PrismaClient } from '@prisma/client';
import { sendAudioRequests } from '@/api/session/session';
import { uploadToMinIO } from '@/api/session/session';
import { sendFilesToTranscriptionAPI } from '@/api/session/session';
import { sendToAnalysisAPI } from '@/api/session/session';
import { TranscriptionResponseSchema, AnalysisResponseSchema } from '@/api/session/sessionModel';
import path from 'node:path';
import { env } from '@/common/utils/envConfig';
import fs from 'fs';
import { S3Client, PutObjectCommand, ListBucketsCommand, CreateBucketCommand, HeadBucketCommand } from '@aws-sdk/client-s3';
import axios from 'axios';

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

// Create a new queue
export const sessionQueue = new Queue('session-processing', {
    connection: {
        host: env.REDIS_HOST || 'localhost',
        port: parseInt(env.REDIS_PORT || '6379', 10),
    }
});

// Create a worker to process the queue
export const sessionWorker = new Worker(
    env.BULL_QUEUE,
    async (job) => {
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
            } = job.data;

            // Basic auth credentials for file server
            const auth = {
                username: "FaraErtebat",
                password: "Goz@r!AsreFar@Erteb@t!1403"
            };

            // Download audio file from file server
            const fileUrl = `${env.FILE_SERVER_BASE_URL}${filename}`;
            const response = await axios.get(fileUrl, {
                responseType: 'arraybuffer',
                auth: auth
            });
            const audioBuffer = Buffer.from(response.data);

            // Ensure bucket exists before uploading
            await ensureBucketExists(BUCKET_NAME);

            // Upload to MinIO
            const key = `${filename}.wav`;
            await s3Client.send(
                new PutObjectCommand({
                    Bucket: BUCKET_NAME,
                    Key: key,
                    Body: audioBuffer,
                    ContentType: 'audio/wav'
                })
            );

            // Create session event in database
            const sessionEvent = await prisma.sessionEvent.create({
                data: {
                    type,
                    sourceChannel,
                    sourceNumber,
                    queue,
                    destChannel,
                    destNumber,
                    date,
                    duration,
                    filename
                }
            });

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
            port: parseInt(env.REDIS_PORT, 10),
        },
        concurrency: 5,
        removeOnComplete: { count: 1000 },
        removeOnFail: { count: 5000 }
    }
); 