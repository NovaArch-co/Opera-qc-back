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
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
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

            // Download audio file from file server
            const fileUrl = `${env.FILE_SERVER_BASE_URL}${filename}`;
            const response = await axios.get(fileUrl, { responseType: 'arraybuffer' });
            const audioBuffer = Buffer.from(response.data);

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